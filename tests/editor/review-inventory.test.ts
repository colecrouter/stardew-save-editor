import { Effect } from "effect";
import { it } from "@effect/vitest";
import { expect, expectTypeOf } from "vitest";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	projectInventoryReview,
	type InventoryItemFieldChange,
	type InventoryReviewFields,
} from "../../src/lib/editor/review-inventory";
import type { ItemPropertyChange } from "../../src/lib/editor/item-properties";
import {
	setInventoryItem,
	setInventoryItemProperty,
} from "../../src/lib/editor/inventory-operations";

import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { discoverPlacedChests } from "../../src/lib/editor/chest-storage";
import { tinyFixture } from "../helpers/editor-document.ts";

// These assertions are checked by the application compiler, independently of
// runtime examples. Weakening field/value correlation makes this tuple invalid.
type Assert<Truth extends true> = Truth;
type InventoryReviewTypeChecks = [
	Assert<
		boolean extends Extract<
			InventoryItemFieldChange,
			{ field: "quantity" }
		>["before"]
			? false
			: true
	>,
	Assert<
		Extract<
			InventoryItemFieldChange,
			{ field: "isBottomless" }
		>["after"] extends boolean | null
			? true
			: false
	>,
	Assert<
		Extract<InventoryItemFieldChange, { field: "color" }>["after"] extends
			| string
			| null
			? true
			: false
	>,
	Assert<
		"unknown" extends Extract<
			InventoryItemFieldChange,
			{ field: "trinket:type" }
		>["after"]
			? false
			: true
	>,
	Assert<
		Exclude<
			ItemPropertyChange["property"],
			keyof InventoryReviewFields
		> extends never
			? true
			: false
	>,
];

it("keeps review field values correlated with the editable request contract", () => {
	expectTypeOf<InventoryReviewTypeChecks>().toEqualTypeOf<
		[true, true, true, true, true]
	>();
});

const required = <A>(value: A | undefined): A => {
	if (value === undefined)
		throw new Error("Missing inventory review fixture value");
	return value;
};
function item(name = "Parsnip") {
	return required(createCatalogItem(name));
}
function fixture() {
	const document = tinyFixture();
	document.SaveGame.player.name = "Host";
	document.SaveGame.player.items = [
		{ ...item(), stack: 3, quality: 0, customModData: { opaque: "007" } },
		null,
		item("Sneakers"),
	];
	document.SaveGame.farmhands = [
		{
			...structuredClone(document.SaveGame.player),
			UniqueMultiplayerID: 2n,
			name: "Guest",
			items: [null],
		},
	];
	return document;
}

it.effect(
	"compares repeated quantity edits with import and disappears after restoration and Undo",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const initial = yield* session.snapshot;
			const entityId = required(initial.identities["1"]?.[0]);
			for (const value of [8, 9])
				yield* session.transact(
					setInventoryItem({
						ownerId: "1",
						entityId,
						property: "stack",
						value,
					}),
				);
			const current = yield* session.snapshot,
				beforeProjection = structuredClone(current);
			expect(projectInventoryReview(current).changes).toEqual([
				expect.objectContaining({
					_tag: "ItemFieldChanged",
					field: "quantity",
					before: 3,
					after: 9,
				}),
			]);
			expect(current).toEqual(beforeProjection);
			yield* session.transact(
				setInventoryItem({
					ownerId: "1",
					entityId,
					property: "stack",
					value: 3,
				}),
			);
			expect(projectInventoryReview(yield* session.snapshot).changes).toEqual(
				[],
			);
			yield* session.undo;
			expect(projectInventoryReview(yield* session.snapshot).changes).toEqual([
				expect.objectContaining({ before: 3, after: 9 }),
			]);
		}),
);

it.effect(
	"retains original instance identities after history eviction and distinguishes transfer from add/remove",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture(), { entries: 1 });
			const initial = yield* session.snapshot;
			const entityId = required(initial.identities["1"]?.[0]);
			yield* session.execute([
				{
					type: "item-move",
					ownerId: "1",
					slot: 0,
					toOwnerId: "2",
					toSlot: 0,
				},
			]);
			yield* session.execute([{ type: "farm-name", value: "Changed" }]);
			const state = yield* session.snapshot;
			expect(state.dropped).toBe(1);
			expect(state.baselineIdentities).toEqual(initial.identities);
			expect(projectInventoryReview(state).changes).toEqual([
				expect.objectContaining({
					_tag: "ItemMoved",
					item: { id: entityId, name: "Parsnip" },
					before: "Host · Backpack · Slot 1",
					after: "Guest · Backpack · Slot 1",
				}),
			]);
		}),
);

it.effect(
	"shows new and removed instances without matching equal item type IDs",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const initial = yield* session.snapshot,
				entityId = required(initial.identities["1"]?.[0]);
			yield* session.execute([
				{ type: "item-remove", ownerId: "1", slot: 0, entityId },
				{
					type: "item-place",
					ownerId: "1",
					slot: 1,
					item: { ...item(), stack: 7 },
				},
			]);
			const review = projectInventoryReview(yield* session.snapshot);
			expect(review.changes).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						_tag: "ItemRemoved",
						quantity: 3,
						location: "Host · Backpack · Slot 1",
					}),
					expect.objectContaining({
						_tag: "ItemAdded",
						quantity: 7,
						location: "Host · Backpack · Slot 2",
					}),
				]),
			);
			expect(review.changes.some((row) => row._tag === "ItemMoved")).toBe(
				false,
			);
		}),
);

it.effect(
	"recognizes equipment moves by the original instance rather than a slot name",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const initial = yield* session.snapshot,
				entityId = required(initial.identities["1"]?.[2]);
			yield* session.execute([
				{
					type: "backpack-move",
					ownerId: "1",
					entityId,
					toOwnerId: "1",
					toEntityId: required(initial.equipmentIdentities["1"]).boots,
					toLocation: "boots",
				},
			]);
			expect(projectInventoryReview(yield* session.snapshot).changes).toEqual([
				expect.objectContaining({
					_tag: "ItemMoved",
					before: "Host · Backpack · Slot 3",
					after: "Host · Boots",
				}),
			]);
		}),
);

it.effect(
	"recognizes placed-chest transfers while preserving opaque chest and item metadata",
	() =>
		Effect.gen(function* () {
			const document = fixture();
			document.SaveGame.locations = [
				{
					$type: "StardewValley.Farm",
					name: "Farm",
					objects: [
						{
							key: { X: 3, Y: 7 },
							value: {
								$type: "StardewValley.Objects.Chest",
								name: "Chest",
								items: [item("Wood")],
								customModData: { opaque: "007" },
							},
						},
					],
				},
			];
			const chest = required(discoverPlacedChests(document)[0]);
			const session = yield* makeHistorySession(document),
				initial = yield* session.snapshot;
			const id = required(initial.identities[chest.id]?.[0]);
			yield* session.execute([
				{
					type: "item-move",
					ownerId: chest.id,
					slot: 0,
					toOwnerId: "1",
					toSlot: 1,
					entityId: id,
				},
			]);
			const changes = projectInventoryReview(yield* session.snapshot).changes;
			expect(changes).toContainEqual(
				expect.objectContaining({
					_tag: "ItemMoved",
					item: { id, name: "Wood" },
					after: "Host · Backpack · Slot 2",
				}),
			);
		}),
);

it.effect(
	"uses editable item property labels and leaves unrecognized metadata changes uncovered",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture()),
				initial = yield* session.snapshot;
			const entityId = required(initial.identities["1"]?.[2]);
			yield* session.transact(
				setInventoryItemProperty({
					ownerId: "1",
					entityId,
					property: "defenseBonus",
					value: 7,
				}),
			);

			const state = yield* session.snapshot;
			// This detached import-like state exercises unknown-field fallback without
			// asking a supported inventory command to authorize a mod-data write.
			const boots = state.document.SaveGame.player.items[2];
			if (!boots || typeof boots !== "object") throw new Error("Missing boots");
			Object.assign(boots, { customModData: { newOpaque: "changed" } });
			state.net = [
				...state.net,
				{
					op: "add",
					path: "/SaveGame/player/items/2/customModData",
					value: { newOpaque: "changed" },
				},
			];
			const review = projectInventoryReview(state);
			expect(review.changes).toContainEqual(
				expect.objectContaining({
					_tag: "ItemFieldChanged",
					field: "defenseBonus",
					label: "Defense",
					before: 1,
					after: 7,
				}),
			);
			expect(review.coveredPaths).toContain(
				"/SaveGame/player/items/2/defenseBonus",
			);
			expect(review.coveredPaths.some((path) => path.includes("modData"))).toBe(
				false,
			);
		}),
);

it.effect(
	"does not show handle-only swaps or equal-value replacement as exported inventory changes",
	() =>
		Effect.gen(function* () {
			const document = fixture();
			const copy = { ...item(), stack: 3, quality: 0 };
			document.SaveGame.player.items = [copy, structuredClone(copy)];
			const session = yield* makeHistorySession(document);
			yield* session.execute([
				{ type: "reorder", ownerId: "1", order: [1, 0] },
				{ type: "farm-name", value: "Changed" },
			]);
			expect(projectInventoryReview(yield* session.snapshot).changes).toEqual(
				[],
			);
			yield* session.execute([
				{ type: "item-remove", ownerId: "1", slot: 0 },
				{
					type: "item-place",
					ownerId: "1",
					slot: 0,
					item: structuredClone(copy),
				},
			]);
			expect(projectInventoryReview(yield* session.snapshot).changes).toEqual(
				[],
			);
		}),
);

it.effect(
	"never lets an unchanged swapped item cover unknown edits on the displaced item",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const initial = yield* session.snapshot;
			yield* session.execute([
				{
					type: "backpack-move",
					ownerId: "1",
					entityId: required(initial.identities["1"]?.[0]),
					toOwnerId: "1",
					toEntityId: required(initial.identities["1"]?.[2]),
				},
			]);
			const state = yield* session.snapshot;
			const displaced = state.document.SaveGame.player.items[0];
			if (!displaced || typeof displaced !== "object")
				throw new Error("Missing displaced item");
			Object.assign(displaced, {
				customModData: { opaque: "changed after swap" },
			});
			state.net = [
				...state.net,
				{
					op: "add",
					path: "/SaveGame/player/items/0/customModData",
					value: { opaque: "changed after swap" },
				},
			];
			const review = projectInventoryReview(state);
			expect(
				review.changes.filter((change) => change._tag === "ItemMoved"),
			).toHaveLength(2);
			const opaquePath = "/SaveGame/player/items/0/customModData";
			expect(
				review.coveredPaths.some(
					(path) => opaquePath === path || opaquePath.startsWith(`${path}/`),
				),
			).toBe(false);
		}),
);

it.effect(
	"does not cover a removed slot when a moved survivor acquires unknown metadata there",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			yield* session.execute([
				{ type: "item-remove", ownerId: "1", slot: 0 },
				{
					type: "item-move",
					ownerId: "1",
					slot: 2,
					toOwnerId: "1",
					toSlot: 0,
				},
			]);
			const state = yield* session.snapshot;
			const survivor = state.document.SaveGame.player.items[0];
			if (!survivor || typeof survivor !== "object")
				throw new Error("Missing moved survivor");
			Object.assign(survivor, {
				customModData: { opaque: "changed after removal" },
			});
			state.net = [
				...state.net,
				{
					op: "add",
					path: "/SaveGame/player/items/0/customModData",
					value: { opaque: "changed after removal" },
				},
			];
			const review = projectInventoryReview(state);
			expect(review.changes).toContainEqual(
				expect.objectContaining({
					_tag: "ItemRemoved",
					item: expect.objectContaining({ name: "Parsnip" }),
				}),
			);
			expect(review.changes).toContainEqual(
				expect.objectContaining({
					_tag: "ItemMoved",
					item: expect.objectContaining({ name: "Sneakers" }),
				}),
			);
			const opaquePath = "/SaveGame/player/items/0/customModData";
			expect(
				review.coveredPaths.some(
					(path) => opaquePath === path || opaquePath.startsWith(`${path}/`),
				),
			).toBe(false);
		}),
);

it.effect(
	"does not claim an unsupported scalar hidden by an unavailable property value",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const initial = yield* session.snapshot;
			const entityId = required(initial.identities["1"]?.[2]);
			yield* session.transact(
				setInventoryItemProperty({
					ownerId: "1",
					entityId,
					property: "defenseBonus",
					value: 7,
				}),
			);
			const state = yield* session.snapshot;
			const boots = state.baseline.SaveGame.player.items[2];
			if (!boots || typeof boots !== "object") throw new Error("Missing boots");
			// Simulate an imported unknown scalar without authorizing a malformed write.
			Object.assign(boots, { defenseBonus: "modded" });
			const review = projectInventoryReview(state);
			expect(review.coveredPaths).not.toContain(
				"/SaveGame/player/items/2/defenseBonus",
			);
		}),
);
