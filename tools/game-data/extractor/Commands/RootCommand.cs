using System.CommandLine;

internal sealed class RootCommand : System.CommandLine.RootCommand
{
	public RootCommand() : base("Inspect Stardew Valley serialization metadata, unpack assets, and compare saves.")
	{
		// The parser supplies --help and --version; all commands share diagnostics.
		var verbose = new Option<bool>("--verbose") { Description = "Show detailed errors.", Recursive = true };
		Options.Add(verbose);
		Subcommands.Add(new InspectCommand(verbose));
		Subcommands.Add(new UnpackCommand(verbose));
		Subcommands.Add(new ValidateCommand(verbose));
	}
}
