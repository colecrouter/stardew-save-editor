namespace AssetDump;

/// <summary>Keep unpacking isolated until a complete export can replace the inputs.</summary>
internal sealed class ContentWorkspace : IDisposable
{
    public string WorkingDirectory { get; }
    public string OutputDirectory => Path.Combine(WorkingDirectory, "unpacked");
    public string GeneratedDirectory => Path.Combine(WorkingDirectory, "generated");
    public string AssetsDirectory => Path.Combine(WorkingDirectory, "assets");
    private readonly string projectRoot;
    private readonly string contentLink;
    private bool preserveBackup;

    public ContentWorkspace(string projectRoot, string hostDirectory, string gamePath)
    {
        this.projectRoot = projectRoot;
        contentLink = Path.Combine(hostDirectory, "Content");
        string source = new[] { "Content", "../Resources/Content", "../../Resources/Content" }
            .Select(relative => Path.GetFullPath(Path.Combine(gamePath, relative)))
            .FirstOrDefault(Directory.Exists)
            ?? throw new DirectoryNotFoundException($"No Content folder found for {gamePath}.");

        // An existing directory may belong to a previous interrupted run or the
        // developer. Refuse to replace it rather than deleting an unknown tree.
        Directory.CreateSymbolicLink(contentLink, source);
        WorkingDirectory = Path.Combine(projectRoot, ".cache", "xnbhack", Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(WorkingDirectory);
        }
        catch
        {
            Directory.Delete(contentLink);
            throw;
        }
    }

    public void PrepareGeneratedOutput()
    {
        // The schema generator also owns files beneath generated/. Seed the
        // staged tree from existing output so rewriting asset catalogs does not
        // delete sibling artifacts such as generated/save-format/save.ts.
        string source = Path.Combine(projectRoot, "generated");
        Directory.CreateDirectory(GeneratedDirectory);
        CopyExistingTree(source, GeneratedDirectory);
        // Steam achievement images are maintained separately from game extraction.
        // Preserve only that owned folder; stale extracted assets must still expire.
        CopyExistingTree(Path.Combine(projectRoot, "static", "assets", "achievements"), Path.Combine(AssetsDirectory, "achievements"));
    }

    private static void CopyExistingTree(string source, string destination)
    {
        if (!Directory.Exists(source)) return;
        Directory.CreateDirectory(destination);
        foreach (string directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (string file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
            File.Copy(file, Path.Combine(destination, Path.GetRelativePath(source, file)));
    }

    public void Publish()
    {
        // Publish the inputs and both derived trees as one recoverable operation.
        // A failed later move restores earlier directories too, so the editor
        // never keeps catalogs from one run paired with assets from another.
        var targets = new[]
        {
            (Source: OutputDirectory, Destination: Path.Combine(projectRoot, "content")),
            (Source: GeneratedDirectory, Destination: Path.Combine(projectRoot, "generated")),
            (Source: AssetsDirectory, Destination: Path.Combine(projectRoot, "static", "assets"))
        };
        var changed = new List<(string Destination, string Backup, bool HadPrevious)>();
        try
        {
            foreach (var target in targets)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(target.Destination)!);
                string backup = Path.Combine(WorkingDirectory, $"previous-{changed.Count}");
                bool hadPrevious = Directory.Exists(target.Destination);
                if (hadPrevious) Directory.Move(target.Destination, backup);
                changed.Add((target.Destination, backup, hadPrevious));
                Directory.Move(target.Source, target.Destination);
            }
        }
        catch
        {
            foreach (var target in changed.AsEnumerable().Reverse())
            {
                try
                {
                    if (Directory.Exists(target.Destination)) Directory.Delete(target.Destination, recursive: true);
                    if (target.HadPrevious) Directory.Move(target.Backup, target.Destination);
                }
                catch
                {
                    // Keep every remaining backup if rollback cannot complete.
                    preserveBackup = true;
                    throw new IOException($"Could not restore previous output; recover backups from {WorkingDirectory}.");
                }
            }
            throw;
        }
    }

    public void Dispose()
    {
        // Delete only the link itself. Its target is the user's installed game.
        Directory.Delete(contentLink);
        if (!preserveBackup)
            Directory.Delete(WorkingDirectory, recursive: true);
    }
}
