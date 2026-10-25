import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, FileSystem, Layer } from "effect";
import pako from "pako";
import { farmers } from "./domain.ts";
import { makeEffectSession } from "./effect.ts";
import { scenarios } from "./fixture.ts";
import { editFile } from "./platform.ts";
import { SaveCodec, SaveCodecLive, SaveReadError } from "./save-service.ts";
import { workerCodecLayer } from "./worker-service.ts";

const fixturePath = fileURLToPath(
	new URL("../../tests/TestSave", import.meta.url),
);

it.effect(
	"production codec and Node services export a full save and retain equipment metadata",
	() =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const codec = yield* SaveCodec;
			const original = yield* codec.decode(yield* fs.readFile(fixturePath));
			const session = yield* makeEffectSession(original);
			for (const action of scenarios(original)) yield* session.execute(action);
			const state = yield* session.snapshot;
			const encoded = yield* codec.encode(state.document);
			expect(yield* codec.decode(encoded)).toEqual(state.document);
			expect(state.document.SaveGame.player.money).toBe(12345);
			expect(
				farmers(state.document).every(
					(farmer) => farmer.farmName === "Experiment Farm",
				),
			).toBe(true);
			// Encoding strips synthetic equipment attributes on a copy, not on the session.
			expect(yield* session.snapshot).toEqual(state);
		}).pipe(Effect.provide(SaveCodecLive), Effect.provide(NodeServices.layer)),
);

it.effect(
	"compressed input and unknown fields survive the production codec",
	() =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const codec = yield* SaveCodec;
			const bytes = yield* fs.readFile(fixturePath);
			const original = yield* codec.decode(bytes);
			expect(yield* codec.decode(pako.deflate(bytes))).toEqual(original);
			// Unknown arrays need save-specific recognition; use an opaque object here.
			Object.assign(original.SaveGame, {
				customModField: { opaque: "007", nested: { flag: "text" } },
			});
			expect(yield* codec.decode(yield* codec.encode(original))).toEqual(
				original,
			);
		}).pipe(Effect.provide(SaveCodecLive), Effect.provide(NodeServices.layer)),
);

it.effect(
	"malformed XML, unsupported versions, bad shape and broken zlib have typed errors",
	() =>
		Effect.gen(function* () {
			const codec = yield* SaveCodec;
			for (const [text, stage] of [
				["<SaveGame><player></SaveGame>", "xml"],
				["<SaveGame><gameVersion>1.6.8</gameVersion></SaveGame>", "shape"],
			] as const) {
				const result = yield* codec
					.decode(new TextEncoder().encode(text))
					.pipe(Effect.flip);
				expect(result._tag).toBe("SaveReadError");
				expect(result.stage).toBe(stage);
			}
			const compressed = yield* codec
				.decode(new Uint8Array([120, 1, 2]))
				.pipe(Effect.flip);
			expect(compressed.stage).toBe("decompress");
			const fs = yield* FileSystem.FileSystem;
			const wrongVersion = yield* codec.decode(yield* fs.readFile(fixturePath));
			Object.assign(wrongVersion.SaveGame, { gameVersion: "1.7.0" });
			const unsupported = yield* codec
				.decode(yield* codec.encode(wrongVersion))
				.pipe(Effect.flip);
			expect(unsupported.stage).toBe("version");
		}).pipe(Effect.provide(SaveCodecLive), Effect.provide(NodeServices.layer)),
);

it.effect(
	"filesystem and parser services can be replaced without module mocking",
	() =>
		Effect.gen(function* () {
			let decoded = 0;
			const fakeCodec = Layer.succeed(SaveCodec, {
				decode: () =>
					Effect.sync(() => {
						decoded++;
					}).pipe(
						Effect.andThen(
							Effect.fail(
								new SaveReadError({ stage: "xml", cause: "injected" }),
							),
						),
					),
				encode: () => Effect.die("must not encode failed input"),
			});
			const fs = FileSystem.layerNoop({
				readFile: () => Effect.succeed(new Uint8Array()),
			});
			const error = yield* editFile("virtual-save", []).pipe(
				Effect.provide(fakeCodec),
				Effect.provide(fs),
				Effect.flip,
			);
			expect(error._tag).toBe("SaveReadError");
			expect(decoded).toBe(1);
		}),
);

it.effect("Node temporary output is removed when the scope closes", () =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Effect.scoped(
			Effect.gen(function* () {
				const output = yield* fs.makeTempFileScoped({
					prefix: "stardew-v2-test-",
				});
				yield* fs.writeFileString(output, "temporary");
				expect(yield* fs.exists(output)).toBe(true);
				return output;
			}),
		);
		expect(yield* fs.exists(path)).toBe(false);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("interrupting an import releases acquired parser resources", () =>
	Effect.gen(function* () {
		const acquired = yield* Deferred.make<void>();
		let live = 0;
		const fakeCodec = Layer.succeed(SaveCodec, {
			decode: () =>
				Effect.scoped(
					Effect.gen(function* () {
						yield* Effect.acquireRelease(
							Effect.sync(() => {
								live++;
							}),
							() =>
								Effect.sync(() => {
									live--;
								}),
						);
						yield* Deferred.succeed(acquired, undefined);
						return yield* Effect.never;
					}),
				),
			encode: () => Effect.die("unreachable"),
		});
		const fs = FileSystem.layerNoop({
			readFile: () => Effect.succeed(new Uint8Array()),
		});
		const fiber = yield* Effect.forkScoped(
			editFile("virtual-save", []).pipe(
				Effect.provide(fakeCodec),
				Effect.provide(fs),
			),
		);
		yield* Deferred.await(acquired);
		expect(live).toBe(1);
		yield* Fiber.interrupt(fiber);
		expect(live).toBe(0);
		expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true);
	}),
);

it.effect(
	"real XML workers parse and serialize the full fixture and are terminated",
	() =>
		Effect.gen(function* () {
			let live = 0;
			let acquired = 0;
			const layer = workerCodecLayer((delta) => {
				live += delta;
				if (delta > 0) acquired++;
			});
			const fs = yield* FileSystem.FileSystem;
			const bytes = yield* fs.readFile(fixturePath);
			yield* Effect.gen(function* () {
				const codec = yield* SaveCodec;
				const document = yield* codec.decode(bytes);
				expect(live).toBe(0);
				const encoded = yield* codec.encode(document);
				expect(yield* codec.decode(encoded)).toEqual(document);
				const error = yield* codec
					.decode(new TextEncoder().encode("<broken>"))
					.pipe(Effect.flip);
				expect(error.stage).toBe("xml");
			}).pipe(Effect.provide(layer));
			expect(acquired).toBe(4);
			expect(live).toBe(0);
		}).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("ten canceled real worker requests release every worker", () =>
	Effect.gen(function* () {
		let live = 0;
		let acquired = 0;
		for (let index = 0; index < 10; index++) {
			const ready = yield* Deferred.make<void>();
			const layer = workerCodecLayer((delta) => {
				live += delta;
				if (delta > 0) {
					acquired++;
					Effect.runSync(Deferred.succeed(ready, undefined));
				}
			});
			const work = Effect.gen(function* () {
				const codec = yield* SaveCodec;
				return yield* codec.decode(new TextEncoder().encode("<SaveGame />"));
			}).pipe(Effect.provide(layer));
			const fiber = yield* Effect.forkScoped(work);
			yield* Deferred.await(ready);
			yield* Fiber.interrupt(fiber);
			expect(live).toBe(0);
		}
		expect(acquired).toBe(10);
	}),
);
