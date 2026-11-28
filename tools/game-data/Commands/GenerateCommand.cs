using System.CommandLine;
using System.Text.Json;

internal sealed class GenerateCommand : Command
{
	public GenerateCommand(Option<bool> verbose) : base("generate", "Generate typed plain-value XML codecs from game metadata.")
	{
		var game = new GamePathOption();
		var catalog = new Option<string?>("--catalog") { Description = "Use a saved inspection catalog instead of inspecting the installed game." };
		var root = new Option<string>("--type") { DefaultValueFactory = _ => "StardewValley.SaveGame", Description = "Root CLR type to compile." };
		var output = new Option<string>("--output", "-o") { Required = true, Description = "Destination entry module; namespace modules go in a directory named after it." };
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

			// Generated modules import the runtime by a path relative to themselves.
			static string RelativeImport(string from, string file)
			{
				var path = Path.GetRelativePath(from, file).Replace('\\', '/');
				return path.StartsWith('.') ? path : "./" + path;
			}
			var import = RelativeImport(Path.GetDirectoryName(target)!, runtimeFile);
			var emitter = new TypeScriptEmitter(contract);

			// save.ts gets its modules in a sibling save/ directory. Every module is
			// emitted before anything is written, so an unsupported contract still
			// leaves the existing output untouched.
			var directoryName = Path.GetFileNameWithoutExtension(target);
			var directory = Path.Combine(Path.GetDirectoryName(target)!, directoryName);
			var (entry, modules) = emitter.Emit(directoryName, import, RelativeImport(directory, runtimeFile));
			var written = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (var module in modules)
			{
				var path = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(target)!, module.Path));
				Cli.WriteText(module.Source, path);
				written.Add(path);
			}
			// Write the entry last, so it never imports a module that is not there yet.
			Cli.WriteText(entry, target);
			// A namespace that disappeared from the contract leaves a stale module behind.
			// Delete only files this generator wrote (they start with its header), so
			// anything else someone put in the directory is left alone.
			foreach (var file in Directory.EnumerateFiles(directory, "*.ts"))
				if (!written.Contains(Path.GetFullPath(file)) && File.ReadLines(file).FirstOrDefault() == TypeScriptEmitter.Header)
					File.Delete(file);
			Console.Error.WriteLine($"Generated {target} and {modules.Count} namespace modules in {directory} ({contract.Objects.Count} object contracts).");
			return 0;
		}));
	}
}
