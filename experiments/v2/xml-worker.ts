import { parentPort } from "node:worker_threads";
import { Effect } from "effect";
import type { SaveDocument } from "./domain.ts";
import { SaveCodec, SaveCodecLive } from "./save-service.ts";

if (!parentPort) throw new Error("XML worker requires parentPort");
parentPort.once(
	"message",
	(
		request:
			| { operation: "decode"; value: Uint8Array }
			| { operation: "encode"; value: SaveDocument },
	) => {
		const program = Effect.gen(function* () {
			const codec = yield* SaveCodec;
			const value = yield* request.operation === "decode"
				? codec.decode(request.value)
				: codec.encode(request.value);
			parentPort?.postMessage({ ok: true, value });
		}).pipe(
			Effect.catch((error) =>
				Effect.sync(() => {
					parentPort?.postMessage({
						ok: false,
						error: {
							message: String(error),
							stage: "stage" in error ? error.stage : undefined,
						},
					});
				}),
			),
			Effect.provide(SaveCodecLive),
		);
		Effect.runFork(program);
	},
);
