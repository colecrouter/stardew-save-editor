import { Effect } from "effect";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { toEventId } from "../../src/lib/eventId.ts";
import {
	readEvents,
	setEventSeen,
	type EventChange,
} from "../../src/lib/editor/event-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	tinyFixture,
	parser,
	exportDocument,
} from "../helpers/editor-document.ts";

function fixture(events: unknown = [1, "Mod.Event"]) {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, { eventsSeen: events });
	const guest = document.SaveGame.farmhands && document.SaveGame.farmhands[0];
	if (guest) Object.assign(guest, { eventsSeen: ["2"] });
	return document;
}
const change = (id: string, seen: boolean): EventChange => ({
	farmerId: "1",
	id,
	seen,
});

describe("event save operations", () => {
	it("projects without normalizing imported duplicate, opaque or invalid members", () => {
		const document = fixture([
			1,
			"1",
			"Mod.Event",
			"bad/id",
			{ opaque: "keep" },
			true,
			9007199254740992,
		]);
		Object.assign(document.SaveGame.player, {
			testMetadataeventsSeen: { meta: "007" },
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
	it.effect(
		"updates membership atomically preserving siblings, metadata and exact Undo/Redo",
		() =>
			Effect.gen(function* () {
				const document = fixture([1, "Mod.Event", { opaque: "keep" }]);
				Object.assign(document.SaveGame.player, {
					testMetadataeventsSeen: { meta: "007" },
				});
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(setEventSeen(change("02", true)));
				const added = yield* session.snapshot;
				expect(added.document.SaveGame.player).toMatchObject({
					eventsSeen: [1, "Mod.Event", { opaque: "keep" }, "2"],
					testMetadataeventsSeen: { meta: "007" },
				});
				yield* session.transact(setEventSeen(change("1", false)));
				const removed = yield* session.snapshot;
				expect(removed.document.SaveGame.player).toMatchObject({
					eventsSeen: ["Mod.Event", { opaque: "keep" }, "2"],
					testMetadataeventsSeen: { meta: "007" },
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(added.document);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(removed.document);
			}),
	);
	it.effect(
		"keeps singleton and empty lists unchanged on read and creates no-op history",
		() =>
			Effect.gen(function* () {
				for (const input of [[], [1]]) {
					const document = fixture(input);
					const before = structuredClone(document);
					readEvents(document);
					expect(document).toEqual(before);
					const session = yield* makeHistorySession(document);
					if (input.length) {
						yield* session.transact(setEventSeen(change("1", true)));
						expect((yield* session.snapshot).entries).toHaveLength(0);
						yield* session.transact(setEventSeen(change("1", false)));
						expect(
							(yield* session.snapshot).document.SaveGame.player,
						).toMatchObject({ eventsSeen: [] });
					} else {
						yield* session.transact(setEventSeen(change("Absent.Mod", false)));
						expect((yield* session.snapshot).entries).toHaveLength(0);
						yield* session.transact(setEventSeen(change("7", true)));
						expect(
							(yield* session.snapshot).document.SaveGame.player,
						).toMatchObject({ eventsSeen: ["7"] });
					}
				}
			}),
	);
	it.effect(
		"rejects an omitted event list while preserving unrelated entries",
		() =>
			Effect.gen(function* () {
				const missing = fixture();
				delete missing.SaveGame.player.eventsSeen;
				const missingSession = yield* makeHistorySession(missing);
				const before = yield* missingSession.snapshot;
				const result = yield* Effect.result(
					missingSession.transact(setEventSeen(change("3", true))),
				);
				expect(result._tag).toBe("Failure");
				expect((yield* missingSession.snapshot).document).toEqual(
					before.document,
				);
				const session = yield* makeHistorySession(
					fixture([{ opaque: "keep" }, 1]),
				);
				yield* session.transact(setEventSeen(change("3", true)));
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ eventsSeen: [{ opaque: "keep" }, 1, "3"] });
			}),
	);
	it.effect(
		"rejects duplicate targets, invalid requests and ambiguous farmers without partial publication",
		() =>
			Effect.gen(function* () {
				for (const request of [
					change("1", false),
					change("true", true),
					change("false", true),
					change("a/b", true),
					change("01", false),
					{ ...change("3", true), extra: "bad" },
				]) {
					const session = yield* makeHistorySession(fixture([1, "1"]));
					const before = yield* session.snapshot;
					const result = yield* Effect.result(
						session.transact(setEventSeen(request)),
					);
					expect(result._tag).toBe("Failure");
					expect((yield* session.snapshot).document).toEqual(before.document);
				}
				const document = fixture();
				const guest =
					document.SaveGame.farmhands && document.SaveGame.farmhands[0];
				if (!guest) throw Error("Missing guest");
				guest.UniqueMultiplayerID = 1n;
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(setEventSeen(change("3", true))),
				);
				expect(result._tag).toBe("Failure");
				expect((yield* session.snapshot).document).toEqual(before.document);
			}),
	);
	it.effect(
		"preserves the captured farmer and does not apply event rewards or other fields",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				yield* session.transact(
					setEventSeen({ farmerId: "2", id: "3", seen: true }),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toEqual(
					before.document.SaveGame.player,
				);
				expect(
					readEvents(after.document)
						.find((view) => view.farmerId === "2")
						?.seen.map((row) => row.id),
				).toEqual(["2", "3"]);
			}),
	);
	it.effect(
		"roundtrips supported typed IDs through the production XML codec without changing identities",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture([]));
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
		30_000,
	);
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

it.effect(
	"keeps imported leading-zero spellings distinct from deliberately added canonical IDs",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture(["007", "Mod.Event"]));
			const before = yield* session.snapshot;
			expect(
				readEvents(before.document)[0]?.seen.find((row) => row.id === "007")
					?.supported,
			).toBe(false);
			yield* session.transact(setEventSeen(change("7", true)));
			expect((yield* session.snapshot).document.SaveGame.player).toMatchObject({
				eventsSeen: ["007", "Mod.Event", "7"],
			});
			const failure = yield* Effect.result(
				session.transact(setEventSeen(change("007", false))),
			);
			expect(failure._tag).toBe("Failure");
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);
