import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { scenarios } from "./fixture.ts";
import { editFile } from "./platform.ts";
import { SaveCodec, SaveCodecLive } from "./save-service.ts";

// No arbitrary output file: demonstrate scoped Node I/O and delete the temporary
// output on completion. The existing fixture is always read-only.
const main = Effect.scoped(
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const codec = yield* SaveCodec;
		const input = fileURLToPath(
			new URL("../../tests/TestSave", import.meta.url),
		);
		const document = yield* codec.decode(yield* fs.readFile(input));
		const result = yield* editFile(input, scenarios(document));
		const output = yield* fs.makeTempFileScoped({ prefix: "stardew-effect-" });
		yield* fs.writeFile(output, result.exported);
		yield* codec.decode(yield* fs.readFile(output));
		yield* Effect.log({
			bytes: result.exported.length,
			operations: result.history.map((entry) => ({
				label: entry.label,
				review: entry.review,
			})),
		});
	}),
).pipe(Effect.provide(SaveCodecLive), Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
