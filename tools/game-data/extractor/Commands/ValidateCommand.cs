using System.CommandLine;
using System.Text.Json;

public sealed class ValidateCommand : Command
{
	public ValidateCommand(Option<bool> verbose) : base("validate", "Compare save element names with a metadata catalog (not full XSD validation).")
	{
		var catalog = new Option<string>("--catalog")
		{ Required = true, Description = "Catalog produced by inspect." };
		var saves = new Option<string[]>("--save")
		{ Required = true, AllowMultipleArgumentsPerToken = true, Description = "Save file or directory; repeatable. Directories include extensionless saves." };
		var output = new Option<string?>("--output", "-o") { Description = "Report JSON destination; defaults to stdout." };
		Options.Add(catalog); Options.Add(saves); Options.Add(output);
		SetAction(result => Cli.Run(result.GetValue(verbose), () =>
		{
			var data = JsonSerializer.Deserialize<Catalog>(File.ReadAllText(result.GetValue(catalog)!), Cli.Json)
				?? throw new InvalidDataException("Empty catalog.");
			if (data.FormatVersion != 3) throw new InvalidDataException("Unsupported catalog format version.");
			var report = SaveComparison.Compare(data, result.GetValue(saves)!);
			Cli.Write(report, result.GetValue(output));
			// Unsupported mappings remain visible as 'unchecked'. A catalog gap,
			// unknown XML name, or malformed document fails comparison.
			return data.Diagnostics.Count == 0 && report.Files.All(f => f.Issues.Count == 0) ? 0 : 1;
		}));
	}
}
