import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { describe, expect } from "vitest";

import { canEquipItem } from "../../src/lib/editor/equipment";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	getInventoryItemCapabilities,
	InventoryEdits,
	setInventoryItem,
	setInventoryItemProperty,
} from "../../src/lib/editor/inventory-operations";
import {
	catalogEntries,
	createCatalogItem,
} from "../../src/lib/editor/item-catalog";
import {
	decodeItemPropertyChange,
	getItemPropertyFields,
	type ItemPropertyChange,
	readItemPropertyContext,
} from "../../src/lib/editor/item-properties";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { requireDefined, requireRecord } from "../helpers/assertions.ts";
import {
	catalogFixture,
	malformedFixture,
} from "../helpers/editor-document.ts";
import { fixtureXml, parser, tinyFixture } from "./fixtures";

function required<A>(value: A | undefined): A {
	if (value === undefined) throw Error("Missing fixture value");
	return value;
}
function item(name: string) {
	return required(createCatalogItem(name));
}
function fixture() {
	const document = tinyFixture();
	document.SaveGame.player.items = [
		catalogFixture(item("Sneakers"), "StardewValley.Objects.Boots"),
		item("Rusty Sword"),
		item("Parsnip"),
		item("Watering Can"),
		malformedFixture({ "@_xsi:nil": "true", modEmpty: "007" }),
	];
	document.SaveGame.player.boots = {
		...catalogFixture(item("Sneakers"), "StardewValley.Objects.Boots"),
		customModData: { tailored: "007" },
		immunityBonus: 777,
	};
	document.SaveGame.player.shirtItem = structuredClone(
		requireDefined(parser.parse(fixtureXml).SaveGame.player.shirtItem),
	);
	return document;
}
const change = (
	entityId: string,
	property: ItemPropertyChange["property"],
	value: unknown,
	ownerId = "1",
) => {
	const decoded = decodeItemPropertyChange({
		ownerId,
		entityId,
		property,
		value,
	});
	if (Result.isFailure(decoded)) throw Error(decoded.failure.message);
	return decoded.success;
};

describe("bounded inventory property edits", () => {
	it.effect(
		"edits equipped boots field-only, preserves unusual imported values, and keeps no-op redo",
		() =>
			Effect.gen(function* () {
				const original = fixture();
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const id = required(before.equipmentIdentities["1"]?.boots);
				yield* session.transact(
					setInventoryItemProperty(change(id, "defenseBonus", 7)),
				);
				const expected = structuredClone(original);
				Object.assign(requireDefined(expected.SaveGame.player.boots), {
					defenseBonus: 7,
				});
				expect((yield* session.snapshot).document).toEqual(expected);
				expect((yield* session.snapshot).equipmentIdentities).toEqual(
					before.equipmentIdentities,
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				yield* session.transact(
					setInventoryItemProperty(change(id, "defenseBonus", 1)),
				);
				expect((yield* session.snapshot).cursor).toBe(0);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(expected);
			}),
	);
	it.effect(
		"writes weapon, object and bottomless fields independently without touching other saved data",
		() =>
			Effect.gen(function* () {
				const original = fixture();
				const can = requireRecord(original.SaveGame.player.items[3]);
				can["IsBottomless"] = false;
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const sword = required(before.identities["1"]?.[1]),
					parsnip = required(before.identities["1"]?.[2]),
					watering = required(before.identities["1"]?.[3]);
				const requests = [
					change(sword, "minDamage", 8),
					change(sword, "addedPrecision", 4),
					change(sword, "critChance", 0.25),
					change(sword, "knockback", 1.5),
					change(parsnip, "price", 999),
					change(parsnip, "edibility", -7),
					change(watering, "isBottomless", true),
				];
				for (const request of requests)
					yield* session.transact(setInventoryItemProperty(request));
				const expected = structuredClone(original);
				Object.assign(requireDefined(expected.SaveGame.player.items[1]), {
					minDamage: 8,
					addedPrecision: 4,
					critChance: 0.25,
					knockback: 1.5,
				});
				Object.assign(requireDefined(expected.SaveGame.player.items[2]), {
					price: 999,
					edibility: -7,
				});
				Object.assign(requireDefined(expected.SaveGame.player.items[3]), {
					isBottomless: true,
					IsBottomless: true,
				});
				expect((yield* session.snapshot).document).toEqual(expected);
				for (const _ of requests) yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
			}),
	);
	it.effect(
		"preserves alpha, unknown color members and mirror presence while coloring equipped clothes",
		() =>
			Effect.gen(function* () {
				const original = fixture();
				const shirt = requireRecord(original.SaveGame.player.shirtItem);
				shirt["isPrismatic"] = false;
				shirt["clothesColor"] = {
					R: 1,
					G: 2,
					B: 3,
					A: 91,
					PackedValue: 1526923777,
					mod: { opaque: "007" },
				};
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				yield* session.transact(
					setInventoryItemProperty(
						change(
							required(before.equipmentIdentities["1"]?.shirtItem),
							"clothesColor",
							"#aabbcc",
						),
					),
				);
				const expected = structuredClone(original);
				requireRecord(expected.SaveGame.player.shirtItem)["clothesColor"] = {
					R: 170,
					G: 187,
					B: 204,
					A: 91,
					PackedValue: 1540144042,
					mod: { opaque: "007" },
				};
				expect((yield* session.snapshot).document).toEqual(expected);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
				delete requireRecord(shirt["clothesColor"])["PackedValue"];
				expect(
					getItemPropertyFields(shirt, { _type: "Shirt" }).find(
						(field) => field.property === "clothesColor",
					)?.value,
				).toBe("#010203");
			}),
	);
	it("does not advertise or initialize missing, malformed, unsupported or prismatic properties", () => {
		const boots = catalogFixture(
			item("Sneakers"),
			"StardewValley.Objects.Boots",
		);
		// Missing saved properties cannot authorize controls or initialize defaults.
		delete boots.defenseBonus;
		delete boots.immunityBonus;
		expect(getItemPropertyFields(boots, { _type: "Boots" })).toEqual([]);
		expect(
			getItemPropertyFields(
				{
					$type: "StardewValley.Objects.Clothing",
					isPrismatic: true,
					clothesColor: { R: 0, G: 0, B: 0, A: 255 },
				},
				{ _type: "Shirt" },
			),
		).toEqual([]);
		expect(
			getItemPropertyFields(
				{
					$type: "StardewValley.Objects.ColoredObject",
					color: { R: 1, G: 2, B: 3 },
				},
				{ _type: "Object" },
			),
		).toEqual([]);
		expect(
			getItemPropertyFields(
				catalogFixture(item("Sneakers"), "StardewValley.Objects.Boots"),
				{
					_type: "Object",
				},
			),
		).toEqual([]);
		expect(
			getItemPropertyFields(
				catalogFixture(item("Sneakers"), "StardewValley.Objects.Boots"),
			),
		).toEqual([]);
	});
	it.effect(
		"validates own request values and rejects cross-family, missing-field and stale-owner writes without publication",
		() =>
			Effect.gen(function* () {
				for (const input of [
					{
						ownerId: "1",
						entityId: "id",
						property: "defenseBonus",
						value: 100,
					},
					{ ownerId: "1", entityId: "id", property: "price", value: -1 },
					{
						ownerId: "1",
						entityId: "id",
						property: "minDamage",
						value: 0.5,
					},
					{ ownerId: "1", entityId: "id", property: "color", value: "bad" },
					Object.create({
						ownerId: "1",
						entityId: "id",
						property: "defenseBonus",
						value: 1,
					}),
				])
					expect(Result.isFailure(decodeItemPropertyChange(input))).toBe(true);
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				for (const request of [
					change(required(before.identities["1"]?.[1]), "defenseBonus", 2),
					change(required(before.identities["1"]?.[0]), "price", 2),
					change("missing", "defenseBonus", 2),
				]) {
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.transact(setInventoryItemProperty(request)),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
			}),
	);
	it.effect(
		"follows its equipped instance into a backpack and rejects the old owner after a cross-farmer transfer",
		() =>
			Effect.gen(function* () {
				const original = fixture();
				const guest = required(original.SaveGame.farmhands[0]);
				guest.items = [null];
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const bootsId = required(before.equipmentIdentities["1"]?.boots);
				yield* session.execute([
					{
						type: "backpack-move",
						ownerId: "1",
						entityId: bootsId,
						toOwnerId: "2",
						toEntityId: required(before.identities["2"]?.[0]),
					},
				]);
				const moved = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setInventoryItemProperty(change(bootsId, "defenseBonus", 6)),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(moved);
				yield* session.transact(
					setInventoryItemProperty(change(bootsId, "defenseBonus", 6, "2")),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.farmhands,
				).toMatchObject([{ items: [{ defenseBonus: 6, immunityBonus: 777 }] }]);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
			}),
	);
	it.effect(
		"rejects unapproved temporary type changes before authorizing a property edit",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const forged = Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					requireRecord(snapshot.state.document.SaveGame.player.items[1])[
						"$type"
					] = "StardewValley.Objects.Boots";
					yield* draft.replace(snapshot);
					yield* setInventoryItemProperty(
						change(required(before.identities["1"]?.[1]), "defenseBonus", 3),
					);
				});
				expect(
					Result.isFailure(yield* Effect.result(session.transact(forged))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);
	it.effect(
		"rejects temporary or later trinket context changes rather than authorizing seeds for another RNG",
		() =>
			Effect.gen(function* () {
				const original = fixture();
				original.SaveGame.player.trinketItem = [
					{
						...catalogFixture(
							item("FairyBox"),
							"StardewValley.Objects.Trinkets.Trinket",
						),
						generationSeed: 1,
					},
				];
				original.SaveGame.useLegacyRandom = false;
				original.SaveGame.player.totalMoneyEarned = 1000;
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const id = required(before.equipmentIdentities["1"]?.trinketItem);
				for (const first of [true, false]) {
					const attempt = Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						if (first) {
							const snapshot = yield* draft.read;
							snapshot.state.document.SaveGame.useLegacyRandom = true;
							yield* draft.replace(snapshot);
						}
						yield* setInventoryItemProperty(change(id, "trinket:level", 2));
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.useLegacyRandom = !first;
						yield* draft.replace(snapshot);
					});
					expect(
						Result.isFailure(yield* Effect.result(session.transact(attempt))),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
			}),
	);
});

it.effect(
	"reads the game's effective Bottomless alias and edits only existing mirrors",
	() =>
		Effect.gen(function* () {
			const original = fixture();
			const can = requireRecord(original.SaveGame.player.items[3]);
			can["isBottomless"] = false;
			can["IsBottomless"] = true;
			expect(
				getItemPropertyFields(can, { _type: "Tool" }).find(
					(field) => field.property === "isBottomless",
				)?.value,
			).toBe(true);
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			yield* session.transact(
				setInventoryItemProperty(
					change(required(before.identities["1"]?.[3]), "isBottomless", false),
				),
			);
			expect(
				(yield* session.snapshot).document.SaveGame.player.items[3],
			).toMatchObject({
				isBottomless: false,
				IsBottomless: false,
			});
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(original);
			delete can["isBottomless"];
			const upperOnly = yield* makeHistorySession(original);
			const upperBefore = yield* upperOnly.snapshot;
			yield* upperOnly.transact(
				setInventoryItemProperty(
					change(
						required(upperBefore.identities["1"]?.[3]),
						"isBottomless",
						false,
					),
				),
			);
			const upperAfter = requireRecord(
				(yield* upperOnly.snapshot).document.SaveGame.player.items[3],
			);
			expect(upperAfter["IsBottomless"]).toBe(false);
			expect(Object.hasOwn(upperAfter, "isBottomless")).toBe(false);
			// Omitted aliases do not authorize initialization just by opening controls.
			delete can["IsBottomless"];
			delete can["isBottomless"];
			expect(getItemPropertyFields(can, { _type: "Tool" })).toEqual([]);
		}),
);

it.effect(
	"rolls back a compound property attempt and closes escaped property authority",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const before = yield* session.snapshot;
			let captured: typeof InventoryEdits.Service | undefined;
			const request = change(
				required(before.equipmentIdentities["1"]?.boots),
				"defenseBonus",
				9,
			);
			const attempted = Effect.gen(function* () {
				captured = yield* InventoryEdits;
				yield* setInventoryItemProperty(request);
				return yield* Effect.fail("later operation failed");
			});
			expect(
				Result.isFailure(yield* Effect.result(session.transact(attempted))),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			expect(
				Result.isFailure(
					yield* Effect.result(required(captured).setProperty(request)),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect(
	"guards owner income as trinket authorization context before and after an edit",
	() =>
		Effect.gen(function* () {
			const original = fixture();
			original.SaveGame.player.trinketItem = [
				{
					...catalogFixture(
						item("ParrotEgg"),
						"StardewValley.Objects.Trinkets.Trinket",
					),
					generationSeed: 1,
				},
			];
			original.SaveGame.player.totalMoneyEarned = 0;
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			const id = required(before.equipmentIdentities["1"]?.trinketItem);
			for (const mutateBefore of [true, false]) {
				const attempt = Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					if (mutateBefore) {
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.player.totalMoneyEarned = 3000000;
						yield* draft.replace(snapshot);
					}
					yield* setInventoryItemProperty(
						change(id, "trinket:level", mutateBefore ? 4 : 1),
					);
					const snapshot = yield* draft.read;
					snapshot.state.document.SaveGame.player.totalMoneyEarned =
						mutateBefore ? 0 : 3000000;
					yield* draft.replace(snapshot);
				});
				expect(
					Result.isFailure(yield* Effect.result(session.transact(attempt))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}
		}),
);

it.effect(
	"edits colored-object stack and quality without touching color or opaque metadata",
	() =>
		Effect.gen(function* () {
			const original = fixture();
			original.SaveGame.player.items[2] = {
				...catalogFixture(item("Parsnip"), "StardewValley.Object"),
				$type: "StardewValley.Objects.ColoredObject",
				color: { R: 1, G: 2, B: 3, A: 77, opaque: "007" },
				customModData: { custom: false },
			};
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			const entityId = required(before.identities["1"]?.[2]);
			yield* session.transact(
				setInventoryItem({
					ownerId: "1",
					entityId,
					property: "stack",
					value: 18,
				}),
			);
			yield* session.transact(
				setInventoryItem({
					ownerId: "1",
					entityId,
					property: "quality",
					value: 4,
				}),
			);
			const expected = structuredClone(original);
			Object.assign(requireDefined(expected.SaveGame.player.items[2]), {
				stack: 18,
				quality: 4,
			});
			expect((yield* session.snapshot).document).toEqual(expected);
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(original);
		}),
);

it("uses decoded game context with virtual defaults without repairing the save", () => {
	const document = fixture();
	const before = structuredClone(document);
	expect(readItemPropertyContext(document, document.SaveGame.player)).toEqual({
		useLegacyRandom: false,
		totalMoneyEarned: 0,
	});
	expect(document).toEqual(before);
	document.SaveGame.player.totalMoneyEarned = 3000000;
	document.SaveGame.useLegacyRandom = true;
	expect(readItemPropertyContext(document, document.SaveGame.player)).toEqual({
		useLegacyRandom: true,
		totalMoneyEarned: 3000000,
	});
});

// A mod can reuse a built-in XML name in a different namespace. Its opaque
// payload must not gain editing capabilities from that familiar name.
it("keeps unknown namespaced item classes opaque", () => {
	const boots = {
		...catalogFixture(item("Sneakers"), "StardewValley.Objects.Boots"),
		$type: "$unknown" as const,
		$xmlType: { name: "Boots", namespace: "urn:mod" },
	};
	expect(getItemPropertyFields(boots, { _type: "Boots" })).toEqual([]);
	expect(canEquipItem(boots, "boots")).toBe(false);
	const object = {
		...catalogFixture(item("Parsnip"), "StardewValley.Object"),
		$type: "$unknown" as const,
		$xmlType: { name: "Object", namespace: "urn:mod" },
	};
	expect(getInventoryItemCapabilities(object, true, true)).toEqual({
		canStack: false,
		canQuality: false,
	});
});

// Before 1.6.9 the game keyed ring light sources on uniqueID. 1.6.15 no longer
// saves it, but older 1.6 saves still need distinct IDs, so each new ring gets
// its own, even when it is the same kind as another.
it("gives each new ring its own legacy uniqueID", () => {
	const glow = requireRecord(item("Glow Ring"));
	expect(glow["$type"]).toBe("StardewValley.Objects.Ring");
	expect(glow["uniqueID"]).toMatch(/^\d+$/);
	// Two rings of one kind can still draw the same random ID, so sample a few
	// and require that they are not all identical.
	const ids = new Set(
		Array.from(
			{ length: 5 },
			() => requireRecord(item("Glow Ring"))["uniqueID"],
		),
	);
	expect(ids.size).toBeGreaterThan(1);
	// Catalog previews are never saved, so they carry no generated ID.
	const preview = catalogEntries.find((entry) => entry.id === "Glow Ring");
	expect(requireRecord(preview?.raw)["uniqueID"]).toBeUndefined();
});
