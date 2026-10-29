import { Effect, type Scope } from "effect";
import { describe, expect, it } from "vitest";
import { toEventId } from "../../src/lib/eventId.ts";
import {
	readEvents,
	setEventSeen,
	type EventChange,
} from "../../src/lib/editor/event-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture, parser, exportDocument } from "./fixtures.ts";
const run = <E>(effect: Effect.Effect<void, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(effect));
function fixture(events: unknown = { int: [1, "Mod.Event"] }) {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, { eventsSeen: events });
	const guest =
		document.SaveGame.farmhands && document.SaveGame.farmhands.Farmer[0];
	if (guest) Object.assign(guest, { eventsSeen: { int: [2] } });
	return document;
}
const change = (id: string, seen: boolean): EventChange => ({
	farmerId: "host",
	id,
	seen,
});

describe("event save operations", () => {
	it("projects without normalizing imported duplicate, opaque or invalid members", () => {
		const document = fixture({
			meta: "007",
			int: [
				1,
				"1",
				"Mod.Event",
				"bad/id",
				{ opaque: "keep" },
				true,
				9007199254740992,
			],
		});
		const before = structuredClone(document);
		const view = readEvents(document)[0];
		expect(view).toMatchObject({
			supported: true,
			seenCount: 3,
			unsupportedCount: 3,
		});
		expect(view?.seen.find((row) => row.id === "1")?.supported).toBe(false);
		expect(view?.seen.find((row) => row.id === "bad/id")?.supported).toBe(
			false,
		);
		expect(view?.seen.find((row) => row.id === "Mod.Event")?.supported).toBe(
			true,
		);
		expect(document).toEqual(before);
	});
	it("updates membership atomically preserving siblings, metadata and exact Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(
					fixture({ meta: "007", int: [1, "Mod.Event", { opaque: "keep" }] }),
				);
				const before = yield* session.snapshot;
				yield* session.transact(setEventSeen(change("02", true)));
				const added = yield* session.snapshot;
				expect(added.document.SaveGame.player).toMatchObject({
					eventsSeen: {
						meta: "007",
						int: [1, "Mod.Event", { opaque: "keep" }, "2"],
					},
				});
				yield* session.transact(setEventSeen(change("1", false)));
				const removed = yield* session.snapshot;
				expect(removed.document.SaveGame.player).toMatchObject({
					eventsSeen: {
						meta: "007",
						int: ["Mod.Event", { opaque: "keep" }, "2"],
					},
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(added.document);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(removed.document);
			}),
		));
	it("keeps singleton and empty containers unchanged on read and creates no-op history", () =>
		run(
			Effect.gen(function* () {
				for (const input of ["", {}, { meta: "keep", int: 1 }]) {
					const document = fixture(input);
					const before = structuredClone(document);
					readEvents(document);
					expect(document).toEqual(before);
					const session = yield* makeHistorySession(document);
					if (typeof input === "object" && "int" in input) {
						yield* session.transact(setEventSeen(change("1", true)));
						expect((yield* session.snapshot).entries).toHaveLength(0);
						yield* session.transact(setEventSeen(change("1", false)));
						expect(
							(yield* session.snapshot).document.SaveGame.player,
						).toMatchObject({ eventsSeen: { meta: "keep" } });
					} else {
						yield* session.transact(setEventSeen(change("Absent.Mod", false)));
						expect((yield* session.snapshot).entries).toHaveLength(0);
						yield* session.transact(setEventSeen(change("7", true)));
						expect(
							(yield* session.snapshot).document.SaveGame.player,
						).toMatchObject({ eventsSeen: { int: "7" } });
					}
				}
			}),
		));
	it("rejects nil and malformed containers while allowing independent edits beside opaque list entries", () =>
		run(
			Effect.gen(function* () {
				for (const input of [
					null,
					{ "@_xsi:nil": "true" },
					{ int: { opaque: "keep" } },
					false,
				]) {
					const session = yield* makeHistorySession(fixture(input));
					const before = yield* session.snapshot;
					const result = yield* Effect.result(
						session.transact(setEventSeen(change("3", true))),
					);
					expect(result._tag).toBe("Failure");
					expect((yield* session.snapshot).document).toEqual(before.document);
				}
				const session = yield* makeHistorySession(
					fixture({ int: [{ opaque: "keep" }, 1] }),
				);
				yield* session.transact(setEventSeen(change("3", true)));
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ eventsSeen: { int: [{ opaque: "keep" }, 1, "3"] } });
			}),
		));
	it("rejects duplicate targets, invalid requests and ambiguous farmers without partial publication", () =>
		run(
			Effect.gen(function* () {
				for (const request of [
					change("1", false),
					change("true", true),
					change("false", true),
					change("a/b", true),
					change("01", false),
					{ ...change("3", true), extra: "bad" },
				]) {
					const session = yield* makeHistorySession(fixture({ int: [1, "1"] }));
					const before = yield* session.snapshot;
					const result = yield* Effect.result(
						session.transact(setEventSeen(request)),
					);
					expect(result._tag).toBe("Failure");
					expect((yield* session.snapshot).document).toEqual(before.document);
				}
				const document = fixture();
				const guest =
					document.SaveGame.farmhands && document.SaveGame.farmhands.Farmer[0];
				if (!guest) throw Error("Missing guest");
				guest.UniqueMultiplayerID = "host";
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(setEventSeen(change("3", true))),
				);
				expect(result._tag).toBe("Failure");
				expect((yield* session.snapshot).document).toEqual(before.document);
			}),
		));
	it("preserves the captured farmer and does not apply event rewards or other fields", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				yield* session.transact(
					setEventSeen({ farmerId: "guest", id: "3", seen: true }),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toEqual(
					before.document.SaveGame.player,
				);
				expect(
					readEvents(after.document)
						.find((view) => view.farmerId === "guest")
						?.seen.map((row) => row.id),
				).toEqual(["2", "3"]);
			}),
		));
	it("roundtrips supported typed IDs through the production XML codec without changing identities", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture(""));
				const typed = [
					"01",
					"007",
					"-1",
					"1.5",
					"123abc",
					"1e400",
					"NaN",
					"Infinity",
					"Mod.Id_1",
				];
				for (const id of typed)
					yield* session.transact(setEventSeen(change(id, true)));
				const saved = (yield* session.snapshot).document;
				const roundtrip = parser.parse(exportDocument(saved));
				expect(readEvents(roundtrip)[0]?.seen.map((row) => row.id)).toEqual(
					typed.map(toEventId),
				);
				expect(readEvents(roundtrip)[0]?.unsupportedCount).toBe(0);
			}),
		));
	it("validates typed IDs conservatively while keeping exact modded spellings", () => {
		expect(toEventId(" 007 ")).toBe("7");
		for (const id of [
			"true",
			"false",
			"9007199254740992",
			"9007199254740993",
			"1e3",
			"1.0",
			"-0",
			"a b",
			"a/b",
			"",
		])
			expect(toEventId(id), id).toBeUndefined();
		for (const id of ["1e400", "NaN", "Infinity", "Mod.Event", "1.5"])
			expect(toEventId(id), id).toBe(id);
	});
});

it("keeps imported leading-zero spellings distinct from deliberately added canonical IDs", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(
				fixture({ int: ["007", "Mod.Event"] }),
			);
			const before = yield* session.snapshot;
			expect(
				readEvents(before.document)[0]?.seen.find((row) => row.id === "007")
					?.supported,
			).toBe(false);
			yield* session.transact(setEventSeen(change("7", true)));
			expect((yield* session.snapshot).document.SaveGame.player).toMatchObject({
				eventsSeen: { int: ["007", "Mod.Event", "7"] },
			});
			const failure = yield* Effect.result(
				session.transact(setEventSeen(change("007", false))),
			);
			expect(failure._tag).toBe("Failure");
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));
