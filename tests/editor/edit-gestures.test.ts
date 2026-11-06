import { describe, expect, it } from "vitest";
import { Deferred, Effect, Fiber, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { MutationError } from "../../src/lib/editor/domain.ts";
import { tinyFixture } from "./fixtures.ts";
import {
	coreOperations,
	EditorOperations,
} from "../../src/lib/editor/operations.ts";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const money = (value: number) =>
	Effect.gen(function* () {
		const draft = yield* TransactionDraft;
		const snapshot = yield* draft.read;
		snapshot.state.document.SaveGame.player.money = value;
		yield* draft.replace(snapshot);
	});

describe("atomic editing gestures", () => {
	it("publishes every valid value but groups one complete undo and redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				const original = yield* session.snapshot;
				for (const value of [11, 12, 13]) {
					yield* session.transact(money(value), undefined, "host:money:1");
					const current = yield* session.snapshot;
					expect(current.document.SaveGame.player.money).toBe(value);
					expect(current.entries).toHaveLength(1);
				}
				const final = yield* session.snapshot;
				yield* session.endEdit("host:money:1");
				expect((yield* session.snapshot).revision).toBe(final.revision);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(final.document);
			}),
		));
	it("returning to the original value restores the previous redo tail", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				yield* session.transact(money(20));
				yield* session.undo;
				const before = yield* session.snapshot;
				yield* session.transact(money(11), undefined, "name");
				yield* session.transact(money(12), undefined, "name");
				yield* session.transact(money(10), undefined, "name");
				const after = yield* session.snapshot;
				expect(after.document).toEqual(before.document);
				expect(after.entries).toEqual(before.entries);
				expect(after.cursor).toBe(before.cursor);
				expect(after.revision).toBeGreaterThan(before.revision);
				yield* session.redo;
				expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
					20,
				);
			}),
		));
	it("a standalone rejection closes the old group but a field rejection does not", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				yield* session.transact(money(11), undefined, "same-focus");
				const rejected = yield* Effect.result(
					session.transact(
						Effect.fail(new MutationError("bad field")),
						undefined,
						"same-focus",
					),
				);
				expect(Result.isFailure(rejected)).toBe(true);
				yield* session.transact(money(12), undefined, "same-focus");
				expect((yield* session.snapshot).entries).toHaveLength(1);
				yield* Effect.result(
					session.transact(Effect.fail(new MutationError("different action"))),
				);
				yield* session.transact(money(13), undefined, "same-focus");
				expect((yield* session.snapshot).entries).toHaveLength(2);
				yield* session.undo;
				expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
					12,
				);
			}),
		));
	it.each(["rejected", "unchanged"])(
		"a different field's %s attempt ends the previous group",
		(mode) =>
			run(
				Effect.gen(function* () {
					const session = yield* makeHistorySession(tinyFixture());
					yield* session.transact(money(11), undefined, "A");
					const other =
						mode === "rejected"
							? Effect.fail(new MutationError("Rejected B"))
							: money(11);
					yield* Effect.result(session.transact(other, undefined, "B"));
					yield* session.transact(money(12), undefined, "A");
					expect((yield* session.snapshot).entries).toHaveLength(2);
					yield* session.undo;
					expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
						11,
					);
				}),
			),
	);
	it("a stale blur cannot close another field and no-op edits preserve redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				yield* session.transact(money(11), undefined, "first");
				yield* session.transact(money(12), undefined, "second");
				yield* session.endEdit("first");
				yield* session.transact(money(13), undefined, "second");
				expect((yield* session.snapshot).entries).toHaveLength(2);
				yield* session.undo;
				const before = yield* session.snapshot;
				yield* session.transact(money(11), undefined, "new-noop");
				const after = yield* session.snapshot;
				expect(after).toEqual(before);
			}),
		));
	it("recomputes one entry under retention limits instead of evicting on every keystroke", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture(), {
					entries: 1,
				});
				yield* session.transact(money(11));
				for (const value of [12, 13, 14])
					yield* session.transact(money(value), undefined, "typing");
				const current = yield* session.snapshot;
				expect(current.entries).toHaveLength(1);
				expect(current.dropped).toBe(1);
				expect(current.retainedBytes).toBe(current.entries[0]?.bytes);
				yield* session.undo;
				expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
					11,
				);
			}),
		));
});

it("rejects an oversized extension without losing the last valid grouped edit", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), { bytes: 4000 });
			const name = (value: string) =>
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					snapshot.state.document.SaveGame.player.farmName = value;
					yield* draft.replace(snapshot);
				});
			yield* session.transact(name("A"), undefined, "farm-name");
			const valid = yield* session.snapshot;
			const oversized = yield* Effect.result(
				session.transact(name("x".repeat(10000)), undefined, "farm-name"),
			);
			expect(Result.isFailure(oversized)).toBe(true);
			expect(yield* session.snapshot).toEqual(valid);
			yield* session.transact(name("B"), undefined, "farm-name");
			expect((yield* session.snapshot).entries).toHaveLength(1);
			yield* session.undo;
			expect((yield* session.snapshot).document.SaveGame.player.farmName).toBe(
				"Farm",
			);
		}),
	));

it("groups field commands while shared farmer selection and export create explicit boundaries", async () => {
	const { openEditor } = await import("../../src/lib/editor/editor-model.ts");
	const { setCharacter } =
		await import("../../src/lib/editor/character-operations.ts");
	const { get } = await import("svelte/store");
	const { parser, fixtureXml, exportDocument } = await import("./fixtures.ts");
	const document = parser.parse(fixtureXml);
	const hostId = String(document.SaveGame.player.UniqueMultiplayerID);
	const guest = structuredClone(document.SaveGame.player);
	guest.UniqueMultiplayerID = "gesture-guest";
	guest.name = "Gesture guest";
	document.SaveGame.farmhands = { Farmer: [guest] };
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
		{},
		{ validateExport: false },
	);
	const model = opened.model;
	const gesture = model.edits.begin(`${hostId}:farming-xp`);
	const xp = (value: number) =>
		setCharacter({
			farmerId: hostId,
			kind: "skill-xp",
			skill: "farming",
			value,
		});
	try {
		const original = await model.snapshot();
		expect(get(model.selectedFarmerId)).toBe(hostId);
		await model.commands.edit(xp(380), gesture);
		await model.commands.edit(xp(770), gesture);
		expect((await model.snapshot()).entries).toHaveLength(1);
		await model.commands.selectFarmer("gesture-guest");
		expect(get(model.selectedFarmerId)).toBe("gesture-guest");
		await model.commands.edit(xp(1300), gesture);
		expect((await model.snapshot()).entries).toHaveLength(2);
		await model.commands.export();
		await model.commands.edit(xp(2150), gesture);
		expect((await model.snapshot()).entries).toHaveLength(3);
		await model.commands.undo();
		await model.commands.undo();
		await model.commands.undo();
		expect((await model.snapshot()).document).toEqual(original.document);
		expect(get(model.selectedFarmerId)).toBe("gesture-guest");
		const invalid = await model.commands.selectFarmer("missing-farmer");
		expect(invalid && Result.isFailure(invalid)).toBe(true);
		expect(get(model.selectedFarmerId)).toBe("gesture-guest");
		const forged = await model.commands.edit(xp(380), {
			fieldKey: gesture.fieldKey,
		});
		expect(forged && Result.isFailure(forged)).toBe(true);
	} finally {
		await opened.close();
	}
	// Teardown is normal even if a mounted field outlives its file provider briefly.
	expect(await model.edits.end(gesture)).toBeNull();
	expect(get(model.selectedFarmerId)).toBeUndefined();
}, 25_000);

it("closes a concurrently restored gesture when a lower-level standalone transaction retries", () =>
	run(
		Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const session = yield* makeHistorySession(tinyFixture()).pipe(
				Effect.provideService(EditorOperations, {
					prepare: (state, action) =>
						Effect.gen(function* () {
							// Suspend actual preparation after update's outer gesture boundary. A field
							// can commit during that suspension, forcing this transaction to re-read state.
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(release);
							return yield* coreOperations.prepare(state, action);
						}),
				}),
			);
			yield* session.transact(money(11), undefined, "A");
			const standalone = yield* Effect.forkScoped(
				session.execute([{ type: "money", farmerId: "host", value: 20 }]),
			);
			yield* Deferred.await(entered);
			yield* session.transact(money(12), undefined, "A");
			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(standalone);
			expect((yield* session.snapshot).entries).toHaveLength(3);
			yield* session.transact(money(13), undefined, "A");
			expect((yield* session.snapshot).entries).toHaveLength(4);
			// Undo must restore the standalone value, never rewind through its committed
			// change by reusing the field's older pre-action grouping baseline.
			yield* session.undo;
			expect((yield* session.snapshot).document.SaveGame.player.money).toBe(20);
			yield* session.redo;
			expect((yield* session.snapshot).document.SaveGame.player.money).toBe(13);
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).document.SaveGame.player.money).toBe(12);
		}),
	));
