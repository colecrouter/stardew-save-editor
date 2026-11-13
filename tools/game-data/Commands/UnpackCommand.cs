using System.CommandLine;

public sealed class UnpackCommand : Command
{
	public UnpackCommand(Option<bool> verbose) : base("unpack", "Run StardewXnbHack and export selected JSON/PNG/TMX assets with provenance.")
	{
		var game = new GamePathOption();
		var output = new Option<string>("--output", "-o") { Required = true, Description = "New or empty export directory." };
		var assets = new Option<string[]>("--asset") { AllowMultipleArgumentsPerToken = true, Description = "Relative asset or directory, without extension; repeatable. Defaults to all." };
		var unpacker = new Option<string?>("--unpacker") { Description = "StardewXnbHack executable installed in the selected game directory." };
		var source = new Option<string?>("--unpacked-path") { Description = "Use an existing StardewXnbHack export instead of running the unpacker." };
		Options.Add(game);
		Options.Add(output);
		Options.Add(assets);
		Options.Add(unpacker);
		Options.Add(source);
		SetAction(result => Cli.Run(result.GetValue(verbose), () =>
		{
			var export = AssetExporter.Export(new(
				GamePath: result.GetValue(game),
				Output: result.GetValue(output)!,
				Assets: result.GetValue(assets) ?? [],
				Unpacker: result.GetValue(unpacker),
				UnpackedPath: result.GetValue(source)));
			Cli.Write(export.Manifest, Path.Combine(export.Output, "game-data-manifest.json"));
			Cli.Write(new
			{
				output = export.Output,
				files = export.Manifest.Files.Count,
				unconvertedAssets = export.Manifest.UnconvertedAssets,
				missingAssets = export.Manifest.MissingAssets
			}, null);
			return export.Success ? 0 : 1;
		}));
	}
}
