using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Loader;
using StardewXnbHack.Framework;
using StardewXnbHack.ProgressHandling;

namespace AssetDump;

internal static class EntryPoint
{
    public static int Main()
    {
        try
        {
            // Use the same explicit installation for compilation and runtime;
            // the npm command adds no second argument parser or launcher.
            string gamePath = Path.GetFullPath(Environment.GetEnvironmentVariable("STARDEW_GAME_PATH")
                ?? throw new InvalidOperationException("Set STARDEW_GAME_PATH to the directory containing Stardew Valley.dll."));
            // Resolve game dependencies in place before any game types are JIT-compiled.
            // Toolkit dependencies continue to come from our pinned NuGet restore.
            AssemblyLoadContext.Default.Resolving += (_, name) =>
            {
                string path = Path.Combine(gamePath, $"{name.Name}.dll");
                return File.Exists(path) ? AssemblyLoadContext.Default.LoadFromAssemblyPath(path) : null;
            };
            AssemblyLoadContext.Default.ResolvingUnmanagedDll += (_, name) =>
            {
                // MonoGame's portable import names don't always match the native
                // filenames distributed with the Linux and macOS game builds.
                foreach (string folder in new[] { gamePath, Path.Combine(gamePath, "lib64"), Path.Combine(gamePath, "lib") })
                    foreach (string file in new[] { name, $"{name}.dll", $"lib{name}.so", $"lib{name}.dylib",
                    name.Contains("SDL2") ? "libSDL2-2.0.so.0" : $"lib{name}.so.0" })
                        if (NativeLibrary.TryLoad(Path.Combine(folder, file), out var handle))
                            return handle;
                return IntPtr.Zero;
            };

            // MonoGame resolves Content beside this assembly. The link lives in
            // our build output; unpacked files and game-created scratch files live
            // in a disposable workspace, never in the installed game directory.
            string projectRoot = Directory.GetCurrentDirectory();
            using var workspace = new ContentWorkspace(projectRoot, AppContext.BaseDirectory, gamePath);
            Directory.SetCurrentDirectory(workspace.WorkingDirectory);
            try
            {
                if (Run(gamePath, workspace.OutputDirectory) != 0)
                    return 1;
                // Transform the fresh unpack before replacing any maintained output.
                Console.WriteLine("Generating editor catalogs and assets...");
                workspace.PrepareGeneratedOutput();
                new CatalogGenerator(workspace.OutputDirectory, workspace.GeneratedDirectory, workspace.AssetsDirectory).Generate();
                workspace.Publish();
                Console.WriteLine($"Updated catalogs and assets in {projectRoot}.");
                return 0;
            }
            finally
            {
                Directory.SetCurrentDirectory(projectRoot);
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    // Keep JIT resolution of XnbHack/game types behind the resolver registration.
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int Run(string gamePath, string outputPath)
    {
        // XnbHack reports failures through its logger instead of its return value.
        // Treat unsupported shader files as expected, but reject broken exports.
        var logger = new ExportLogger(outputPath);
        StardewXnbHack.Program.Run([], gamePath: gamePath,
            getLogger: (context, _) =>
            {
                logger.Context = (UnpackContext)context;
                return logger;
            },
            showPressAnyKeyToExit: false);
        return logger.Completed && !logger.Failed ? 0 : 1;
    }

    private sealed class ExportLogger(string outputPath) : IProgressLogger
    {
        public UnpackContext Context { private get; set; }
        public bool Failed { get; private set; }
        public bool Completed { get; private set; }
        private int filesStarted;

        public void OnStepChanged(ProgressStep step, string message)
        {
            // XnbHack initializes its default export path just before GameFound.
            // Redirect it before any files are written, preserving the game folder.
            if (step == ProgressStep.GameFound)
                Context.ExportPath = outputPath;
            if (step == ProgressStep.Done)
                Completed = true;
            Console.WriteLine(message);
        }

        public void OnFatalError(string error)
        {
            Failed = true;
            Console.Error.WriteLine(error);
        }

        public void OnFileUnpackFailed(string relativePath, UnpackFailedReason errorCode, string errorMessage)
        {
            // Effect bytecode has no editable representation; upstream copies it
            // unchanged. Any read/write failure must stop downstream generation.
            bool unsupportedShader = errorCode == UnpackFailedReason.UnsupportedFileType
                && relativePath.Replace('\\', '/').StartsWith("Effects/", StringComparison.OrdinalIgnoreCase);
            if (!unsupportedShader)
                Failed = true;
            Console.Error.WriteLine($"{relativePath}: {errorCode}: {errorMessage}");
        }

        public void OnFileUnpacking(string relativePath)
        {
            // Whole-game exports take time; report bounded progress without a
            // terminal-only progress bar or one log line for every source asset.
            if (++filesStarted % 250 == 0)
                Console.WriteLine($"Unpacking asset {filesStarted}: {relativePath}");
        }

        public void OnEnded() { }
    }
}
