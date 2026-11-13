// Return parser errors distinctly from operational failures for shell automation.
var parsed = new RootCommand().Parse(args);
if (parsed.Errors.Count > 0)
{
	parsed.Invoke();
	return 2;
}

// Command actions reserve stdout for JSON and return their own success/failure code.
return parsed.Invoke();
