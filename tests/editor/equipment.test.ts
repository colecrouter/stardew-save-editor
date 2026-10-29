import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	canEquipItem,
	equipmentSlots,
	trinketAvailable,
} from "../../src/lib/editor/equipment";
import { readBackpacks } from "../../src/lib/editor/inventory-views";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";
import type { BackpackMoveRequest } from "../../src/lib/editor/backpack-movement";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const raw = (type: string, extra: Record<string, unknown> = {}) => ({
	"@_xsi:type": type,
	name: type,
	stack: 1,
	...extra,
});
const owner = (doc: ReturnType<typeof tinyFixture>) =>
	doc.SaveGame.player as unknown as Record<string, unknown>;
const request = (
	entityId: string,
	toEntityId: string,
): BackpackMoveRequest => ({
	type: "backpack-move",
	farmerId: "host",
	entityId,
	toFarmerId: "host",
	toEntityId,
});

describe("equipment inventory boundaries", () => {
	it("accepts only positive equipment subclasses, with distinct shirts and pants", () => {
		const examples = {
			hat: raw("Hat"),
			boots: raw("Boots"),
			leftRing: raw("Ring"),
			rightRing: raw("CombinedRing"),
			shirtItem: raw("Clothing", { clothesType: "SHIRT" }),
			pantsItem: raw("Clothing", { clothesType: "PANTS" }),
			trinketItem: raw("Trinket"),
		};
		for (const key of equipmentSlots) {
			expect(canEquipItem(examples[key], key)).toBe(true);
			expect(canEquipItem(raw("Object"), key)).toBe(false);
			expect(canEquipItem({ "@_xsi:nil": "true" }, key)).toBe(true);
		}
		expect(canEquipItem(examples.pantsItem, "shirtItem")).toBe(false);
		expect(canEquipItem(examples.shirtItem, "pantsItem")).toBe(false);
		expect(canEquipItem(raw("Clothing"), "shirtItem")).toBe(false);
	});
	it("moves into absent equipment without eager initialization and restores exact absence/identities on undo", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				doc.SaveGame.player.items.Item[0] = raw("Clothing", {
					clothesType: "SHIRT",
					modData: { opaque: "007" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				expect(Object.hasOwn(owner(before.document), "shirtItem")).toBe(false);
				const from = before.identities.host![0]!,
					to = before.equipmentIdentities.host!.shirtItem;
				expect(
					readBackpacks(before)[0]!.equipment.find(
						(x) => x.key === "shirtItem",
					)!.empty,
				).toBe(true);
				yield* session.execute([request(from, to)]);
				const after = yield* session.snapshot;
				expect(owner(after.document).shirtItem).toEqual(
					doc.SaveGame.player.items.Item[0],
				);
				expect(after.document.SaveGame.player.items.Item[0]).toEqual({
					"@_xsi:nil": "true",
				});
				expect(after.identities.host![0]).toBe(to);
				expect(after.equipmentIdentities.host!.shirtItem).toBe(from);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(undone.document).toEqual(doc);
				expect(undone.identities).toEqual(before.identities);
				expect(undone.equipmentIdentities).toEqual(before.equipmentIdentities);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("checks both displaced records and preserves complete equipment/nil data", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).boots = raw("Boots", { tailored: { defense: 8 } });
				owner(doc).hat = { "@_xsi:nil": "true", opaque: { source: "nil" } };
				doc.SaveGame.player.items.Item[0] = raw("Hat", {
					modData: { hat: "opaque" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				// An equipped pair of boots cannot displace a hat into the boots slot.
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								request(
									before.equipmentIdentities.host!.boots,
									before.identities.host![0]!,
								),
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.execute([
					request(
						before.identities.host![0]!,
						before.equipmentIdentities.host!.hat,
					),
				]);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items.Item[0]).toEqual(
					owner(doc).hat,
				);
				expect(owner(after.document).hat).toEqual(
					doc.SaveGame.player.items.Item[0],
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(doc);
			}),
		));
	it("swaps byte-identical equipped rings by identity", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).leftRing = raw("Ring", { combined: { opaque: 1 } });
				owner(doc).rightRing = structuredClone(owner(doc).leftRing);
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				yield* session.execute([
					request(
						before.equipmentIdentities.host!.leftRing,
						before.equipmentIdentities.host!.rightRing,
					),
				]);
				const after = yield* session.snapshot;
				expect(after.document).toEqual(before.document);
				expect(after.entries).toHaveLength(1);
				expect(after.equipmentIdentities.host!.rightRing).toBe(
					before.equipmentIdentities.host!.leftRing,
				);
				yield* session.undo;
				expect((yield* session.snapshot).equipmentIdentities).toEqual(
					before.equipmentIdentities,
				);
			}),
		));
	it("rejects a captured equipment destination after its handle moves into a backpack", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).hat = raw("Hat");
				doc.SaveGame.player.items.Item[0] = raw("Hat", { which: 1 });
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				const captured = {
					...request(
						before.identities.host![0]!,
						before.equipmentIdentities.host!.hat,
					),
					fromLocation: "backpack",
					toLocation: "hat",
				} as const;
				yield* session.execute([
					request(
						before.equipmentIdentities.host!.hat,
						before.identities.host![1]!,
					),
				]);
				const current = yield* session.snapshot;
				expect(
					Result.isFailure(yield* Effect.result(session.execute([captured]))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(current);
			}),
		));
	it("moves an equipped ring across owners and rejects its old owner handle", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).leftRing = raw("CombinedRing", {
					combinedRings: { Ring: [raw("Ring"), raw("Ring")] },
				});
				doc.SaveGame.farmhands = {
					Farmer: [
						{
							...structuredClone(doc.SaveGame.player),
							UniqueMultiplayerID: "guest",
							name: "Guest",
							items: { Item: [{ "@_xsi:nil": "true" }] },
						},
					],
				};
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				const source = before.equipmentIdentities.host!.leftRing;
				yield* session.execute([
					{
						type: "backpack-move",
						farmerId: "host",
						entityId: source,
						toFarmerId: "guest",
						toEntityId: before.identities.guest![0]!,
						fromLocation: "leftRing",
						toLocation: "backpack",
					},
				]);
				const current = yield* session.snapshot;
				expect(current.identities.guest![0]).toBe(source);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([request(source, before.identities.host![1]!)]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(current);
				yield* session.undo;
				const restored = yield* session.snapshot;
				expect(restored.document).toEqual(doc);
				expect(restored.identities).toEqual(before.identities);
				expect(restored.equipmentIdentities).toEqual(
					before.equipmentIdentities,
				);
			}),
		));

	it("respects the trinket unlock stat while allowing an imported equipped trinket to be removed", () =>
		run(
			Effect.gen(function* () {
				const doc = tinyFixture();
				doc.SaveGame.player.items.Item[0] = raw("Trinket", {
					generationSeed: 42,
				});
				expect(trinketAvailable(owner(doc))).toBe(false);
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								request(
									before.identities.host![0]!,
									before.equipmentIdentities.host!.trinketItem,
								),
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				owner(doc).stats = {
					Values: {
						item: [
							{ key: { string: "TrinketSlots" }, value: { unsignedInt: 1 } },
						],
					},
				};
				const unlocked = yield* makeHistorySession(doc);
				const current = yield* unlocked.snapshot;
				yield* unlocked.execute([
					request(
						current.identities.host![0]!,
						current.equipmentIdentities.host!.trinketItem,
					),
				]);
				expect(owner((yield* unlocked.snapshot).document).trinketItem).toEqual(
					doc.SaveGame.player.items.Item[0],
				);
				const imported = tinyFixture();
				owner(imported).trinketItem = raw("Trinket", { generationSeed: 789 });
				const importedSession = yield* makeHistorySession(imported);
				const importedBefore = yield* importedSession.snapshot;
				yield* importedSession.execute([
					request(
						importedBefore.equipmentIdentities.host!.trinketItem,
						importedBefore.identities.host![1]!,
					),
				]);
				expect(importedSession).toBeTruthy();
				yield* importedSession.undo;
				expect((yield* importedSession.snapshot).document).toEqual(imported);
			}),
		));
	it("rejects raw equipment writes and arbitrary internal farmer-field locations", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				const before = yield* session.snapshot;
				const write = Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const state = yield* draft.read;
					owner(state.state.document).hat = raw("Hat");
					yield* draft.replace(state);
				});
				expect(
					Result.isFailure(yield* Effect.result(session.transact(write))),
				).toBe(true);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{
									type: "equipment-swap",
									farmerId: "host",
									slot: 0,
									toFarmerId: "host",
									toSlot: "money",
								} as never,
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
});
