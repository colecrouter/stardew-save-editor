using System.Diagnostics;
using System.Security.Cryptography;

internal sealed record AssetExportOptions(string? GamePath, string Output, string[] Assets,
	string? Unpacker, string? UnpackedPath);
internal sealed record ExportedAsset(string Path, string Sha256);
internal sealed record AssetManifest(int FormatVersion, string ToolVersion, string SourceKind,
	string SourcePath, string GameAssemblySha256, bool SourceMatchesGameVerified,
	string? UnpackerSha256, string[] Assets, List<ExportedAsset> Files,
	string[] UnconvertedAssets, string[] MissingAssets);
internal sealed record AssetExportResult(string Output, AssetManifest Manifest)
{
	public bool Success => Manifest.UnconvertedAssets.Length == 0 && Manifest.MissingAssets.Length == 0;
}

// Owns the export operation: installation discovery, process execution, selection,
// copying and provenance. The CLI only supplies options and renders its result.
internal static class AssetExporter
{
	public static AssetExportResult Export(AssetExportOptions options)
	{
		var gamePath = GameInstallation.Resolve(options.GamePath);
		var destination = Path.GetFullPath(options.Output);
		var existing = options.UnpackedPath;
		if (existing is not null && options.Unpacker is not null)
			throw new ArgumentException("Choose --unpacked-path or --unpacker, not both.");
		var input = Path.GetFullPath(existing ?? Path.Combine(gamePath, "Content (unpacked)"));
		var selections = options.Assets.Select(Normalize).ToArray();
		// Keep source and destination disjoint. Never merge exports from
		// different game versions or overwrite existing assets implicitly.
		if (Within(destination, gamePath) || Within(gamePath, destination) || Within(destination, input) || Within(input, destination))
			throw new IOException("Output must be outside the game and unpacked source directories.");
		if (Directory.Exists(destination) && Directory.EnumerateFileSystemEntries(destination).Any())
			throw new IOException("Output must be a new or empty directory.");
		string? toolHash = null;
		if (existing is null)
		{
			if (Directory.Exists(input)) throw new IOException("Content (unpacked) already exists. Use --unpacked-path to select it explicitly, or move it before a fresh unpack.");
			var executable = Path.GetFullPath(options.Unpacker ?? Path.Combine(gamePath, OperatingSystem.IsWindows() ? "StardewXnbHack.exe" : "StardewXnbHack"));
			if (!File.Exists(executable)) throw new FileNotFoundException("Install StardewXnbHack and its dependencies in the game folder, or supply --unpacked-path. See tools/game-data/README.md.");
			if (Path.GetDirectoryName(executable) != gamePath) throw new IOException("StardewXnbHack must be installed in the selected game directory.");
			toolHash = Hash(executable);
			// XnbHack has no output-path option and may prompt on completion.
			// Its logs go to stderr, and redirected stdin prevents an idle prompt.
			var start = new ProcessStartInfo(executable) { WorkingDirectory = gamePath, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardInput = true };
			using var process = Process.Start(start) ?? throw new IOException("Could not launch StardewXnbHack.");
			process.StandardInput.Close();
			var logging = process.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardError());
			if (!process.WaitForExit(300_000))
			{
				process.Kill(true);
				process.WaitForExit();
				throw new IOException("Unpacker exceeded five minutes; inspect Content (unpacked) before retrying.");
			}
			logging.GetAwaiter().GetResult();
			if (process.ExitCode != 0) throw new IOException($"Unpacker exited with code {process.ExitCode}.");
		}
		if (!Directory.Exists(input)) throw new DirectoryNotFoundException($"Unpacked content not found: {input}");
		var files = Directory.EnumerateFiles(input, "*", new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint })
			.Select(file => (Source: file, Relative: Path.GetRelativePath(input, file).Replace('\\', '/')))
			.Where(file => selections.Length == 0 || selections.Any(s => Matches(file.Relative, s)))
			.OrderBy(file => file.Relative, StringComparer.Ordinal).ToArray();
		if (files.Length == 0) throw new IOException("No unpacked files match the requested assets.");
		foreach (var selection in selections)
			if (!files.Any(f => Matches(f.Relative, selection))) throw new IOException($"No files match asset: {selection}");
		Directory.CreateDirectory(destination);
		var exports = new List<ExportedAsset>();
		foreach (var file in files)
		{
			var target = Path.Combine(destination, file.Relative);
			Directory.CreateDirectory(Path.GetDirectoryName(target)!);
			File.Copy(file.Source, target, false);
			exports.Add(new(file.Relative, Hash(target)));
		}
		var raw = files.Where(f => Path.GetExtension(f.Relative).Equals(".xnb", StringComparison.OrdinalIgnoreCase)).Select(f => f.Relative).ToArray();
		// XnbHack sometimes reports a failed asset but exits successfully.
		// Check that every selected packed input has at least one exported
		// counterpart; raw fallback files are separately marked unconverted.
		var packed = Path.Combine(gamePath, "Content");
		var missing = existing is null && Directory.Exists(packed)
			? Directory.EnumerateFiles(packed, "*.xnb", SearchOption.AllDirectories)
				.Select(f => Path.GetRelativePath(packed, f).Replace('\\', '/'))
				.Where(f => selections.Length == 0 || selections.Any(s => Matches(f, s)))
				.Where(f => !files.Any(export => Path.ChangeExtension(export.Relative, null) == Path.ChangeExtension(f, null)))
				.Order(StringComparer.Ordinal).ToArray()
			: [];
		// Existing exports have unverifiable provenance: record that explicitly
		// rather than claiming they came from the current game installation.
		var manifest = new AssetManifest(
			FormatVersion: 1,
			ToolVersion: typeof(AssetExporter).Assembly.GetName().Version!.ToString(),
			SourceKind: existing is null ? "fresh-stardew-xnb-hack" : "existing-unpacked-directory",
			SourcePath: input,
			GameAssemblySha256: Hash(Path.Combine(gamePath, "Stardew Valley.dll")),
			SourceMatchesGameVerified: existing is null,
			UnpackerSha256: toolHash,
			Assets: selections,
			Files: exports,
			UnconvertedAssets: raw,
			MissingAssets: missing);
		return new(destination, manifest);
	}

	private static string Hash(string file) => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))).ToLowerInvariant();
	private static bool Within(string path, string parent) => path.Equals(parent, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)
		|| path.StartsWith(parent.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
	private static bool Matches(string path, string selection) => path == selection || path.StartsWith(selection + "/", StringComparison.Ordinal) || path[..^Path.GetExtension(path).Length] == selection;
	private static string Normalize(string value)
	{
		var path = value.Replace('\\', '/').TrimEnd('/');
		if (string.IsNullOrWhiteSpace(path) || Path.IsPathRooted(path) || path.Split('/').Any(p => p is ".." or "." or ""))
			throw new ArgumentException($"Asset must be a relative content path without traversal: {value}");
		return path;
	}
}
