import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import {
	readRelationships,
	setRelationship,
} from "../../src/lib/editor/relationship-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "./fixtures.ts";

function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		friendshipData: {
			opaque: "007",
			item: [
				{
					key: { string: "Abigail" },
					value: {
						Friendship: {
							Points: 100,
							Status: "Friendly",
							GiftsToday: 1,
							opaque: false,
						},
						opaque: "keep",
					},
				},
				{
					key: { string: "Modded" },
					value: {
						Friendship: {
							Points: 10,
							GiftsThisWeek: 2,
							Status: "Married",
							opaque: "mod",
						},
					},
				},
				{ opaque: ["001", false] },
			],
		},
	});
	return document;
}
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
describe("relationship domain operations", () => {
	it("projects without defaults or normalization and retains modded villagers", () => {
		const document = fixture(),
			before = structuredClone(document);
		const rows = readRelationships(document)[0]?.relationships;
		expect(rows?.map((row) => row.name)).toEqual(["Abigail", "Modded"]);
		expect(rows?.[0]).toMatchObject({
			gifts: 0,
			maxHearts: 8,
			maxPoints: 2249,
		});
		expect(rows?.[1]?.maxHearts).toBe(10);
		expect(document).toEqual(before);
	});
	it("writes only one selected property and restores exact XML-shaped state through Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setRelationship({
						farmerId: "host",
						name: "Abigail",
						kind: "gifts",
						value: 3,
					}),
				);
				const after = yield* session.snapshot;
				const expected = fixture();
				const raw = expected.SaveGame.player as unknown as {
					friendshipData: {
						item: { value?: { Friendship?: Record<string, unknown> } }[];
					};
				};
				const friendship = raw.friendshipData.item[0]?.value?.Friendship;
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
						farmerId: "host",
						name: "Abigail",
						kind: "points" as const,
						value: 2250,
					},
					{
						farmerId: "host",
						name: "Abigail",
						kind: "gifts" as const,
						value: 8,
					},
					{
						farmerId: "host",
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
	it("adds missing vanilla villagers once while preserving existing opaque and modded records", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				const session = yield* makeHistorySession(document);
				const before = readRelationships(document)[0];
				yield* session.transact(
					setRelationship({ farmerId: "host", kind: "add-missing" }),
				);
				const after = yield* session.snapshot;
				expect(readRelationships(after.document)[0]?.missingCount).toBe(0);
				expect(readRelationships(after.document)[0]?.relationships.length).toBe(
					(before?.relationships.length ?? 0) + (before?.missingCount ?? 0),
				);
				yield* session.transact(
					setRelationship({ farmerId: "host", kind: "add-missing" }),
				);
				expect((yield* session.snapshot).entries.length).toBe(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
	it("makes duplicate villager keys read-only rather than choosing an arbitrary entry", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame.player, {
					friendshipData: {
						item: [
							{
								key: { string: "Abigail" },
								value: { Friendship: { Points: 100, Status: "Friendly" } },
							},
							{
								key: { string: "Abigail" },
								value: { Friendship: { Points: 200, Status: "Dating" } },
							},
						],
					},
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
									farmerId: "host",
									name: "Abigail",
									kind: "points",
									value: 50,
								}),
							),
						),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(document);
			}),
		));
});
