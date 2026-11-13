import { stringifySavedData } from "../../src/lib/editor/saved-data.ts";
import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import {
	readRelationships,
	setRelationship,
} from "../../src/lib/editor/relationship-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "../helpers/editor-document.ts";

function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		friendshipData: [
			{
				key: "Abigail",
				opaque: ["001", false],
				value: {
					Points: 100,
					Status: "Friendly",
					GiftsToday: 1,
					opaque: false,
					opaqueEntry: "keep",
				},
			},
			{
				key: "Modded",
				value: {
					Points: 10,
					GiftsThisWeek: 2,
					Status: "Married",
					opaque: "mod",
				},
			},
		],
		testMetadatafriendshipData: { opaque: "007" },
	});
	return document;
}
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
describe("relationship domain operations", () => {
	it("refuses insertion into an omitted friendship dictionary without history", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				delete document.SaveGame.player.friendshipData;
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(readRelationships(document)[0]?.supported).toBe(false);
				const result = yield* Effect.result(
					session.transact(
						setRelationship({ farmerId: "1", name: "Alex", kind: "add" }),
					),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it("projects without defaults or normalization and retains modded villagers", () => {
		const document = fixture(),
			before = structuredClone(document);
		const rows = readRelationships(document)[0]?.relationships;
		expect(rows?.filter((row) => row.present).map((row) => row.name)).toEqual([
			"Abigail",
			"Modded",
		]);
		expect(rows?.[0]).toMatchObject({
			gifts: 0,
			maxHearts: 8,
			maxPoints: 2249,
		});
		expect(rows?.[1]?.maxHearts).toBe(10);
		expect(document).toEqual(before);
	});
	it("writes only one selected property and restores exact saved state through Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setRelationship({
						farmerId: "1",
						name: "Abigail",
						kind: "gifts",
						value: 3,
					}),
				);
				const after = yield* session.snapshot;
				const expected = fixture();
				const raw = expected.SaveGame.player as unknown as {
					friendshipData: { value?: Record<string, unknown> }[];
				};
				const friendship = raw.friendshipData[0]?.value;
				if (!friendship) throw Error("Missing fixture relationship");
				friendship.GiftsThisWeek = 3;
				expect(after.document).toEqual(expected);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(expected);
			}),
		));
	it("rejects invalid limits and stale keys atomically", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				for (const input of [
					{
						farmerId: "1",
						name: "Abigail",
						kind: "points" as const,
						value: 2250,
					},
					{
						farmerId: "1",
						name: "Abigail",
						kind: "gifts" as const,
						value: 8,
					},
					{
						farmerId: "1",
						name: "Missing",
						kind: "points" as const,
						value: 100,
					},
				])
					expect(
						Result.isFailure(
							yield* Effect.result(session.transact(setRelationship(input))),
						),
					).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before.document);
				expect((yield* session.snapshot).entries).toEqual([]);
			}),
		));
	it("adds and removes individual villagers in atomic Undoable transactions", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				expect(
					readRelationships(document)[0]?.relationships.find(
						(row) => row.name === "Alex",
					),
				).toMatchObject({ present: false, supported: false });
				yield* session.transact(
					setRelationship({ farmerId: "1", kind: "add", name: "Alex" }),
				);
				const added = yield* session.snapshot;
				expect(added.entries).toHaveLength(1);
				expect(
					readRelationships(added.document)[0]?.relationships.find(
						(row) => row.name === "Alex",
					),
				).toMatchObject({ present: true, supported: true, points: 0 });
				const duplicate = yield* Effect.result(
					session.transact(
						setRelationship({ farmerId: "1", kind: "add", name: "Alex" }),
					),
				);
				expect(Result.isFailure(duplicate)).toBe(true);
				yield* session.transact(
					setRelationship({ farmerId: "1", kind: "remove", name: "Alex" }),
				);
				expect((yield* session.snapshot).document).toEqual(document);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(added.document);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(added.document);
			}),
		));
	it("removes unique modded records while preserving opaque data and restores their exact record with Undo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setRelationship({ farmerId: "1", kind: "remove", name: "Modded" }),
				);
				const after = yield* session.snapshot;
				expect(
					readRelationships(after.document)[0]?.relationships.some(
						(row) => row.name === "Modded",
					),
				).toBe(false);
				expect(stringifySavedData(after.document)).toContain(
					'"opaque":["001",false]',
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
	it("makes duplicate villager keys read-only rather than choosing an arbitrary entry", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame.player, {
					friendshipData: [
						{
							key: "Abigail",
							value: { Points: 100, Status: "Friendly" },
						},
						{
							key: "Abigail",
							value: { Points: 200, Status: "Dating" },
						},
					],
				});
				expect(
					readRelationships(document)[0]?.relationships[0]?.supported,
				).toBe(false);
				const session = yield* makeHistorySession(document);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setRelationship({
									farmerId: "1",
									name: "Abigail",
									kind: "remove",
								}),
							),
						),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
});
