import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { discoverPlacedChests } from "../../src/lib/editor/chest-storage";
import {
	readChests,
	setBackpackItem,
	setInventoryItemProperty,
} from "../../src/lib/editor/inventory-operations";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw Error("Missing fixture value");
	return value;
};
const nil = { "@_xsi:nil": "true" };
const item = (name = "Parsnip") => required(createCatalogItem(name));
function fixture(
	contents: unknown = {
		Item: [item(), { ...item("Sneakers"), opaque: { mod: "007" } }],
	},
) {
	const document = tinyFixture();
	document.SaveGame.player.items.Item = [item("Rusty Sword"), nil, nil];
	document.SaveGame.locations = {
		GameLocation: [
			{
				name: "Farm",
				objects: {
					item: [
						{
							key: { Vector2: { X: 3, Y: 7 } },
							value: {
								Object: {
									"@_xsi:type": "Chest",
									name: "Chest",
									items: contents,
									modData: { owner: "007" },
								},
							},
						},
					],
				},
			},
		],
	};
	return document;
}
function chest(document: ReturnType<typeof fixture>) {
	return required(discoverPlacedChests(document)[0]);
}
const ownerId = (document: ReturnType<typeof fixture>) => chest(document).id;
const handle = (
	state: { identities: Record<string, string[]> },
	owner: string,
	index: number,
) => required(state.identities[owner]?.[index]);
function move(
	state: { identities: Record<string, string[]> },
	from: string,
	index: number,
	to: string,
	target: number,
) {
	return {
		type: "backpack-move" as const,
		farmerId: from,
		entityId: handle(state, from, index),
		toFarmerId: to,
		toEntityId: handle(state, to, target),
		fromLocation: "backpack" as const,
		toLocation: "backpack" as const,
	};
}

describe("placed chest inventory boundary", () => {
	it("projects detached slots without initializing empty/singleton save structures", () =>
		run(
			Effect.gen(function* () {
				for (const shape of ["", undefined, { Item: item() }]) {
					const document = fixture(shape),
						original = structuredClone(document),
						session = yield* makeHistorySession(document),
						state = yield* session.snapshot;
					const projected = required(readChests(state)[0]);
					expect(projected.supported).toBe(true);
					expect(projected.slots).toHaveLength(36);
					expect(projected.equipment).toEqual([]);
					expect(projected.itemContext).toBeUndefined();
					if (projected.slots[0]?.raw)
						projected.slots[0].raw.name = "Changed preview";
					expect((yield* session.snapshot).document).toEqual(original);
				}
			}),
		));
	it("moves chest records into actual backpack slots and compacts both XML and matching identities", () =>
		run(
			Effect.gen(function* () {
				const original = fixture(),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				const request = move(before, id, 0, "host", 1);
				yield* session.execute([request]);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.items.Item[1]).toEqual(
					chest(original).slots[0],
				);
				expect(chest(after.document).raw.items).toEqual({
					Item: [chest(original).slots[1]],
				});
				expect(after.identities.host?.[1]).toBe(request.entityId);
				expect(after.identities[id]?.[0]).toBe(before.identities[id]?.[1]);
				expect(chest(after.document).raw.modData).toEqual({ owner: "007" });
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
				expect((yield* session.snapshot).identities).toEqual(after.identities);
			}),
		));
	it("rejects an opaque backpack nil that compact chest serialization cannot preserve", () =>
		run(
			Effect.gen(function* () {
				const original = fixture(),
					id = ownerId(original);
				original.SaveGame.player.items.Item[1] = { ...nil, opaque: "007" };
				const session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.execute([move(before, id, 0, "host", 1)]),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect((yield* session.snapshot).document).toEqual(original);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
			}),
		));

	it("swaps whole records across owners, rejects the old owner handle, and preserves byte-identical instances", () =>
		run(
			Effect.gen(function* () {
				const original = fixture({ Item: [item(), item()] }),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				yield* session.execute([move(before, id, 0, "host", 0)]);
				const after = yield* session.snapshot;
				expect(chest(after.document).slots[0]).toEqual(
					original.SaveGame.player.items.Item[0],
				);
				const stale = yield* Effect.result(
					session.transact(
						setBackpackItem({
							farmerId: id,
							entityId: handle(before, id, 0),
							property: "stack",
							value: 5,
						}),
					),
				);
				expect(Result.isFailure(stale)).toBe(true);
				yield* session.undo;
				yield* session.execute([move(before, id, 0, id, 1)]);
				const identical = yield* session.snapshot;
				expect(identical.document).toEqual(original);
				expect(identical.identities[id]?.[1]).toBe(before.identities[id]?.[0]);
				expect(identical.cursor).toBe(1);
			}),
		));
	it("adds to virtual slots with trusted defaults, compacts, removes, and restores exact singleton/empty shapes", () =>
		run(
			Effect.gen(function* () {
				for (const contents of ["", { Item: item(), opaqueWrapper: "007" }]) {
					const original = fixture(contents),
						id = ownerId(original),
						session = yield* makeHistorySession(original),
						before = yield* session.snapshot;
					yield* session.execute([
						{
							type: "backpack-add",
							farmerId: id,
							entityId: handle(before, id, 35),
							catalogId: "Sneakers",
						},
					]);
					const added = yield* session.snapshot,
						newId = `item:${added.nextIdentity}`;
					expect(added.identities[id]).toContain(newId);
					expect(
						chest(added.document).slots.filter(
							(value) =>
								value && typeof value === "object" && !("@_xsi:nil" in value),
						),
					).toHaveLength(contents === "" ? 1 : 2);
					yield* session.execute([
						{ type: "backpack-remove", farmerId: id, entityId: newId },
					]);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(added.document);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(original);
				}
			}),
		));
	it("edits properties field-only without rebuilding singleton wrappers, and blocks raw metadata/eligibility changes", () =>
		run(
			Effect.gen(function* () {
				const original = fixture({
						Item: { ...item("Sneakers"), opaque: "007" },
						wrapper: "keep",
					}),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot,
					entityId = handle(before, id, 0);
				yield* session.transact(
					setInventoryItemProperty({
						farmerId: id,
						entityId,
						property: "defenseBonus",
						value: 8,
					}),
				);
				const after = yield* session.snapshot,
					expected = structuredClone(original);
				Object.assign(
					required(
						(chest(expected).raw.items as { Item: Record<string, unknown> })
							.Item,
					),
					{ defenseBonus: 8 },
				);
				expect(after.document).toEqual(expected);
				expect(after.identities).toEqual(before.identities);
				const bad = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							const draft = yield* TransactionDraft,
								snapshot = yield* draft.read;
							chest(snapshot.state.document).raw.specialChestType = "BigChest";
							yield* draft.replace(snapshot);
							yield* setInventoryItemProperty({
								farmerId: id,
								entityId,
								property: "defenseBonus",
								value: 9,
							});
						}),
					),
				);
				expect(Result.isFailure(bad)).toBe(true);
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("allows existing quantity/quality policy in chests and keeps owner-dependent trinkets read-only", () =>
		run(
			Effect.gen(function* () {
				const original = fixture({ Item: [item(), item("FairyBox")] }),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				yield* session.transact(
					setBackpackItem({
						farmerId: id,
						entityId: handle(before, id, 0),
						property: "stack",
						value: 17,
					}),
				);
				expect(
					(
						chest((yield* session.snapshot).document).slots[0] as Record<
							string,
							unknown
						>
					).stack,
				).toBe(17);
				const bad = yield* Effect.result(
					session.transact(
						setInventoryItemProperty({
							farmerId: id,
							entityId: handle(before, id, 1),
							property: "trinket:level",
							value: 2,
						}),
					),
				);
				expect(Result.isFailure(bad)).toBe(true);
			}),
		));
	it("validates equipment in both directions when transferring directly to or from a chest", () =>
		run(
			Effect.gen(function* () {
				const original = fixture(),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot,
					boots = required(before.equipmentIdentities.host?.boots);
				const invalid = yield* Effect.result(
					session.execute([
						{
							type: "backpack-move",
							farmerId: id,
							entityId: handle(before, id, 0),
							toFarmerId: "host",
							toEntityId: boots,
							toLocation: "boots",
						},
					]),
				);
				expect(Result.isFailure(invalid)).toBe(true);
				yield* session.execute([
					{
						type: "backpack-move",
						farmerId: id,
						entityId: handle(before, id, 1),
						toFarmerId: "host",
						toEntityId: boots,
						toLocation: "boots",
					},
				]);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player.boots).toEqual(
					chest(original).slots[1],
				);
				expect(after.equipmentIdentities.host?.boots).toBe(
					before.identities[id]?.[1],
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
			}),
		));
	it("shares one slot array for same-chest low-level equipment exchanges", () =>
		run(
			Effect.gen(function* () {
				const original = fixture(),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				yield* session.execute([
					{
						type: "equipment-swap",
						farmerId: id,
						slot: 0,
						toFarmerId: id,
						toSlot: 1,
					},
				]);
				const after = yield* session.snapshot;
				expect(chest(after.document).slots.slice(0, 2)).toEqual(
					chest(original).slots.slice(0, 2).reverse(),
				);
				expect(after.identities[id]?.slice(0, 2)).toEqual(
					before.identities[id]?.slice(0, 2).reverse(),
				);
			}),
		));

	it("does not compact a self-drop or erase redo for an imported plain-nil gap", () =>
		run(
			Effect.gen(function* () {
				const original = fixture({ Item: [nil, item()] }),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				yield* session.execute([move(before, id, 1, "host", 1)]);
				yield* session.undo;
				yield* session.execute([move(before, id, 1, id, 1)]);
				const after = yield* session.snapshot;
				expect(after.document).toEqual(original);
				expect(after.identities).toEqual(before.identities);
				expect(after.cursor).toBe(0);
				yield* session.redo;
				expect((yield* session.snapshot).cursor).toBe(1);
			}),
		));
	it("preserves imported overflow records and restores their extra identity on Undo", () =>
		run(
			Effect.gen(function* () {
				const original = fixture({
						Item: Array.from({ length: 71 }, (_, index) => ({
							...item(),
							opaque: index,
						})),
					}),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				expect(required(readChests(before)[0]).slots).toHaveLength(71);
				yield* session.execute([
					{
						type: "backpack-remove",
						farmerId: id,
						entityId: handle(before, id, 70),
					},
				]);
				const after = yield* session.snapshot;
				expect(required(readChests(after)[0]).slots).toHaveLength(70);
				expect(chest(after.document).slots.slice(0, 70)).toEqual(
					chest(original).slots.slice(0, 70),
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
			}),
		));
	it("rejects unsupported chest nil shapes and raw writes made after an approved property", () =>
		run(
			Effect.gen(function* () {
				const malformed = fixture({
					Item: [{ "@_xsi:nil": { toString: "opaque" } }],
				});
				const closed = yield* makeHistorySession(malformed);
				expect(required(readChests(yield* closed.snapshot)[0]).supported).toBe(
					false,
				);
				const original = fixture(),
					id = ownerId(original),
					session = yield* makeHistorySession(original),
					before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* setBackpackItem({
								farmerId: id,
								entityId: handle(before, id, 0),
								property: "stack",
								value: 9,
							});
							const draft = yield* TransactionDraft,
								snapshot = yield* draft.read;
							chest(snapshot.state.document).raw.modData = { forged: true };
							yield* draft.replace(snapshot);
						}),
					),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect((yield* session.snapshot).document).toEqual(original);
				expect((yield* session.snapshot).cursor).toBe(0);
			}),
		));

	it("rejects shared storage and owner ID collisions without affecting other save operations", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				document.SaveGame.player.UniqueMultiplayerID = ownerId(document);
				const session = yield* makeHistorySession(document),
					state = yield* session.snapshot;
				expect(required(readChests(state)[0]).supported).toBe(false);
				const result = yield* Effect.result(
					session.execute([
						{
							type: "backpack-add",
							farmerId: ownerId(document),
							entityId: handle(state, ownerId(document), 1),
							catalogId: "Parsnip",
						},
					]),
				);
				expect(Result.isFailure(result)).toBe(true);
				yield* session.execute([{ type: "farm-name", value: "Still works" }]);
				expect(
					(yield* session.snapshot).document.SaveGame.player.farmName,
				).toBe("Still works");
			}),
		));
});
