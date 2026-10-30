import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import {
	getItemPropertyFields,
	decodeItemPropertyChange,
	readItemPropertyContext,
	type ItemPropertyChange,
} from "../../src/lib/editor/item-properties";
import {
	setInventoryItemProperty,
	setInventoryItem,
	InventoryEdits,
} from "../../src/lib/editor/inventory-operations";
import { makeHistorySession } from "../../src/lib/editor/history";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { tinyFixture, fixtureXml, parser } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function required<A>(value: A | undefined): A {
	if (value === undefined) throw Error("Missing fixture value");
	return value;
}
function item(name: string) {
	return required(createCatalogItem(name));
}
function fixture() {
	const document = tinyFixture();
	document.SaveGame.player.items.Item = [
		item("Sneakers"),
		item("Rusty Sword"),
		item("Parsnip"),
		item("Watering Can"),
		{ "@_xsi:nil": "true", modEmpty: "007" },
	];
	document.SaveGame.player.boots = {
		...item("Sneakers"),
		modData: { tailored: "007" },
		immunityBonus: 777,
	};
	document.SaveGame.player.shirtItem = structuredClone(
		parser.parse(fixtureXml).SaveGame.player.shirtItem,
	);
	return document;
}
const change = (
	entityId: string,
	property: ItemPropertyChange["property"],
	value: unknown,
	ownerId = "host",
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
	it("edits equipped boots field-only, preserves unusual imported values, and keeps no-op redo", () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const id = required(before.equipmentIdentities.host?.boots);
				yield* session.transact(
					setInventoryItemProperty(change(id, "defenseBonus", 7)),
				);
				const expected = structuredClone(original);
				Object.assign(expected.SaveGame.player.boots!, { defenseBonus: 7 });
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
		));
	it("writes weapon, object and bottomless fields independently without touching other saved data", () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				const can = original.SaveGame.player.items.Item[3] as Record<
					string,
					unknown
				>;
				can.IsBottomless = false;
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const sword = required(before.identities.host?.[1]),
					parsnip = required(before.identities.host?.[2]),
					watering = required(before.identities.host?.[3]);
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
				Object.assign(expected.SaveGame.player.items.Item[1]!, {
					minDamage: 8,
					addedPrecision: 4,
					critChance: 0.25,
					knockback: 1.5,
				});
				Object.assign(expected.SaveGame.player.items.Item[2]!, {
					price: 999,
					edibility: -7,
				});
				Object.assign(expected.SaveGame.player.items.Item[3]!, {
					isBottomless: true,
					IsBottomless: true,
				});
				expect((yield* session.snapshot).document).toEqual(expected);
				for (const _ of requests) yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
			}),
		));
	it("preserves alpha, unknown color members and mirror presence while coloring equipped clothes", () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				const shirt = original.SaveGame.player.shirtItem as Record<
					string,
					unknown
				>;
				shirt.isPrismatic = false;
				shirt.clothesColor = {
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
							required(before.equipmentIdentities.host?.shirtItem),
							"clothesColor",
							"#aabbcc",
						),
					),
				);
				const expected = structuredClone(original);
				(
					expected.SaveGame.player.shirtItem as Record<string, unknown>
				).clothesColor = {
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
				delete (shirt.clothesColor as Record<string, unknown>).PackedValue;
				expect(
					getItemPropertyFields(shirt, { _type: "Shirt" }).find(
						(field) => field.property === "clothesColor",
					)?.value,
				).toBe("#010203");
			}),
		));
	it("does not advertise or initialize missing, malformed, unsupported or prismatic properties", () => {
		const boots = {
			...item("Sneakers"),
			defenseBonus: undefined,
			immunityBonus: "custom",
		};
		expect(getItemPropertyFields(boots, { _type: "Boots" })).toEqual([]);
		expect(
			getItemPropertyFields(
				{
					"@_xsi:type": "Clothing",
					isPrismatic: true,
					clothesColor: { R: 0, G: 0, B: 0, A: 255 },
				},
				{ _type: "Shirt" },
			),
		).toEqual([]);
		expect(
			getItemPropertyFields(
				{ "@_xsi:type": "ColoredObject", color: { R: 1, G: 2, B: 3 } },
				{ _type: "Object" },
			),
		).toEqual([]);
		expect(
			getItemPropertyFields(item("Sneakers"), { _type: "Object" }),
		).toEqual([]);
		expect(getItemPropertyFields(item("Sneakers"))).toEqual([]);
	});
	it("validates own request values and rejects cross-family, missing-field and stale-owner writes without publication", () =>
		run(
			Effect.gen(function* () {
				for (const input of [
					{
						ownerId: "host",
						entityId: "id",
						property: "defenseBonus",
						value: 100,
					},
					{ ownerId: "host", entityId: "id", property: "price", value: -1 },
					{
						ownerId: "host",
						entityId: "id",
						property: "minDamage",
						value: 0.5,
					},
					{ ownerId: "host", entityId: "id", property: "color", value: "bad" },
					Object.create({
						ownerId: "host",
						entityId: "id",
						property: "defenseBonus",
						value: 1,
					}),
				])
					expect(Result.isFailure(decodeItemPropertyChange(input))).toBe(true);
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				for (const request of [
					change(required(before.identities.host?.[1]), "defenseBonus", 2),
					change(required(before.identities.host?.[0]), "price", 2),
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
		));
	it("follows its equipped instance into a backpack and rejects the old owner after a cross-farmer transfer", () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				const guest = required(
					(original.SaveGame.farmhands &&
						original.SaveGame.farmhands.Farmer[0]) ||
						undefined,
				);
				guest.items.Item = [{ "@_xsi:nil": "true" }];
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const bootsId = required(before.equipmentIdentities.host?.boots);
				yield* session.execute([
					{
						type: "backpack-move",
						ownerId: "host",
						entityId: bootsId,
						toOwnerId: "guest",
						toEntityId: required(before.identities.guest?.[0]),
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
					setInventoryItemProperty(change(bootsId, "defenseBonus", 6, "guest")),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.farmhands,
				).toMatchObject({
					Farmer: [
						{ items: { Item: [{ defenseBonus: 6, immunityBonus: 777 }] } },
					],
				});
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(original);
			}),
		));
	it("rejects unapproved temporary type changes before authorizing a property edit", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const forged = Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					(
						snapshot.state.document.SaveGame.player.items.Item[1] as Record<
							string,
							unknown
						>
					)["@_xsi:type"] = "Boots";
					yield* draft.replace(snapshot);
					yield* setInventoryItemProperty(
						change(required(before.identities.host?.[1]), "defenseBonus", 3),
					);
				});
				expect(
					Result.isFailure(yield* Effect.result(session.transact(forged))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it("rejects temporary or later trinket context changes rather than authorizing seeds for another RNG", () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				original.SaveGame.player.trinketItem = {
					...item("FairyBox"),
					generationSeed: 1,
				};
				original.SaveGame.useLegacyRandom = false;
				original.SaveGame.player.totalMoneyEarned = 1000;
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const id = required(before.equipmentIdentities.host?.trinketItem);
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
		));
});

it("reads the game's effective Bottomless alias and edits only existing mirrors", () =>
	run(
		Effect.gen(function* () {
			const original = fixture();
			const can = original.SaveGame.player.items.Item[3] as Record<
				string,
				unknown
			>;
			can.isBottomless = false;
			can.IsBottomless = true;
			expect(
				getItemPropertyFields(can, { _type: "Tool" }).find(
					(field) => field.property === "isBottomless",
				)?.value,
			).toBe(true);
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			yield* session.transact(
				setInventoryItemProperty(
					change(required(before.identities.host?.[3]), "isBottomless", false),
				),
			);
			expect(
				(yield* session.snapshot).document.SaveGame.player.items.Item[3],
			).toMatchObject({ isBottomless: false, IsBottomless: false });
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(original);
			delete can.isBottomless;
			const upperOnly = yield* makeHistorySession(original);
			const upperBefore = yield* upperOnly.snapshot;
			yield* upperOnly.transact(
				setInventoryItemProperty(
					change(
						required(upperBefore.identities.host?.[3]),
						"isBottomless",
						false,
					),
				),
			);
			const upperAfter = (yield* upperOnly.snapshot).document.SaveGame.player
				.items.Item[3] as Record<string, unknown>;
			expect(upperAfter.IsBottomless).toBe(false);
			expect(Object.hasOwn(upperAfter, "isBottomless")).toBe(false);
			can.IsBottomless = "custom";
			expect(getItemPropertyFields(can, { _type: "Tool" })).toEqual([]);
		}),
	));

it("rolls back a compound property attempt and closes escaped property authority", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const before = yield* session.snapshot;
			let captured: typeof InventoryEdits.Service | undefined;
			const request = change(
				required(before.equipmentIdentities.host?.boots),
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
	));

it("guards owner income as trinket authorization context before and after an edit", () =>
	run(
		Effect.gen(function* () {
			const original = fixture();
			original.SaveGame.player.trinketItem = {
				...item("ParrotEgg"),
				generationSeed: 1,
			};
			original.SaveGame.player.totalMoneyEarned = 0;
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			const id = required(before.equipmentIdentities.host?.trinketItem);
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
	));

it("edits colored-object stack and quality without touching color or opaque metadata", () =>
	run(
		Effect.gen(function* () {
			const original = fixture();
			original.SaveGame.player.items.Item[2] = {
				...item("Parsnip"),
				"@_xsi:type": "ColoredObject",
				color: { R: 1, G: 2, B: 3, A: 77, opaque: "007" },
				modData: { custom: false },
			};
			const session = yield* makeHistorySession(original);
			const before = yield* session.snapshot;
			const entityId = required(before.identities.host?.[2]);
			yield* session.transact(
				setInventoryItem({
					ownerId: "host",
					entityId,
					property: "stack",
					value: 18,
				}),
			);
			yield* session.transact(
				setInventoryItem({
					ownerId: "host",
					entityId,
					property: "quality",
					value: 4,
				}),
			);
			const expected = structuredClone(original);
			Object.assign(expected.SaveGame.player.items.Item[2]!, {
				stack: 18,
				quality: 4,
			});
			expect((yield* session.snapshot).document).toEqual(expected);
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(original);
		}),
	));

it("uses missing game defaults but refuses malformed trinket context without repairing it", () => {
	const document = fixture();
	expect(readItemPropertyContext(document, document.SaveGame.player)).toEqual({
		useLegacyRandom: false,
		totalMoneyEarned: 0,
	});
	document.SaveGame.player.totalMoneyEarned = 1.5;
	expect(
		readItemPropertyContext(document, document.SaveGame.player),
	).toBeUndefined();
	document.SaveGame.player.totalMoneyEarned = 0;
	document.SaveGame.useLegacyRandom = "false";
	expect(
		readItemPropertyContext(document, document.SaveGame.player),
	).toBeUndefined();
	expect(document.SaveGame.useLegacyRandom).toBe("false");
});
