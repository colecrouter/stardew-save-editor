import { Worker } from "node:worker_threads";
import { Effect, Layer } from "effect";
import type { SaveDocument } from "./domain.ts";
import { SaveCodec, SaveReadError, SaveWriteError } from "./save-service.ts";

// Fresh worker per request is deliberately simple and expensive. This proves
// ownership/cancellation, not an optimized worker pool. Production Comlink remains.
export const workerCodecLayer = (
	observe: (delta: number) => void = () => {},
) => {
	const request = <A>(
		operation: "decode" | "encode",
		value: Uint8Array | SaveDocument,
	) =>
		Effect.scoped(
			Effect.gen(function* () {
				const worker = yield* Effect.acquireRelease(
					Effect.sync(() => {
						const worker = new Worker(
							new URL("./xml-worker.ts", import.meta.url),
						);
						observe(1);
						return worker;
					}),
					(worker) =>
						Effect.promise(async () => {
							await worker.terminate();
							observe(-1);
						}),
				);
				return yield* Effect.callback<A, SaveReadError | SaveWriteError>(
					(resume) => {
						const fail = (cause: unknown) =>
							resume(
								Effect.fail(
									operation === "decode"
										? new SaveReadError({ stage: "xml", cause })
										: new SaveWriteError({ cause }),
								),
							);
						const message = (reply: {
							ok: boolean;
							value: A;
							error?: { stage?: SaveReadError["stage"]; message: string };
						}) => {
							if (reply.ok) resume(Effect.succeed(reply.value));
							else if (operation === "decode")
								resume(
									Effect.fail(
										new SaveReadError({
											stage: reply.error?.stage ?? "xml",
											cause: reply.error?.message,
										}),
									),
								);
							else fail(reply.error?.message);
						};
						const exit = (code: number) =>
							fail(new Error(`Worker exited before a result (${code})`));
						worker.once("message", message);
						worker.once("error", fail);
						worker.once("exit", exit);
						worker.postMessage({ operation, value });
						return Effect.sync(() => {
							worker.off("message", message);
							worker.off("error", fail);
							worker.off("exit", exit);
						});
					},
				);
			}),
		);
	return Layer.succeed(SaveCodec, {
		decode: (bytes) =>
			request<SaveDocument>("decode", bytes).pipe(
				Effect.mapError((cause) =>
					cause instanceof SaveReadError
						? cause
						: new SaveReadError({ stage: "xml", cause }),
				),
			),
		encode: (document) =>
			request<Uint8Array>("encode", document).pipe(
				Effect.mapError((cause) =>
					cause instanceof SaveWriteError
						? cause
						: new SaveWriteError({ cause }),
				),
			),
	});
};
