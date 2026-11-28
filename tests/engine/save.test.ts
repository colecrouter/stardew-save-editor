import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, FileSystem, Layer } from "effect";
import { deflate } from "pako";

import { farmers } from "../../src/lib/editor/domain.ts";
import { SaveCodec, SaveCodecLive, SaveReadError } from "../../src/lib/editor/save-service.ts";
import { isRecord } from "../../src/lib/unknown.ts";
import { parseXmlObject } from "../../src/lib/xmlObject.ts";
import { makeEffectSession } from "./effect.ts";
import { scenarios } from "./fixture.ts";
import { editFile } from "./platform.ts";
import { workerCodecLayer } from "./worker-service.ts";

const fixturePath = fileURLToPath(new URL("../../tests/TestSave", import.meta.url));

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
      expect(farmers(state.document).every((farmer) => farmer.farmName === "Experiment Farm")).toBe(
        true,
      );
      // Encoding strips synthetic equipment attributes on a copy, not on the session.
      expect(yield* session.snapshot).toEqual(state);
    }).pipe(Effect.provide(Layer.merge(SaveCodecLive, NodeServices.layer))),
);

// Parsed XML elements with children are records; anything else is a test failure.
const element = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected an XML element with children");
  return value;
};
// The child element names of one parsed XML record, in first-occurrence order.
// Attributes and text are not elements, so they do not take part in ordering.
const childOrder = (value: unknown): string[] =>
  Object.keys(element(value)).filter((key) => !key.startsWith("@_") && key !== "#text");

it.effect("export keeps the game's element order so order-dependent setters load correctly", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const codec = yield* SaveCodec;
    const bytes = yield* fs.readFile(fixturePath);
    const original = yield* codec.decode(bytes);
    // Farmer._money writes into the wallet that useSeparateWallets selects.
    // With separate wallets on, the game must read the flag before money, or
    // the gold lands in the shared wallet and the farmer gets a new 500g one.
    original.SaveGame.player.useSeparateWallets = true;
    original.SaveGame.player.money = 123_456;
    const encoded = yield* codec.encode(original);
    const decoder = new TextDecoder();
    const game = element(parseXmlObject(decoder.decode(bytes))["SaveGame"]);
    const exported = element(parseXmlObject(decoder.decode(encoded))["SaveGame"]);
    const player = childOrder(exported["player"]);
    const walletFlag = player.indexOf("useSeparateWallets");
    const money = player.indexOf("money");
    // Both elements must be written. indexOf returns -1 for a missing one,
    // which would satisfy the order check below without proving anything.
    expect(walletFlag).toBeGreaterThanOrEqual(0);
    expect(money).toBeGreaterThanOrEqual(0);
    expect(walletFlag).toBeLessThan(money);
    // The fixture was written by the game itself, so its order is the
    // reference. Compare only names both files contain: the codec follows a
    // newer game version, which may add or remove members.
    for (const [label, gameRecord, exportedRecord] of [
      ["SaveGame", game, exported],
      ["player", game["player"], exported["player"]],
    ] as const) {
      const expected = childOrder(gameRecord);
      const actual = childOrder(exportedRecord);
      expect(
        actual.filter((name) => expected.includes(name)),
        label,
      ).toEqual(expected.filter((name) => actual.includes(name)));
    }
  }).pipe(Effect.provide(Layer.merge(SaveCodecLive, NodeServices.layer))),
);

it.effect("compressed input and unknown fields survive the production codec", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const codec = yield* SaveCodec;
    const bytes = yield* fs.readFile(fixturePath);
    const original = yield* codec.decode(bytes);
    expect(yield* codec.decode(deflate(bytes))).toEqual(original);
    // Unknown arrays need save-specific recognition; use an opaque object here.
    Object.assign(original.SaveGame, {
      customModField: { opaque: "007", nested: { flag: "text" } },
    });
    expect(yield* codec.decode(yield* codec.encode(original))).toEqual(original);
  }).pipe(Effect.provide(Layer.merge(SaveCodecLive, NodeServices.layer))),
);

it.effect("malformed XML, unsupported versions, bad shape and broken zlib have typed errors", () =>
  Effect.gen(function* () {
    const codec = yield* SaveCodec;
    for (const [text, stage] of [
      ["<SaveGame><player></SaveGame>", "xml"],
      ["<SaveGame><gameVersion>1.6.8</gameVersion></SaveGame>", "shape"],
    ] as const) {
      const result = yield* codec.decode(new TextEncoder().encode(text)).pipe(Effect.flip);
      expect(result._tag).toBe("SaveReadError");
      expect(result.stage).toBe(stage);
    }
    const compressed = yield* codec.decode(new Uint8Array([120, 1, 2])).pipe(Effect.flip);
    expect(compressed.stage).toBe("decompress");
    const fs = yield* FileSystem.FileSystem;
    const wrongVersion = yield* codec.decode(yield* fs.readFile(fixturePath));
    Object.assign(wrongVersion.SaveGame, { gameVersion: "1.7.0" });
    const unsupported = yield* codec.decode(yield* codec.encode(wrongVersion)).pipe(Effect.flip);
    expect(unsupported.stage).toBe("version");
  }).pipe(Effect.provide(Layer.merge(SaveCodecLive, NodeServices.layer))),
);

it.effect("filesystem and parser services can be replaced without module mocking", () =>
  Effect.gen(function* () {
    let decoded = 0;
    const fakeCodec = Layer.succeed(SaveCodec, {
      decode: () =>
        Effect.sync(() => {
          decoded++;
        }).pipe(
          Effect.andThen(Effect.fail(new SaveReadError({ stage: "xml", cause: "injected" }))),
        ),
      encode: () => Effect.die("must not encode failed input"),
    });
    const fs = FileSystem.layerNoop({
      readFile: () => Effect.succeed(new Uint8Array()),
    });
    const error = yield* editFile("virtual-save", []).pipe(
      Effect.provide(Layer.merge(fakeCodec, fs)),
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
      editFile("virtual-save", []).pipe(Effect.provide(Layer.merge(fakeCodec, fs))),
    );
    yield* Deferred.await(acquired);
    expect(live).toBe(1);
    yield* Fiber.interrupt(fiber);
    expect(live).toBe(0);
    expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true);
  }),
);

it.effect("real XML workers parse and serialize the full fixture and are terminated", () =>
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
      const error = yield* codec.decode(new TextEncoder().encode("<broken>")).pipe(Effect.flip);
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
      // Each iteration awaits interruption before the next worker starts. These
      // shared counters intentionally observe lifetime changes across iterations.
      // oxlint-disable-next-line no-loop-func -- The callback tracks shared worker counts, not the loop index.
      const layer = workerCodecLayer((delta) => {
        live += delta;
        if (delta > 0) {
          acquired++;
          Deferred.doneUnsafe(ready, Effect.void);
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
