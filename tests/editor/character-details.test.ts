import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations.ts";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
	readCharacterDetails,
	setCharacterDetails,
} from "../../src/lib/editor/character-details.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "./fixtures.ts";

function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		maxHealth: 140,
		health: 90,
		maxStamina: 270,
		stamina: 100,
		qiGems: 4,
		clubCoins: 5,
		houseUpgradeLevel: 1,
		daysUntilHouseUpgrade: 2,
		trashCanLevel: 0,
		toolBeingUpgraded: { itemId: "CopperTrashCan" },
		daysLeftForToolUpgrade: 1,
		mailReceived: {
			string: ["mod.flag", "HasTownKey", "HasTownKey"],
			opaque: "keep",
		},
	});
	return document;
}
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));

describe("character detail edits", () => {
	it("projects without mutation and keeps Clint's trash can locked", () => {
		const document = fixture(),
			baseline = structuredClone(document);
		const view = readCharacterDetails(document, "host");
		expect(view.numbers.find((entry) => entry.key === "trash")?.available).toBe(
			false,
		);
		expect(view.numbers.find((entry) => entry.key === "house-days")?.min).toBe(
			1,
		);
		expect(document).toEqual(baseline);
	});
	it("edits max stats without changing current stats, and undo restores exactly", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					baseline = structuredClone(document);
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setCharacterDetails({ farmerId: "host", key: "health", value: 200 }),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ maxHealth: 200, health: 90 });
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(baseline);
			}),
		));
	it("removes only owned mail flags and preserves opaque members", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				yield* session.transact(
					setCharacterDetails({
						farmerId: "host",
						key: "HasTownKey",
						value: false,
					}),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					mailReceived: { string: ["mod.flag"], opaque: "keep" },
				});
			}),
		));
	it("rejects zero during active construction and cancels with the game sentinel", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const failure = yield* Effect.result(
					session.transact(
						setCharacterDetails({
							farmerId: "host",
							key: "house-days",
							value: 0,
						}),
					),
				);
				expect(failure._tag).toBe("Failure");
				yield* session.transact(
					setCharacterDetails({
						farmerId: "host",
						key: "house-cancel",
						value: true,
					}),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ daysUntilHouseUpgrade: -1 });
			}),
		));
});

it("resizes canonical backpacks with exact Undo/Redo identities and stale handle rejection", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 12,
				items: {
					Item: Array.from({ length: 12 }, () => ({ "@_xsi:nil": "true" })),
				},
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(
				setCharacterDetails({ farmerId: "host", key: "backpack", value: "24" }),
			);
			const expanded = yield* session.snapshot;
			expect(expanded.document.SaveGame.player.items.Item).toHaveLength(24);
			expect(expanded.identities.host?.slice(0, 12)).toEqual(
				before.identities.host,
			);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).identities).toEqual(before.identities);
			yield* session.redo;
			expect((yield* session.snapshot).identities).toEqual(expanded.identities);
			yield* session.transact(
				setCharacterDetails({ farmerId: "host", key: "backpack", value: "12" }),
			);
			expect(
				(yield* session.snapshot).document.SaveGame.player.items.Item,
			).toHaveLength(12);
			yield* session.transact(
				setCharacterDetails({ farmerId: "host", key: "backpack", value: "24" }),
			);
			expect((yield* session.snapshot).identities.host?.[23]).not.toEqual(
				expanded.identities.host?.[23],
			);
		}),
	));
it("never shrinks away an opaque nil marker or item", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 24,
				items: {
					Item: Array.from({ length: 24 }, (_, index) =>
						index === 23
							? { "@_xsi:nil": "true", modData: "keep" }
							: { "@_xsi:nil": "true" },
					),
				},
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const result = yield* Effect.result(
				session.transact(
					setCharacterDetails({
						farmerId: "host",
						key: "backpack",
						value: "12",
					}),
				),
			);
			expect(result._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("rejects a removed slot handle after shrink and regrowth", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 24,
				items: {
					Item: Array.from({ length: 24 }, () => ({ "@_xsi:nil": "true" })),
				},
			});
			const session = yield* makeHistorySession(document);
			const stale = (yield* session.snapshot).identities.host?.[23];
			if (!stale) throw new Error("Missing test handle");
			yield* session.transact(
				setCharacterDetails({ farmerId: "host", key: "backpack", value: "12" }),
			);
			yield* session.transact(
				setCharacterDetails({ farmerId: "host", key: "backpack", value: "24" }),
			);
			const before = yield* session.snapshot;
			const failure = yield* Effect.result(
				session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId: stale,
						property: "stack",
						value: 2,
					}),
				),
			);
			expect(failure._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("net-zero capacity transactions publish no identities or history", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 24,
				items: {
					Item: Array.from({ length: 24 }, () => ({ "@_xsi:nil": "true" })),
				},
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			for (const intermediate of [12, 36]) {
				yield* session.transact(
					Effect.gen(function* () {
						yield* setCharacterDetails({
							farmerId: "host",
							key: "backpack",
							value: String(intermediate),
						});
						yield* setCharacterDetails({
							farmerId: "host",
							key: "backpack",
							value: "24",
						});
					}),
				);
				const after = yield* session.snapshot;
				expect(after.document).toEqual(before.document);
				expect(after.identities).toEqual(before.identities);
				expect(after.entries).toHaveLength(0);
			}
		}),
	));

it("composes retained item edits before shrinking without losing item identity", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 24,
				items: {
					Item: Array.from({ length: 24 }, () => ({ "@_xsi:nil": "true" })),
				},
			});
			document.SaveGame.player.items.Item[0] = {
				"@_xsi:type": "Object",
				itemId: "24",
				name: "Parsnip",
				bigCraftable: false,
				category: -75,
				stack: 3,
				quality: 0,
			};
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const entityId = before.identities.host?.[0];
			if (!entityId) throw new Error("Missing retained identity");
			yield* session.transact(
				Effect.gen(function* () {
					yield* setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 9,
					});
					yield* setCharacterDetails({
						farmerId: "host",
						key: "backpack",
						value: "12",
					});
				}),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 9,
			});
			expect(after.identities.host?.[0]).toBe(entityId);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("rejects raw capacity tampering after an otherwise authorized resize", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				maxItems: 12,
				items: {
					Item: Array.from({ length: 12 }, () => ({ "@_xsi:nil": "true" })),
				},
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const failure = yield* Effect.result(
				session.transact(
					Effect.gen(function* () {
						yield* setCharacterDetails({
							farmerId: "host",
							key: "backpack",
							value: "24",
						});
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						Object.assign(snapshot.state.document.SaveGame.player, {
							maxItems: 36,
						});
						yield* draft.replace(snapshot);
					}),
				),
			);
			expect(failure._tag).toBe("Failure");
			expect((yield* session.snapshot).document).toEqual(before.document);
			expect((yield* session.snapshot).identities).toEqual(before.identities);
		}),
	));
