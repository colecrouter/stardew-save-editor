import { NodeServices } from "@effect/platform-node";
import { CliError, Command, Flag } from "effect/cli";
import { TaggedError } from "effect/Data";
import * as Effect from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { generate } from "./generate.ts";

class UsageError extends TaggedError("UsageError")<{
	readonly message: string;
}> {}
// Effect CLI owns required flags, help, version output, and argument diagnostics.
// The handler keeps the same three inputs used by the generator experiment.
const command = Command.make(
	"game-data-schema",
	{
		catalog: Flag.String("catalog").pipe(
			Flag.withDescription("Inspection catalog JSON (format 3)."),
		),
		type: Flag.String("type").pipe(
			Flag.withDescription("Root CLR type to compile."),
		),
		output: Flag.String("output").pipe(
			Flag.withDescription("Destination TypeScript module."),
		),
	},
	(args) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem;
			const path = yield* Path;

			const catalog = path.resolve(args.catalog);
			const rootType = args.type;
			const output = path.resolve(args.output);

			// Resolve paths first so differently spelled paths cannot overwrite the
			// input catalog. This tool writes TypeScript modules, not catalog JSON.
			if (!output.endsWith(".ts") || output === catalog)
				return yield* new UsageError({
					message: "Output must be a separate .ts file",
				});

			// Write a static import into the generated module, relative to its
			// destination. The generator itself never imports/evaluates that output.
			// Import specifiers use / on Windows too, and local imports need ./ or ../.
			let runtimeImport = path
				.relative(
					path.dirname(output),
					path.resolve(import.meta.dirname, "xml-codecs.ts"),
				)
				.replaceAll("\\", "/");
			if (!runtimeImport.startsWith(".")) runtimeImport = `./${runtimeImport}`;
			const input = yield* fs.readFileString(catalog, "utf8");
			const source = yield* Effect.try(() =>
				generate(JSON.parse(input), rootType, runtimeImport),
			);

			// Generate before creating output files, so unsupported metadata leaves
			// an existing module intact. Put the scoped temporary directory beside
			// the destination: rename must stay on one filesystem to be atomic.
			const outputDirectory = path.dirname(output);
			yield* fs.makeDirectory(outputDirectory, { recursive: true });
			const tmpDir = yield* fs.makeTempDirectoryScoped({
				directory: outputDirectory,
				prefix: ".schema-",
			});
			const tmpFile = path.join(tmpDir, "output.ts");
			yield* fs.writeFileString(tmpFile, source);
			yield* fs.rename(tmpFile, output);

			console.error(`Generated ${output}`);
		})

			// Unwrap expected boundary exceptions before printing; UnknownError's generic
			// message otherwise hides the member path that explains a generation failure.
			.pipe(
				Effect.catchTag("UnknownError", (error) =>
					Effect.fail(
						new UsageError({
							message:
								error.cause instanceof Error
									? error.cause.message
									: String(error.cause),
						}),
					),
				),
			),
).pipe(
	Command.withDescription(
		"Compile a game catalog type to Effect Schema XML codecs.",
	),
);

// NodeServices supplies the real terminal, stdio, filesystem and path services.
// The scope also cleans temporary directories after success or failure. Parser
// errors have already been rendered by Effect CLI; print only handler failures.
await Effect.runPromise(
	Effect.scoped(
		Command.run(command, { version: "0.1.0" }).pipe(
			Effect.provide(NodeServices.layer),
		),
	),
).catch((error: unknown) => {
	if (!CliError.isCliError(error))
		console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
