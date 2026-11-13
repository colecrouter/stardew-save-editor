using System.CommandLine;

internal sealed class RootCommand : System.CommandLine.RootCommand
{
	public RootCommand() : base("Inspect game metadata, generate typed codecs, and report XML coverage.")
	{
		// The parser supplies --help and --version; all commands share diagnostics.
		var verbose = new Option<bool>("--verbose") { Description = "Show detailed errors.", Recursive = true };
		Options.Add(verbose);
		Subcommands.Add(new InspectCommand(verbose));
		Subcommands.Add(new CoverageCommand(verbose));
		Subcommands.Add(new GenerateCommand(verbose));
	}
}
