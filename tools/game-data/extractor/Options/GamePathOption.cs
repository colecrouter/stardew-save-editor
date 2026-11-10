using System.CommandLine;

public sealed class GamePathOption : Option<string?>
{
	public GamePathOption() : base("--game-path", "-p")
	{
		Description = "Game directory or main assembly. Defaults to STARDEW_GAME_PATH, then installation discovery.";
	}
}
