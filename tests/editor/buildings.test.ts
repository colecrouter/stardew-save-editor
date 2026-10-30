import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import {
	readBuildings,
	inspectBuildings,
	record,
	animalDictionary,
} from "../../src/lib/editor/building-data";
import {
	setAnimal,
	upgradeBuilding,
	adoptAnimal,
} from "../../src/lib/editor/building-operations";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations";
import { discoverPlacedChests } from "../../src/lib/editor/chest-storage";
import { fixtureXml, parser, exportDocument } from "./fixtures";
import {
	withAnimalBuildings,
	COOP_ID,
	BARN_ID,
	COOP_ANIMALS,
	PLAYER_ID,
	coopXml,
	barnXml,
	shedXml,
	SHED_ID,
	objectXml,
	incubator,
} from "../helpers/animalBuildings";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const fixture = () => parser.parse(withAnimalBuildings(fixtureXml));
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

describe("v2 buildings and animals", () => {
	it("projects outside residents and virtual age/default fields without changing the import", () => {
		const document = fixture(),
			before = structuredClone(document);
		const coop = required(
			readBuildings(document).buildings.find((row) => row.id === COOP_ID),
		);
		expect(coop).toMatchObject({ residents: 4, outside: 1, capacity: 4 });
		expect(coop.adoptionReason).toContain("full");
		expect(
			coop.animals.find((row) => row.id === COOP_ANIMALS.clucky),
		).toMatchObject({ daysOwned: 12, supported: true });
		expect(
			coop.animals.find((row) => row.id === COOP_ANIMALS.wanderer),
		).toMatchObject({ outside: true, location: "Farm" });
		expect(document).toEqual(before);
	});
	it("edits both animal mirrors field-only and restores exact imported age and unknown data on Undo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					raw = required(
						inspectBuildings(document).animals.find(
							(row) => row.id === COOP_ANIMALS.clucky,
						),
					);
				for (const mirror of raw.mirrors) mirror.modData = { opaque: "007" };
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				yield* session.transact(
					setAnimal({
						animalId: COOP_ANIMALS.clucky,
						kind: "daysOwned",
						value: 50,
					}),
				);
				yield* session.transact(
					setAnimal({
						animalId: COOP_ANIMALS.clucky,
						kind: "name",
						value: "Poppy",
					}),
				);
				const after = yield* session.snapshot,
					animal = required(
						inspectBuildings(after.document).animals.find(
							(row) => row.id === COOP_ANIMALS.clucky,
						),
					);
				expect(animal.mirrors).toHaveLength(2);
				for (const mirror of animal.mirrors)
					expect(mirror).toMatchObject({
						name: "Poppy",
						displayName: "Poppy",
						daysOwned: 50,
						age: 50,
						modData: { opaque: "007" },
					});
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("upgrades through intermediate tiers with progression, then atomically adopts and round-trips XML", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture()),
					initial = yield* session.snapshot;
				yield* session.transact(upgradeBuilding(COOP_ID, "Deluxe Coop"));
				const upgraded = yield* session.snapshot;
				expect(
					readBuildings(upgraded.document).buildings.find(
						(row) => row.id === COOP_ID,
					),
				).toMatchObject({ name: "Deluxe Coop", capacity: 12 });
				expect(upgraded.document.SaveGame).toMatchObject({
					constructedBuildings: {
						string: expect.arrayContaining(["Big Coop", "Deluxe Coop"]),
					},
				});
				yield* session.transact(
					adoptAnimal(COOP_ID, "Duck", "  Waddles  ", PLAYER_ID),
				);
				const adopted = yield* session.snapshot;
				const receipt = {
					animalId: required(
						inspectBuildings(adopted.document).animals.find(
							(row) => row.raw?.name === "Waddles",
						)?.id,
					),
				};
				const coop = required(
					inspectBuildings(adopted.document).buildings.find(
						(row) => row.id === COOP_ID,
					),
				);
				expect(coop.raw.currentOccupants).toBe(4);
				expect(
					readBuildings(adopted.document).buildings.find(
						(row) => row.id === COOP_ID,
					),
				).toMatchObject({ residents: 5, outside: 1 });
				expect(required(coop.interior).animalsThatLiveHere).toMatchObject({
					long: expect.arrayContaining([receipt.animalId]),
				});
				const animal = required(
					inspectBuildings(adopted.document).animals.find(
						(row) => row.id === receipt.animalId,
					),
				);
				expect(animal.raw).toMatchObject({
					name: "Waddles",
					ownerID: PLAYER_ID,
					happiness: 255,
					fullness: 255,
					age: 0,
				});
				expect(animalDictionary(required(coop.interior)).supported).toBe(true);
				expect(JSON.stringify(adopted.document.SaveGame.player)).toContain(
					"purchasedAnimal_Duck",
				);
				const reparsed = parser.parse(exportDocument(adopted.document));
				expect(
					readBuildings(reparsed)
						.buildings.find((row) => row.id === COOP_ID)
						?.animals.some((row) => row.id === receipt.animalId),
				).toBe(true);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(upgraded.document);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(initial.document);
			}),
		));
	it("rejects full, incompatible and duplicate-name adoption without writes or history", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				for (const [building, type, name] of [
					[COOP_ID, "Duck", "New Duck"],
					[BARN_ID, "White Chicken", "New Chicken"],
					[BARN_ID, "White Cow", "Daisy"],
				]) {
					const before = yield* session.snapshot;
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.transact(
									adoptAnimal(
										required(building),
										required(type),
										required(name),
										PLAYER_ID,
									),
								),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
			}),
		));
	it("rejects conflicting animal mirrors and unsupported field values", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					building = required(
						inspectBuildings(document).buildings.find(
							(row) => row.id === COOP_ID,
						),
					);
				const mirror = required(
					animalDictionary(required(building.interior)).upper.entries[0],
				);
				if (
					!record(mirror) ||
					!record(mirror.value) ||
					!record(mirror.value.FarmAnimal)
				)
					throw new Error("Missing animal mirror");
				mirror.value.FarmAnimal.happiness = 1;
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				expect(
					readBuildings(document).buildings.find((row) => row.id === COOP_ID)
						?.animals[0]?.supported,
				).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setAnimal({
									animalId: COOP_ANIMALS.clucky,
									kind: "happiness",
									value: 20,
								}),
							),
						),
					),
				).toBe(true);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setAnimal({
									animalId: COOP_ANIMALS.wanderer,
									kind: "fullness",
									value: 256,
								}),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it("respects construction and outside-resident downgrade capacity", () =>
		run(
			Effect.gen(function* () {
				const document = parser.parse(
					withAnimalBuildings(fixtureXml, [
						coopXml({
							type: "Big Coop",
							limit: 8,
							residents: [...Object.values(COOP_ANIMALS), "900"],
						}),
						barnXml(),
					]),
				);
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(upgradeBuilding(COOP_ID, "Coop")),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				const built = required(
					inspectBuildings(document).buildings.find(
						(row) => row.id === BARN_ID,
					),
				);
				built.raw.daysOfConstructionLeft = 2;
				const construction = yield* makeHistorySession(document);
				expect(
					Result.isFailure(
						yield* Effect.result(
							construction.transact(upgradeBuilding(BARN_ID, "Big Barn")),
						),
					),
				).toBe(true);
			}),
		));
	it("preserves chest handles and ordered composed item edits when a tier changes its location label", () =>
		run(
			Effect.gen(function* () {
				const document = parser.parse(
					withAnimalBuildings(fixtureXml, [coopXml(), barnXml(), shedXml()]),
				);
				const shed = required(
					inspectBuildings(document).buildings.find(
						(row) => row.id === SHED_ID,
					),
				);
				const interior = required(shed.interior);
				// A chest inside a Shed receives the new building location label; property
				// writes on both sides of the transition must replay in their original order.
				interior.objects = {
					item: [
						{
							key: { Vector2: { X: 1, Y: 1 } },
							value: {
								Object: {
									"@_xsi:type": "Chest",
									itemId: "130",
									name: "Chest",
									items: {
										Item: [
											{
												"@_xsi:type": "Object",
												itemId: "388",
												name: "Wood",
												bigCraftable: false,
												stack: 3,
												quality: 0,
											},
										],
									},
								},
							},
						},
					],
				};
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				const chest = required(
						discoverPlacedChests(before.document).find((row) =>
							row.location.includes("Shed"),
						),
					),
					id = required(before.identities[chest.id]?.[0]);
				yield* session.transact(
					Effect.gen(function* () {
						yield* setInventoryItem({
							ownerId: chest.id,
							entityId: id,
							property: "stack",
							value: 8,
						});
						yield* upgradeBuilding(SHED_ID, "Big Shed");
						yield* setInventoryItem({
							ownerId: chest.id,
							entityId: id,
							property: "stack",
							value: 9,
						});
					}),
				);
				const after = yield* session.snapshot,
					changed = required(
						discoverPlacedChests(after.document).find((row) =>
							row.location.includes("Big Shed"),
						),
					);
				expect(after.identities[changed.id]?.[0]).toBe(id);
				expect(changed.slots[0]).toMatchObject({ stack: 9 });
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("rejects unrelated raw inventory writes around a supported building upgrade", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* upgradeBuilding(COOP_ID, "Big Coop");
							const draft = yield* TransactionDraft,
								snapshot = yield* draft.read;
							snapshot.state.document.SaveGame.player.items.Item.push({
								itemId: "388",
								stack: 999,
							});
							yield* draft.replace(snapshot);
						}),
					),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it.each(["upgrade", "downgrade"] as const)(
		"preserves exact chest handles through %s tile moves and object-list compaction",
		(direction) =>
			run(
				Effect.gen(function* () {
					const objects =
						direction === "upgrade"
							? [
									objectXml(2, 3, {
										name: "Chest",
										itemId: "130",
										bigCraftable: true,
									}),
								]
							: [
									incubator(2, 3),
									objectXml(14, 8, {
										name: "Chest",
										itemId: "130",
										bigCraftable: true,
									}),
								];
					const document = parser.parse(
						withAnimalBuildings(fixtureXml, [
							coopXml({
								type: direction === "upgrade" ? "Coop" : "Big Coop",
								limit: direction === "upgrade" ? 4 : 8,
								objects,
							}),
						]),
					);
					const building = required(
						inspectBuildings(document).buildings.find(
							(row) => row.id === COOP_ID,
						),
					);
					const interior = required(building.interior);
					if (
						!record(interior.objects) ||
						!Array.isArray(interior.objects.item)
					)
						throw new Error("Missing objects");
					const entry = interior.objects.item[direction === "upgrade" ? 0 : 1];
					if (
						!record(entry) ||
						!record(entry.value) ||
						!record(entry.value.Object)
					)
						throw new Error("Missing chest");
					Object.assign(entry.value.Object, {
						"@_xsi:type": "Chest",
						items: { Item: [{ itemId: "388", stack: 3, name: "Wood" }] },
					});
					const session = yield* makeHistorySession(document),
						before = yield* session.snapshot;
					const chest = required(
							discoverPlacedChests(before.document).find((row) =>
								row.location.includes("Coop"),
							),
						),
						ids = required(before.identities[chest.id]);
					yield* session.transact(
						upgradeBuilding(
							COOP_ID,
							direction === "upgrade" ? "Big Coop" : "Coop",
						),
					);
					const after = yield* session.snapshot,
						moved = required(
							discoverPlacedChests(after.document).find((row) =>
								row.location.includes("Coop"),
							),
						);
					expect(after.identities[moved.id]).toEqual(ids);
					expect(moved.raw.tileLocation).toEqual(
						direction === "upgrade" ? { X: 14, Y: 8 } : { X: 2, Y: 3 },
					);
					if (direction === "downgrade") {
						expect(moved.id).not.toBe(chest.id);
						expect(after.identities[chest.id]).toBeUndefined();
					}
					yield* session.undo;
					const undone = yield* session.snapshot;
					expect(undone.document).toEqual(before.document);
					expect(undone.identities).toEqual(before.identities);
					yield* session.redo;
					const redone = yield* session.snapshot;
					expect(redone.document).toEqual(after.document);
					expect(redone.identities).toEqual(after.identities);
				}),
			),
	);
	it("collapses duplicate presentation keys into read-only rows and preserves opaque names", () =>
		run(
			Effect.gen(function* () {
				const document = parser.parse(
					withAnimalBuildings(fixtureXml, [coopXml(), coopXml()]),
				);
				const view = readBuildings(document),
					coops = view.buildings.filter((row) => row.id === COOP_ID);
				expect(coops).toHaveLength(1);
				expect(coops[0]?.supported).toBe(false);
				expect(new Set(view.unhoused.map((row) => row.id)).size).toBe(
					view.unhoused.length,
				);
				const single = fixture(),
					animal = required(
						inspectBuildings(single).animals.find(
							(row) => row.id === COOP_ANIMALS.clucky,
						),
					);
				for (const mirror of animal.mirrors)
					mirror.name = { modName: "opaque" };
				const session = yield* makeHistorySession(single),
					before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setAnimal({
									animalId: COOP_ANIMALS.clucky,
									kind: "name",
									value: "New",
								}),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				yield* session.transact(
					setAnimal({
						animalId: COOP_ANIMALS.clucky,
						kind: "happiness",
						value: 250,
					}),
				);
				expect(
					inspectBuildings((yield* session.snapshot).document).animals.find(
						(row) => row.id === COOP_ANIMALS.clucky,
					)?.raw?.name,
				).toEqual({ modName: "opaque" });
			}),
		));
});
