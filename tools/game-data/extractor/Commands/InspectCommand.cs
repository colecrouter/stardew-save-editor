using System.CommandLine;

public sealed class InspectCommand : Command
{
	public InspectCommand(Option<bool> verbose) : base("inspect", "Extract a catalog of reachable types and XML serialization attributes.")
	{
		var game = new GamePathOption();
		var output = new Option<string?>("--output", "-o") { Description = "Catalog JSON destination; defaults to stdout." };
		var types = new Option<string[]>("--type") { Description = "Root CLR type (repeatable); defaults to StardewValley.SaveGame.", AllowMultipleArgumentsPerToken = true };
		Options.Add(game); Options.Add(output); Options.Add(types);
		SetAction(result => Cli.Run(result.GetValue(verbose), () =>
		{
			var roots = result.GetValue(types) ?? [];
			if (roots.Length == 0) roots = ["StardewValley.SaveGame"];
			var catalog = CatalogExtractor.Extract(GameInstallation.Resolve(result.GetValue(game)), roots);
			Cli.Write(catalog, result.GetValue(output));
			Console.Error.WriteLine($"Inspected {catalog.Types.Count} types; {catalog.Diagnostics.Count} diagnostics.");
			return catalog.Diagnostics.Count == 0 ? 0 : 1;
		}));
	}
}
