import { Effect, JsonPatch } from "effect";
import { expect, it } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	EditorOperations,
	coreOperations,
} from "../../src/lib/editor/operations";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "./fixtures";

it("isolates retained adapter drafts and public patches while preserving exact nested Undo/Redo", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				// A custom preparer can retain its output, including nested newly inserted
				// values. Publication must own those values rather than trusting the adapter.
				let retained: SessionState | undefined;
				const inserted = { children: ["kept"] };
				const session = yield* makeHistorySession(tinyFixture()).pipe(
					Effect.provideService(EditorOperations, {
						prepare: (state, action) =>
							coreOperations.prepare(state, action).pipe(
								Effect.map((prepared) => {
									Object.assign(prepared.document.SaveGame, {
										opaque: inserted,
									});
									retained = prepared;
									return prepared;
								}),
							),
					}),
				);
				const before = yield* session.snapshot;
				const committed = yield* session.execute([
					{ type: "farm-name", value: "Changed" },
				]);
				const expected = structuredClone(committed.document);
				if (!retained) throw new Error("Adapter did not run");
				inserted.children[0] = "leaked";
				retained.document.SaveGame.player.items.Item.length = 0;
				// Public documents, history entries and net-review payloads are detached
				// from the engine, even where those values share branches internally.
				committed.document.SaveGame.player.farmName = "Public mutation";
				for (const patch of committed.net) {
					if (patch.op !== "remove" && patch.path === "/SaveGame/opaque") {
						Object.assign(patch.value as object, {
							children: ["Public patch mutation"],
						});
					}
				}
				committed.entries.length = 0;
				const current = yield* session.snapshot;
				expect(current.document).toEqual(expected);
				expect(current.net).toEqual(
					JsonPatch.get(before.document as never, expected as never),
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				expect((yield* session.snapshot).net).toEqual([]);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(expected);
			}),
		),
	));
