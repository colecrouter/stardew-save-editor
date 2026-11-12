using System.Text.RegularExpressions;

internal static class GameInstallation
{
	public static string Resolve(string? supplied)
	{
		// An explicit path or environment setting is authoritative: don't silently
		// inspect another installed version when the requested path is broken.
		var requested = supplied ?? Environment.GetEnvironmentVariable("STARDEW_GAME_PATH");
		if (!string.IsNullOrWhiteSpace(requested)) return Require(requested);
		var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
		var steamRoots = new[]
		{
			Path.Combine(home, ".steam/steam"), Path.Combine(home, ".local/share/Steam"),
			Path.Combine(home, "Library/Application Support/Steam"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam")
		};
		var candidates = new List<string>();
		foreach (var root in steamRoots)
		{
			candidates.Add(Path.Combine(root, "steamapps/common/Stardew Valley"));
			var libraries = Path.Combine(root, "steamapps/libraryfolders.vdf");
			if (!File.Exists(libraries)) continue;
			// Steam records additional library roots in quoted VDF path entries.
			foreach (Match match in Regex.Matches(File.ReadAllText(libraries), "\"path\"\\s+\"([^\"]+)\""))
				candidates.Add(Path.Combine(match.Groups[1].Value.Replace("\\\\", "\\"), "steamapps/common/Stardew Valley"));
		}
		candidates.Add(Path.Combine(home, "GOG Games/Stardew Valley"));
		foreach (var candidate in candidates)
		{
			foreach (var directory in new[] { candidate, Path.Combine(candidate, "Contents/MacOS") })
				if (File.Exists(Path.Combine(directory, "Stardew Valley.dll"))) return Path.GetFullPath(directory);
		}
		throw new DirectoryNotFoundException("Game not found. Supply --game-path or STARDEW_GAME_PATH.");
	}

	private static string Require(string path)
	{
		var full = Path.GetFullPath(path);
		if (File.Exists(full)) full = Path.GetDirectoryName(full)!;
		if (!File.Exists(Path.Combine(full, "Stardew Valley.dll")))
			throw new FileNotFoundException($"No Stardew Valley.dll in {full}. Supply the executable directory.");
		return full;
	}
}
