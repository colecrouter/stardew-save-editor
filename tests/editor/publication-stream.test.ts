import { Effect, Stream } from "effect";
import { get } from "svelte/store";
import { expect, it, vi } from "vitest";
import {
	makeHistorySession,
	type HistoryState,
} from "../../src/lib/editor/history";
import { makeEditorModel } from "../../src/lib/editor/editor-model";
import { SaveCodec, SaveCodecLive } from "../../src/lib/editor/save-service";
import { setFarmSettings } from "../../src/lib/editor/farm-operations";
import { fixtureXml, parser, tinyFixture } from "./fixtures";

it("skips acknowledged snapshots before cloning while ordinary subscribers retain detached changes", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				let acknowledged = 0;
				const filtered: HistoryState[] = [];
				const ordinary: HistoryState[] = [];
				yield* Effect.forkScoped(
					Stream.runForEach(
						session.changesAfter(() => acknowledged),
						(state) =>
							Effect.sync(() => {
								filtered.push(state);
							}),
					),
				);
				yield* Effect.forkScoped(
					Stream.runForEach(session.changes, (state) =>
						Effect.sync(() => {
							ordinary.push(state);
						}),
					),
				);
				yield* Effect.yieldNow;
				expect(filtered).toHaveLength(0);
				expect(ordinary).toHaveLength(1);
				const spy = vi.spyOn(globalThis, "structuredClone");
				try {
					// Advancing the consumer cursor represents direct command publication. Only
					// the unfiltered subscription should copy this revision after the command does.
					const next = yield* session.execute([
						{ type: "farm-name", value: "Acknowledged" },
					]);
					acknowledged = next.revision;
					yield* Effect.yieldNow;
					expect(filtered).toHaveLength(0);
					// The command and ordinary stream each need one copy. The acknowledged
					// stream must not create a third full History snapshot.
					expect(
						spy.mock.calls.filter(
							([value]) =>
								value &&
								typeof value === "object" &&
								"baseline" in value &&
								"document" in value,
						),
					).toHaveLength(2);
					expect(ordinary.at(-1)?.revision).toBe(next.revision);
					const delivered = ordinary.at(-1);
					if (!delivered) throw new Error("No delivered snapshot");
					delivered.document.SaveGame.player.farmName = "Stream mutation";
					delivered.entries.length = 0;
					expect(
						(yield* session.snapshot).document.SaveGame.player.farmName,
					).toBe("Acknowledged");
					// An unseen engine revision must still reach both streams as distinct copies.
					yield* session.execute([{ type: "farm-name", value: "External" }]);
					yield* Effect.yieldNow;
					expect(filtered).toHaveLength(1);
					expect(filtered[0]).not.toBe(ordinary.at(-1));
					const observed = filtered[0];
					if (!observed) throw new Error("No unseen revision delivered");
					observed.document.SaveGame.player.farmName = "Other stream mutation";
					expect(
						(yield* session.snapshot).document.SaveGame.player.farmName,
					).toBe("External");
					// Establish a real active gesture before checking metadata-only blur.
					yield* session.transact(
						setFarmSettings({ name: "Grouped" }),
						undefined,
						"focus",
					);
					yield* Effect.yieldNow;
					// Blur closes private metadata and must not copy an unchanged revision.
					spy.mockClear();
					yield* session.endEdit("focus");
					yield* Effect.yieldNow;
					expect(spy).not.toHaveBeenCalled();
				} finally {
					spy.mockRestore();
				}
			}),
		),
	));

it("keeps separate model cursors and publishes lower-level writes without dropping queued edits", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(parser.parse(fixtureXml));
				const codec = yield* SaveCodec;
				const first = yield* makeEditorModel(session, codec);
				const second = yield* makeEditorModel(session, codec);
				const seen: number[] = [];
				const stop = first.view.subscribe((value) => {
					if (value) seen.push(value.revision);
				});
				try {
					yield* Effect.promise(async () => {
						const gesture = first.edits.begin("farm-name");
						await Promise.all(
							["One", "Two", "Three"].map((name) =>
								first.commands.edit(setFarmSettings({ name }), gesture),
							),
						);
						await first.edits.end(gesture);
						await vi.waitFor(() =>
							expect(get(second.view)?.farm.name).toBe("Three"),
						);
						expect(seen).toEqual([0, 1, 2, 3]);
					});
					// Mutations outside either model's command queue still have to be observed.
					yield* session.execute([{ type: "farm-name", value: "Lower level" }]);
					yield* Effect.promise(() =>
						vi.waitFor(() => {
							expect(get(first.view)?.farm.name).toBe("Lower level");
							expect(get(second.view)?.farm.name).toBe("Lower level");
						}),
					);
					yield* session.undo;
					yield* Effect.promise(() =>
						vi.waitFor(() => expect(get(first.view)?.farm.name).toBe("Three")),
					);
					yield* session.redo;
					yield* Effect.promise(() =>
						vi.waitFor(() =>
							expect(get(second.view)?.farm.name).toBe("Lower level"),
						),
					);
				} finally {
					stop();
				}
			}),
		).pipe(Effect.provide(SaveCodecLive)),
	));
