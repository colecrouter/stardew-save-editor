import { Deferred, Effect, Exit } from "effect";
import { get } from "svelte/store";
import { expect, it, vi } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history";
import { makeEditorModel } from "../../src/lib/editor/editor-model";
import { SaveCodec, SaveCodecLive } from "../../src/lib/editor/save-service";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { setFarmSettings } from "../../src/lib/editor/farm-operations";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "../../src/lib/editor/transaction-annotations";
import { fixtureXml, parser, tinyFixture } from "./fixtures";

const fullHistoryCopies = (calls: unknown[][]) =>
	calls.filter(
		([value]) =>
			value &&
			typeof value === "object" &&
			"baseline" in value &&
			"document" in value,
	);

it("publishes detached immutable review data without copying full History for the model", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(parser.parse(fixtureXml));
				const model = yield* makeEditorModel(session, yield* SaveCodec);
				const spy = vi.spyOn(globalThis, "structuredClone");
				try {
					const result = yield* Effect.promise(() =>
						model.commands.transact(
							Effect.gen(function* () {
								const draft = yield* TransactionDraft;
								const snapshot = yield* draft.read;
								Object.assign(snapshot.state.document.SaveGame, {
									opaque: { children: ["kept"] },
								});
								yield* draft.replace(snapshot);
								yield* recordAnnotatedOperation(Effect.void).pipe(
									withReviewMetadata({
										label: "Opaque change",
										tags: ["test"],
									}),
								);
							}),
						),
					);
					expect(result).not.toBeNull();
					expect(fullHistoryCopies(spy.mock.calls)).toHaveLength(0);
					const view = get(model.view);
					if (!view) throw new Error("Missing projected view");
					const patch = view.net.find(
						(patch) => patch.path === "/SaveGame/opaque",
					);
					if (!patch || patch.op === "remove")
						throw new Error("Missing review payload");
					const payload = patch.value;
					if (!payload || typeof payload !== "object")
						throw new Error("Missing object payload");
					expect(() =>
						Object.assign(payload, { children: ["UI mutation"] }),
					).toThrow();
					// A borrowed-source probe returns only booleans. UI freezing must never
					// freeze or retain the corresponding saved patch/annotation references.
					const isolation = yield* session.forProjection((state) => {
						const saved = state.net.find(
							(patch) => patch.path === "/SaveGame/opaque",
						);
						return {
							netShared: Object.is(state.net, view.net),
							payloadShared:
								saved &&
								saved.op !== "remove" &&
								Object.is(saved.value, payload),
							payloadFrozen:
								saved && saved.op !== "remove" && Object.isFrozen(saved.value),
							annotationsShared: Object.is(
								state.entries[0]?.annotations,
								view.entries[0]?.annotations,
							),
						};
					}).snapshot;
					expect(isolation).toEqual({
						netShared: false,
						payloadShared: false,
						payloadFrozen: false,
						annotationsShared: false,
					});
					// The ordinary engine contract is still a mutable detached snapshot.
					const publicState = yield* session.snapshot;
					publicState.document.SaveGame.player.farmName = "Public mutation";
					publicState.entries.length = 0;
					expect(
						(yield* session.snapshot).document.SaveGame.player.farmName,
					).toBe(view.farm.name);
					expect(get(model.view)).toBe(view);
				} finally {
					spy.mockRestore();
				}
			}),
		).pipe(Effect.provide(SaveCodecLive)),
	));

it("publishes only successful retry results and preserves the competing revision", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(parser.parse(fixtureXml));
				const model = yield* makeEditorModel(session, yield* SaveCodec);
				const initial = get(model.view)?.farm.name;
				const seen: { revision: number; name: string }[] = [];
				const stop = model.view.subscribe((view) => {
					if (view)
						seen.push({ revision: view.revision, name: view.farm.name });
				});
				try {
					const entered = yield* Deferred.make<void>();
					const release = yield* Deferred.make<void>();
					let attempts = 0;
					const pending = model.commands.transact(
						Effect.gen(function* () {
							attempts++;
							yield* setFarmSettings({ name: "Successful retry" });
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(release);
							return "receipt";
						}),
					);
					yield* Deferred.await(entered);
					// The first attempt has staged a name, but that uncommitted projection
					// must not enter Atom or its cache while another writer wins the revision.
					expect(get(model.view)?.farm.name).toBe(initial);
					yield* session.execute([
						{
							type: "money",
							farmerId: String(
								(yield* session.snapshot).document.SaveGame.player
									.UniqueMultiplayerID,
							),
							value: 99,
						},
					]);
					// Let the independent stream display the competing revision before
					// releasing the retry; later publication may otherwise supersede it.
					yield* Effect.promise(() =>
						vi.waitFor(() => expect(get(model.view)?.revision).toBe(1)),
					);
					yield* Deferred.succeed(release, undefined);
					const result = yield* Effect.promise(() => pending);
					expect(result).not.toBeNull();
					expect(attempts).toBeGreaterThanOrEqual(2);
					expect(seen.map((value) => value.revision)).toEqual([0, 1, 2]);
					expect(seen[1]?.name).toBe(initial);
					expect(seen[2]?.name).toBe("Successful retry");
					expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
						99,
					);
				} finally {
					stop();
				}
			}),
		).pipe(Effect.provide(SaveCodecLive)),
	));

it("projects captured results and treats projection defects separately from committed writes", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				const projected = session.forProjection((state) => ({
					revision: state.revision,
					name: state.document.SaveGame.player.farmName,
				}));
				const receipt = yield* projected.execute([
					{ type: "farm-name", value: "Captured" },
				]);
				yield* session.undo;
				expect(receipt).toEqual({ revision: 1, name: "Captured" });
				expect((yield* projected.snapshot).name).toBe("Farm");
				const broken = session.forProjection(() => {
					throw new Error("Projection defect");
				});
				const failed = yield* Effect.exit(
					broken.execute([{ type: "farm-name", value: "Committed" }]),
				);
				expect(Exit.isFailure(failed)).toBe(true);
				// With no enclosing transaction, delivery failure happens after the command
				// commits. It cannot claim rollback; a fresh snapshot still recovers the save.
				expect(
					(yield* session.snapshot).document.SaveGame.player.farmName,
				).toBe("Committed");
			}),
		),
	));
