import { malformedFixture } from "../helpers/editor-document.ts";
import { Effect, Result } from "effect";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	canEquipItem,
	equipmentSlots,
	trinketAvailable,
} from "../../src/lib/editor/equipment";
import { readBackpacks } from "../../src/lib/editor/inventory-views";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { savedTypeId } from "../../src/lib/editor/saved-types";
import { tinyFixture } from "../helpers/editor-document.ts";
import type { InventoryMoveRequest } from "../../src/lib/editor/inventory-movement.ts";

const raw = (type: string, extra: Record<string, unknown> = {}) =>
	malformedFixture<import("../../src/lib/editor/domain.ts").Item>({
		$type: savedTypeId(type),
		name: type,
		stack: 1,
		...extra,
	});
const owner = (doc: import("../../src/lib/editor/domain.ts").SaveDocument) =>
	doc.SaveGame.player as unknown as Record<string, unknown>;
const request = (
	entityId: string,
	toEntityId: string,
): InventoryMoveRequest => ({
	type: "backpack-move",
	ownerId: "1",
	entityId,
	toOwnerId: "1",
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
			expect(canEquipItem(null, key)).toBe(true);
		}
		expect(canEquipItem(examples.pantsItem, "shirtItem")).toBe(false);
		expect(canEquipItem(examples.shirtItem, "pantsItem")).toBe(false);
		expect(canEquipItem(raw("Clothing"), "shirtItem")).toBe(false);
	});
	it.effect(
		"moves into absent equipment without eager initialization and restores exact absence/identities on undo",
		() =>
			Effect.gen(function* () {
				const doc = tinyFixture();
				doc.SaveGame.player.items[0] = raw("Clothing", {
					clothesType: "SHIRT",
					customModData: { opaque: "007" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				expect(Object.hasOwn(owner(before.document), "shirtItem")).toBe(false);
				const from = before.identities["1"]![0]!,
					to = before.equipmentIdentities["1"]!.shirtItem;
				expect(
					readBackpacks(before)[0]!.equipment.find(
						(x) => x.key === "shirtItem",
					)!.empty,
				).toBe(true);
				yield* session.execute([request(from, to)]);
				const after = yield* session.snapshot;
				expect(owner(after.document).shirtItem).toEqual(
					doc.SaveGame.player.items[0],
				);
				expect(after.document.SaveGame.player.items[0]).toEqual(null);
				expect(after.identities["1"]![0]).toBe(to);
				expect(after.equipmentIdentities["1"]!.shirtItem).toBe(from);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(undone.document).toEqual(doc);
				expect(undone.identities).toEqual(before.identities);
				expect(undone.equipmentIdentities).toEqual(before.equipmentIdentities);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
	);
	it.effect(
		"checks both displaced records and preserves complete equipment/nil data",
		() =>
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).boots = raw("Boots", { tailored: { defense: 8 } });
				owner(doc).hat = null;
				doc.SaveGame.player.items[0] = raw("Hat", {
					customModData: { hat: "opaque" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				// An equipped pair of boots cannot displace a hat into the boots slot.
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								request(
									before.equipmentIdentities["1"]!.boots,
									before.identities["1"]![0]!,
								),
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.execute([
					request(
						before.identities["1"]![0]!,
						before.equipmentIdentities["1"]!.hat,
					),
				]);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items[0]).toEqual(owner(doc).hat);
				expect(owner(after.document).hat).toEqual(doc.SaveGame.player.items[0]);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(doc);
			}),
	);
	it.effect("swaps byte-identical equipped rings by identity", () =>
		Effect.gen(function* () {
			const doc = tinyFixture();
			owner(doc).leftRing = raw("Ring", { combined: { opaque: 1 } });
			owner(doc).rightRing = structuredClone(owner(doc).leftRing);
			const session = yield* makeHistorySession(doc);
			const before = yield* session.snapshot;
			yield* session.execute([
				request(
					before.equipmentIdentities["1"]!.leftRing,
					before.equipmentIdentities["1"]!.rightRing,
				),
			]);
			const after = yield* session.snapshot;
			expect(after.document).toEqual(before.document);
			expect(after.entries).toHaveLength(1);
			expect(after.equipmentIdentities["1"]!.rightRing).toBe(
				before.equipmentIdentities["1"]!.leftRing,
			);
			yield* session.undo;
			expect((yield* session.snapshot).equipmentIdentities).toEqual(
				before.equipmentIdentities,
			);
		}),
	);
	it.effect(
		"rejects a captured equipment destination after its handle moves into a backpack",
		() =>
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).hat = raw("Hat");
				doc.SaveGame.player.items[0] = raw("Hat", { which: 1 });
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				const captured = {
					...request(
						before.identities["1"]![0]!,
						before.equipmentIdentities["1"]!.hat,
					),
					fromLocation: "backpack",
					toLocation: "hat",
				} as const;
				yield* session.execute([
					request(
						before.equipmentIdentities["1"]!.hat,
						before.identities["1"]![1]!,
					),
				]);
				const current = yield* session.snapshot;
				expect(
					Result.isFailure(yield* Effect.result(session.execute([captured]))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(current);
			}),
	);
	it.effect(
		"moves an equipped ring across owners and rejects its old owner handle",
		() =>
			Effect.gen(function* () {
				const doc = tinyFixture();
				owner(doc).leftRing = raw("CombinedRing", {
					combinedRings: [raw("Ring"), raw("Ring")],
				});
				doc.SaveGame.farmhands = [
					{
						...structuredClone(doc.SaveGame.player),
						UniqueMultiplayerID: 2n,
						name: "Guest",
						items: [null],
					},
				];
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				const source = before.equipmentIdentities["1"]!.leftRing;
				yield* session.execute([
					{
						type: "backpack-move",
						ownerId: "1",
						entityId: source,
						toOwnerId: "2",
						toEntityId: before.identities["2"]![0]!,
						fromLocation: "leftRing",
						toLocation: "backpack",
					},
				]);
				const current = yield* session.snapshot;
				expect(current.identities["2"]![0]).toBe(source);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([request(source, before.identities["1"]![1]!)]),
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
	);

	it.effect(
		"respects the trinket unlock stat while allowing an imported equipped trinket to be removed",
		() =>
			Effect.gen(function* () {
				const doc = tinyFixture();
				doc.SaveGame.player.items[0] = raw("Trinket", {
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
									before.identities["1"]![0]!,
									before.equipmentIdentities["1"]!.trinketItem,
								),
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				owner(doc).stats = {
					Values: [{ key: "TrinketSlots", value: 1 }],
				};
				const unlocked = yield* makeHistorySession(doc);
				const current = yield* unlocked.snapshot;
				yield* unlocked.execute([
					request(
						current.identities["1"]![0]!,
						current.equipmentIdentities["1"]!.trinketItem,
					),
				]);
				expect(owner((yield* unlocked.snapshot).document).trinketItem).toEqual([
					doc.SaveGame.player.items[0],
				]);
				const imported = tinyFixture();
				owner(imported).trinketItem = [raw("Trinket", { generationSeed: 789 })];
				const importedSession = yield* makeHistorySession(imported);
				const importedBefore = yield* importedSession.snapshot;
				yield* importedSession.execute([
					request(
						importedBefore.equipmentIdentities["1"]!.trinketItem,
						importedBefore.identities["1"]![1]!,
					),
				]);
				expect(importedSession).toBeTruthy();
				yield* importedSession.undo;
				expect((yield* importedSession.snapshot).document).toEqual(imported);
			}),
	);
	it.effect(
		"rejects raw equipment writes and arbitrary internal farmer-field locations",
		() =>
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
									ownerId: "1",
									slot: 0,
									toOwnerId: "1",
									toSlot: "money",
								} as never,
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);
});
