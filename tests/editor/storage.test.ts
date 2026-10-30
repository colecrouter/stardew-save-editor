import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { readChests } from "../../src/lib/editor/inventory-views";
import { discoverPlacedChests } from "../../src/lib/editor/chest-storage";
import { setStorageQuality } from "../../src/lib/editor/storage-operations";
import { searchStorage } from "../../src/lib/editor/storage-domain";
import { tinyFixture } from "./fixtures";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};
const item = (name: string) => required(createCatalogItem(name));
function fixture(
	contents: unknown[][] = [[item("Parsnip"), item("Wood")], [item("Parsnip")]],
) {
	const document = tinyFixture();
	const chests = contents.map((items) => ({
		"@_xsi:type": "Chest",
		playerChest: true,
		itemId: "130",
		name: "Chest",
		items: { Item: items },
		specialChestType: "None",
		modData: { opaque: "007" },
	}));
	document.SaveGame.locations = {
		GameLocation: [
			{
				name: "Farm",
				objects: {
					item: chests.map((chest, index) => ({
						key: { Vector2: { X: index + 3, Y: 7 } },
						value: { Object: chest },
					})),
				},
			},
		],
	};
	return { document, chests };
}
const handle = (
	state: { identities: Record<string, string[]> },
	ownerId: string,
	index: number,
) => required(state.identities[ownerId]?.[index]);

describe("storage command boundary", () => {
	it("organizes tools first and leaves complete stacks and empty markers as paired lifetimes", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture();
				document.SaveGame.player.items.Item = [
					item("Wood"),
					{ "@_xsi:nil": "true", modData: "keep empty" },
					item("Parsnip"),
					item("Rusty Sword"),
					{ ...item("Parsnip"), stack: 7 },
				];
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				yield* session.execute([
					{ type: "inventory-organize", ownerId: "host" },
				]);
				const after = yield* session.snapshot,
					slots = after.document.SaveGame.player.items.Item;
				expect(slots[0]).toMatchObject({ name: "Rusty Sword" });
				expect(
					slots.filter(
						(value) =>
							typeof value === "object" &&
							value !== null &&
							"name" in value &&
							value.name === "Parsnip",
					),
				).toHaveLength(2);
				expect(slots.at(-1)).toEqual({
					"@_xsi:nil": "true",
					modData: "keep empty",
				});
				expect(after.identities.host?.at(-1)).toBe(before.identities.host?.[1]);
				for (const [index, value] of slots.entries())
					expect(value).toEqual(
						before.document.SaveGame.player.items.Item[
							required(
								before.identities.host?.indexOf(handle(after, "host", index)),
							)
						],
					);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).identities).toEqual(after.identities);
			}),
		));
	it("organizes a compact chest and preserves each item handle and all raw members", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture([
						[item("Wood"), item("Parsnip"), item("Rusty Sword")],
					]),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const chest = required(discoverPlacedChests(before.document)[0]);
				yield* session.execute([
					{ type: "inventory-organize", ownerId: chest.id },
				]);
				const after = yield* session.snapshot,
					result = required(discoverPlacedChests(after.document)[0]);
				expect(result.raw.modData).toEqual({ opaque: "007" });
				expect(result.slots[0]).toMatchObject({ name: "Rusty Sword" });
				expect(handle(after, chest.id, 0)).toBe(handle(before, chest.id, 2));
				expect(after.identities[chest.id]).toHaveLength(36);
			}),
		));
	it("transfers a captured set atomically and follows handles through source compaction", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture(),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const [source, target] = discoverPlacedChests(before.document);
				const from = required(source),
					to = required(target);
				const ids = [handle(before, from.id, 0), handle(before, from.id, 1)];
				yield* session.execute([
					{
						type: "inventory-transfer",
						ownerId: to.id,
						sources: ids.map((entityId) => ({ ownerId: from.id, entityId })),
					},
				]);
				const after = yield* session.snapshot;
				expect(
					required(discoverPlacedChests(after.document)[0]).serializedLength,
				).toBe(0);
				expect(after.identities[to.id]).toEqual(expect.arrayContaining(ids));
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).identities).toEqual(after.identities);
			}),
		));
	it("rejects a stale source or insufficient room without touching either endpoint", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture([
					[item("Wood"), item("Parsnip")],
					Array.from({ length: 35 }, () => item("Wood")),
				]);
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const [source, target] = discoverPlacedChests(before.document),
					from = required(source),
					to = required(target);
				const sources = [0, 1].map((index) => ({
					ownerId: from.id,
					entityId: handle(before, from.id, index),
				}));
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{ type: "inventory-transfer", ownerId: to.id, sources },
							]),
						),
					),
				).toBe(true);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{
									type: "inventory-transfer",
									ownerId: to.id,
									sources: [{ ownerId: from.id, entityId: "stale" }],
								},
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it("bulk quality has one Undo boundary and rolls back all targets after a later stale handle", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture(),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const chests = discoverPlacedChests(before.document),
					handles = chests.map((chest) => ({
						ownerId: chest.id,
						entityId: handle(before, chest.id, 0),
					}));
				yield* session.transact(setStorageQuality(handles, 4));
				const after = yield* session.snapshot;
				expect(
					readChests(after).map((chest) => chest.slots[0]?.quality),
				).toEqual([4, 4]);
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setStorageQuality(
									[
										required(handles[0]),
										{ ownerId: required(chests[1]).id, entityId: "stale" },
									],
									2,
								),
							),
						),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before.document);
			}),
		));
	it("grows and shrinks a chest while retaining occupied IDs and rejecting a full downgrade", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture([[item("Wood")]]),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const chest = required(discoverPlacedChests(before.document)[0]),
					id = handle(before, chest.id, 0);
				yield* session.execute([
					{ type: "chest-type", ownerId: chest.id, itemId: "BigStoneChest" },
				]);
				const big = yield* session.snapshot;
				expect(big.identities[chest.id]).toHaveLength(70);
				expect(handle(big, chest.id, 0)).toBe(id);
				expect(
					required(discoverPlacedChests(big.document)[0]).raw,
				).toMatchObject({
					itemId: "BigStoneChest",
					currentLidFrame: 329,
					modData: { opaque: "007" },
				});
				yield* session.execute([
					{ type: "chest-type", ownerId: chest.id, itemId: "232" },
				]);
				expect((yield* session.snapshot).identities[chest.id]).toHaveLength(36);
				yield* session.undo;
				expect((yield* session.snapshot).identities).toEqual(big.identities);
			}),
		));
	it("protects mini-bin separate-wallet items and permits an empty-wallet expansion", () =>
		run(
			Effect.gen(function* () {
				for (const wallet of [
					undefined,
					{ item: [{ value: { Item: { itemId: "388", stack: 5 } } }] },
				]) {
					const { document, chests } = fixture([[]]);
					Object.assign(required(chests[0]), {
						itemId: "248",
						specialChestType: "MiniShippingBin",
						...(wallet ? { separateWalletItems: wallet } : {}),
					});
					const session = yield* makeHistorySession(document),
						before = yield* session.snapshot,
						chest = required(discoverPlacedChests(before.document)[0]);
					const result = yield* Effect.result(
						session.execute([
							{ type: "chest-type", ownerId: chest.id, itemId: "130" },
						]),
					);
					if (wallet) {
						expect(Result.isFailure(result)).toBe(true);
						expect(yield* session.snapshot).toEqual(before);
					} else {
						expect(Result.isSuccess(result)).toBe(true);
						expect((yield* session.snapshot).identities[chest.id]).toHaveLength(
							36,
						);
					}
				}
			}),
		));
	it("searches item contents across containers without mutating the views", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture(),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot,
					views = readChests(before),
					original = structuredClone(views);
				expect(searchStorage(views, "  pArSnIp  ")).toHaveLength(2);
				expect(searchStorage(views, "388")).toHaveLength(1);
				expect(views).toEqual(original);
			}),
		));
	it("discovers fridge, explicit machine roots and building storage without changing existing owner paths", () =>
		run(
			Effect.gen(function* () {
				const { document } = fixture([[item("Wood")]]);
				const placed = required(discoverPlacedChests(document)[0]);
				const make = (name: string) => ({
					name,
					playerChest: true,
					itemId: "130",
					specialChestType: "None",
					items: { Item: item("Parsnip"), opaque: "keep" },
					modData: { unknown: "007" },
				});
				const fridge = { ...make("Fridge"), fridge: true },
					machine = make("Input"),
					held = make("Output"),
					building = make("Mill storage");
				document.SaveGame.locations = {
					GameLocation: [
						{
							name: "Farm",
							objects: {
								item: [
									{
										key: { Vector2: { X: 3, Y: 7 } },
										value: { Object: placed.raw },
									},
									{
										key: { Vector2: { X: 4, Y: 7 } },
										value: {
											Object: {
												name: "Machine",
												Chest: machine,
												heldObject: held,
											},
										},
									},
								],
							},
							buildings: {
								Building: [
									{ buildingType: "Mill", buildingChests: { Chest: building } },
								],
							},
						},
						{ name: "FarmHouse", fridge },
					],
				};
				const original = structuredClone(document),
					session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const found = discoverPlacedChests(before.document);
				expect(found).toHaveLength(5);
				expect(found[0]?.id).toBe(placed.id);
				expect(found.map((chest) => chest.source)).toEqual([
					"chest",
					"machine",
					"machine",
					"building",
					"fridge",
				]);
				expect(before.document).toEqual(original);
				for (const chest of found.slice(1)) {
					expect(
						readChests(before).find((view) => view.ownerId === chest.id)
							?.storage?.typeId,
					).toBeUndefined();
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.execute([
									{ type: "chest-type", ownerId: chest.id, itemId: "BigChest" },
								]),
							),
						),
					).toBe(true);
				}
				const targets = found.slice(1).map((chest) => ({
					ownerId: chest.id,
					entityId: handle(before, chest.id, 0),
				}));
				yield* session.transact(setStorageQuality(targets, 2));
				const edited = yield* session.snapshot;
				for (const chest of discoverPlacedChests(edited.document).slice(1)) {
					expect(chest.slots[0]).toMatchObject({ quality: 2 });
					expect(chest.raw).toMatchObject({
						items: { opaque: "keep", Item: { quality: 2 } },
						modData: { unknown: "007" },
					});
				}
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				const from = required(found.find((chest) => chest.source === "fridge")),
					to = required(found.find((chest) => chest.source === "building")),
					id = handle(before, from.id, 0);
				yield* session.execute([
					{
						type: "inventory-transfer",
						ownerId: to.id,
						sources: [{ ownerId: from.id, entityId: id }],
					},
				]);
				const transferred = yield* session.snapshot;
				expect(transferred.identities[to.id]).toContain(id);
				expect(
					required(
						discoverPlacedChests(transferred.document).find(
							(chest) => chest.id === from.id,
						),
					).raw.items,
				).toEqual({ opaque: "keep" });
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				yield* session.redo;
				expect((yield* session.snapshot).identities).toEqual(
					transferred.identities,
				);
			}),
		));
	it("rejects downgrading a full big chest and preserves opaque type IDs during projection", () =>
		run(
			Effect.gen(function* () {
				const { document, chests } = fixture([
					Array.from({ length: 37 }, () => item("Wood")),
				]);
				Object.assign(required(chests[0]), {
					itemId: "BigChest",
					specialChestType: "BigChest",
				});
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot,
					chest = required(discoverPlacedChests(before.document)[0]);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{ type: "chest-type", ownerId: chest.id, itemId: "130" },
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				Object.assign(required(chests[0]), {
					itemId: { toString: "not callable" },
				});
				const opaque = yield* makeHistorySession(document);
				expect(
					readChests(yield* opaque.snapshot)[0]?.storage?.typeId,
				).toBeUndefined();
			}),
		));
	it("rejects structural edits to aliased raw chest owners without confusing their separate handles", () =>
		run(
			Effect.gen(function* () {
				const { document, chests } = fixture([[item("Parsnip"), item("Wood")]]),
					raw = required(chests[0]);
				document.SaveGame.locations = {
					GameLocation: [
						{
							name: "Farm",
							objects: {
								item: [0, 1].map((index) => ({
									key: { Vector2: { X: index, Y: 0 } },
									value: { Object: raw },
								})),
							},
						},
					],
				};
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot,
					owners = discoverPlacedChests(before.document),
					first = required(owners[0]),
					second = required(owners[1]);
				expect(handle(before, first.id, 0)).not.toBe(
					handle(before, second.id, 0),
				);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{ type: "inventory-organize", ownerId: first.id },
							]),
						),
					),
				).toBe(true);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{
									type: "inventory-transfer",
									ownerId: first.id,
									sources: [
										{
											ownerId: second.id,
											entityId: handle(before, second.id, 0),
										},
									],
								},
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
});

it.each(["absent", "array"] as const)(
	"organizing %s empty storage preserves exact XML and Redo",
	(representation) =>
		run(
			Effect.gen(function* () {
				const { document, chests } = fixture([[]]),
					chest = required(chests[0]);
				if (representation === "absent") Reflect.deleteProperty(chest, "items");
				const session = yield* makeHistorySession(document);
				yield* session.execute([
					{ type: "money", farmerId: "host", value: 99 },
				]);
				yield* session.undo;
				const before = yield* session.snapshot,
					ownerId = required(readChests(before)[0]).ownerId;
				yield* session.execute([{ type: "inventory-organize", ownerId }]);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.redo;
				expect((yield* session.snapshot).document.SaveGame.player.money).toBe(
					99,
				);
			}),
		),
);
