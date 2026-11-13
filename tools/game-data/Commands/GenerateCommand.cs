using System.CommandLine;
using System.Text.Json;

internal sealed class GenerateCommand : Command
{
	public GenerateCommand(Option<bool> verbose) : base("generate", "Generate typed plain-value XML codecs from game metadata.")
	{
		var game = new GamePathOption();
		var catalog = new Option<string?>("--catalog") { Description = "Use a saved inspection catalog instead of inspecting the installed game." };
		var root = new Option<string>("--type") { DefaultValueFactory = _ => "StardewValley.SaveGame", Description = "Root CLR type to compile." };
		var output = new Option<string>("--output", "-o") { Required = true, Description = "Destination TypeScript module." };
		var runtime = new Option<string?>("--runtime") { Description = "Runtime TypeScript file; defaults to src/lib/save-format/index.ts from the repository root." };
		Options.Add(game);
		Options.Add(catalog);
		Options.Add(root);
		Options.Add(output);
		Options.Add(runtime);
		SetAction(result => Cli.Run(result.GetValue(verbose), () =>
		{
			var target = Path.GetFullPath(result.GetValue(output)!);
			var input = result.GetValue(catalog);

			if (!target.EndsWith(".ts", StringComparison.Ordinal) || input is not null && Path.GetFullPath(input) == target)
				throw new ArgumentException("Output must be a separate .ts file.");
			if (input is not null && result.GetValue(game) is not null)
				throw new ArgumentException("Choose --catalog or --game-path, not both.");

			// Inspect and compile in one invocation by default. Catalogs remain useful
			// snapshots for reproducible tests, not a mandatory cross-language handoff.
			var type = result.GetValue(root)!;
			var data = input is null
				? CatalogExtractor.Extract(GameInstallation.Resolve(result.GetValue(game)), [type])
				: JsonSerializer.Deserialize<Catalog>(File.ReadAllText(input), Cli.Json)
				?? throw new InvalidDataException("Empty catalog.");
			var contract = new ContractResolver(data).Resolve(type);

			var runtimeFile = Path.GetFullPath(result.GetValue(runtime) ?? "src/lib/save-format/index.ts");
			if (!File.Exists(runtimeFile)) throw new FileNotFoundException("Runtime not found; run from the repository root or supply --runtime.", runtimeFile);

			var import = Path.GetRelativePath(Path.GetDirectoryName(target)!, runtimeFile).Replace('\\', '/');
			if (!import.StartsWith('.')) import = "./" + import;

			var source = new TypeScriptEmitter(contract).Emit(import);

			Cli.WriteText(source, target);
			Console.Error.WriteLine($"Generated {target} ({contract.Objects.Count} object contracts).");
			return 0;
		}));
	}
}
