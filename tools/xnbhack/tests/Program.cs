using AssetDump;

// These filesystem contracts need neither game assemblies nor a graphics device.
// Each case owns its directories so cleanup cannot affect a developer's assets.
foreach (string scenario in new[] { "failed-unpack", "success", "failed-publish", "failed-assets" })
{
    string root = Path.Combine(Path.GetTempPath(), $"asset-workspace-{Guid.NewGuid():N}");
    string game = Path.Combine(root, "game");
    string host = Path.Combine(root, "host");
    string project = Path.Combine(root, "project");
    Directory.CreateDirectory(Path.Combine(game, "Content"));
    Directory.CreateDirectory(host);
    Directory.CreateDirectory(Path.Combine(project, "content"));
    Directory.CreateDirectory(Path.Combine(project, "generated", "save-format"));
    File.WriteAllText(Path.Combine(project, "generated", "save-format", "save.ts"), "preserve schema");
    Directory.CreateDirectory(Path.Combine(project, "static", "assets"));
    File.WriteAllText(Path.Combine(project, "generated", "old.json"), "{}");
    File.WriteAllText(Path.Combine(project, "static", "assets", "old.png"), "previous asset");
    Directory.CreateDirectory(Path.Combine(project, "static", "assets", "achievements"));
    File.WriteAllText(Path.Combine(project, "static", "assets", "achievements", "0.jpg"), "maintained Steam artwork");
    File.WriteAllText(Path.Combine(game, "Content", "source.txt"), "source");
    File.WriteAllText(Path.Combine(project, "content", "old.txt"), "old");
    try
    {
        using (var workspace = new ContentWorkspace(project, host, game))
        {
            if (scenario == "success")
            {
                Directory.CreateDirectory(workspace.OutputDirectory);
                File.WriteAllText(Path.Combine(workspace.OutputDirectory, "fresh.txt"), "fresh");
                workspace.PrepareGeneratedOutput();
                File.WriteAllText(Path.Combine(workspace.GeneratedDirectory, "old.json"), "fresh catalog");
                Directory.CreateDirectory(workspace.AssetsDirectory);
                workspace.Publish();
            }
            else if (scenario is "failed-publish" or "failed-assets")
            {
                // Missing generated output must roll back already-published content.
                Directory.CreateDirectory(workspace.OutputDirectory);
                File.WriteAllText(Path.Combine(workspace.OutputDirectory, "fresh.txt"), "fresh");
                if (scenario == "failed-assets")
                {
                    Directory.CreateDirectory(workspace.GeneratedDirectory);
                    File.WriteAllText(Path.Combine(workspace.GeneratedDirectory, "fresh.json"), "{}");
                }
                bool failed = false;
                try { workspace.Publish(); }
                catch (DirectoryNotFoundException) { failed = true; }
                Assert(failed, "publishing missing output should fail");
            }
            // Without Publish, disposal models an unpacker which reported failure.
        }

        Assert(!Directory.Exists(Path.Combine(host, "Content")), "temporary link should be removed");
        Assert(File.ReadAllText(Path.Combine(game, "Content", "source.txt")) == "source", "game content must survive cleanup");
        string expected = scenario == "success" ? "fresh.txt" : "old.txt";
        Assert(File.Exists(Path.Combine(project, "content", expected)), $"{scenario} should retain {expected}");
        Assert(scenario == "success" || File.Exists(Path.Combine(project, "generated", "old.json")), "catalog rollback should restore the previous output");
        Assert(scenario == "success" || File.Exists(Path.Combine(project, "static", "assets", "old.png")), "asset rollback should preserve the previous images");
        Assert(scenario != "success" || !File.Exists(Path.Combine(project, "static", "assets", "old.png")), "preserving maintained artwork must not retain stale extracted assets");
        Assert(File.ReadAllText(Path.Combine(project, "static", "assets", "achievements", "0.jpg")) == "maintained Steam artwork", "asset publication and rollback must preserve maintained Steam artwork");
        Assert(File.ReadAllText(Path.Combine(project, "generated", "save-format", "save.ts")) == "preserve schema", "asset generation must preserve the typed save codec");
        Assert(!Directory.EnumerateDirectories(Path.Combine(project, ".cache", "xnbhack")).Any(), "temporary workspace should be removed");
        Console.WriteLine($"Passed: {scenario}");
    }
    finally { Directory.Delete(root, recursive: true); }
}

static void Assert(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

CatalogTests.Run();
