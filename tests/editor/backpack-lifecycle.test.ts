import { describe, expect, it } from "vitest";
import { Effect, Result, Schema } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	catalogEntries,
	createCatalogItem,
	searchCatalog,
} from "../../src/lib/editor/item-catalog";
import { openEditor } from "../../src/lib/editor/editor-model";
import type { BackpackLifecycleRequest } from "../../src/lib/editor/backpack-lifecycle";
import { tinyFixture, parser, exportDocument, fixtureXml } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function required<A>(value: A | undefined): A {
	if (value === undefined) throw Error("Missing fixture handle");
	return value;
}

// These are construction defaults for new items, never assertions that imported
// counterparts should be normalized to the same fields or catalog values.
describe("proxy-free item catalog", () => {
	it("constructs plain records for every listed family without sharing mutable preview authority", () => {
		expect(catalogEntries.length).toBeGreaterThan(1000);
		expect(new Set(catalogEntries.map((entry) => entry.id)).size).toBe(
			catalogEntries.length,
		);
		expect(new Set(catalogEntries.map((entry) => entry.kind))).toEqual(
			new Set([
				"Object",
				"BigCraftable",
				"Boots",
				"Furniture",
				"Hat",
				"Mannequin",
				"Pants",
				"Shirt",
				"Tool",
				"Trinket",
				"Weapon",
			]),
		);
		for (const entry of catalogEntries) {
			const item = required(createCatalogItem(entry.id));
			expect(Schema.is(Schema.Json)(item)).toBe(true);
			expect(item["@_xsi:type"]).toBeTruthy();
			expect(item.stack).toBe(1);
			expect(item).not.toBe(entry.raw);
		}
		const wood = required(catalogEntries.find((entry) => entry.id === "Wood"));
		wood.raw.modData = { injected: "no" };
		expect(createCatalogItem("Wood")).not.toHaveProperty("modData");
		delete wood.raw.modData;
	});
	it("retains game-specific object, tool, boots and preserved-product construction fields", () => {
		expect(createCatalogItem("Parsnip")).toMatchObject({
			"@_xsi:type": "Object",
			itemId: "24",
			bigCraftable: false,
			category: -75,
			quality: 0,
		});
		expect(createCatalogItem("Sneakers")).toMatchObject({
			"@_xsi:type": "Boots",
			defenseBonus: 1,
			immunityBonus: 0,
		});
		expect(createCatalogItem("Iridium Watering Can")).toMatchObject({
			"@_xsi:type": "WateringCan",
			upgradeLevel: 4,
			isBottomless: false,
			IsBottomless: false,
		});
		const flavored = required(
			catalogEntries.find(
				(entry) =>
					entry.raw.preserve === "Wine" &&
					entry.raw.preservedParentSheetIndex !== undefined,
			),
		);
		expect(createCatalogItem(flavored.id)).toMatchObject({
			preserve: "Wine",
			preservedParentSheetIndex: flavored.raw.preservedParentSheetIndex,
		});
		const colored = required(
			catalogEntries.find(
				(entry) => entry.raw["@_xsi:type"] === "ColoredObject",
			),
		);
		expect(createCatalogItem(colored.id)).toMatchObject({
			color: {
				R: expect.any(Number),
				G: expect.any(Number),
				B: expect.any(Number),
				A: 255,
			},
		});
		expect(createCatalogItem("not a catalog choice")).toBeUndefined();
		for (const name of [
			"Copper Trash Can",
			"Chest",
			"Big Chest",
			"Garden Pot",
			"Cask",
			"Crab Pot",
			"Slingshot",
			"Oak Table",
		])
			expect(createCatalogItem(name)).toBeUndefined();
		expect(createCatalogItem("Advanced Iridium Rod")).toMatchObject({
			"@_xsi:type": "FishingRod",
			upgradeLevel: 4,
			initialParentTileIndex: 17,
			numAttachmentSlots: 3,
			attachments: {
				Object: [
					{ "@_xsi:nil": "true" },
					{ "@_xsi:nil": "true" },
					{ "@_xsi:nil": "true" },
				],
			},
		});
		expect(createCatalogItem("Small Crystal")).toMatchObject({
			furniture_type: 8,
			boundingBox: { Width: 64, Height: 64 },
			defaultBoundingBox: { Width: 64, Height: 64 },
		});
		expect(createCatalogItem("Iridium Pan")).toMatchObject({
			"@_xsi:type": "Pan",
			upgradeLevel: 4,
		});
		expect(createCatalogItem("Smoked Goby")).toMatchObject({
			preserve: "SmokedFish",
			preservedParentSheetIndex: "Goby",
		});
		expect(createCatalogItem("Powdermelon Wine")).toMatchObject({
			preserve: "Wine",
			preservedParentSheetIndex: "Powdermelon",
		});
	});
	it("finds qualified and unqualified IDs, ranks exact names first and keeps flavored IDs distinct", () => {
		expect(searchCatalog("wood")[0]?.id).toBe("Wood");
		expect(searchCatalog("388").some((entry) => entry.id === "Wood")).toBe(
			true,
		);
		expect(
			searchCatalog("(BC)12").every((entry) => entry.qualifiedId === "(BC)12"),
		).toBe(true);
		expect(searchCatalog("ring").length).toBeGreaterThan(4);
		expect(
			searchCatalog("", "Boots").every((entry) => entry.kind === "Boots"),
		).toBe(true);
		const flavors = catalogEntries.filter(
			(entry) => entry.raw.preserve === "Wine",
		);
		expect(new Set(flavors.map((entry) => entry.id)).size).toBe(flavors.length);
		expect(
			new Set(flavors.map((entry) => entry.qualifiedId)).size,
		).toBeLessThan(flavors.length);
	});
});

describe("backpack creation and removal", () => {
	it("adds only into the selected empty entity, exports exact defaults and restores original nil representation on Undo", () =>
		run(
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.player.items.Item[1] = {
					"@_xsi:nil": "true",
					modSlot: "0007",
				};
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const empty = required(before.identities.host?.[1]);
				yield* session.execute([
					{
						type: "backpack-add",
						farmerId: "host",
						entityId: empty,
						catalogId: "Parsnip",
					},
				]);
				const added = yield* session.snapshot;
				expect(added.document.SaveGame.player.items.Item[1]).toEqual(
					createCatalogItem("Parsnip"),
				);
				expect(added.identities.host?.[1]).not.toBe(empty);
				const expected = structuredClone(document);
				expected.SaveGame.player.items.Item[1] = required(
					createCatalogItem("Parsnip"),
				);
				expect(added.document).toEqual(expected);
				expect(parser.parse(exportDocument(added.document))).toEqual(
					parser.parse(exportDocument(expected)),
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(added.document);
				expect((yield* session.snapshot).identities).toEqual(added.identities);
			}),
		));
	it("removes opaque items as a whole and Undo restores every field and identity", () =>
		run(
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.player.items.Item[0] = {
					"@_xsi:type": "ModdedItem",
					itemId: "mystery",
					payload: { nested: ["0007", 7] },
					quality: 3,
				};
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const entityId = required(before.identities.host?.[0]);
				yield* session.execute([
					{ type: "backpack-remove", farmerId: "host", entityId },
				]);
				const removed = yield* session.snapshot;
				expect(removed.document.SaveGame.player.items.Item[0]).toEqual({
					"@_xsi:nil": "true",
				});
				expect(removed.identities.host?.[0]).not.toBe(entityId);
				expect(removed.document.SaveGame.player.items.Item.slice(1)).toEqual(
					document.SaveGame.player.items.Item.slice(1),
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(document);
				expect((yield* session.snapshot).identities).toEqual(before.identities);
			}),
		));
	it("rejects occupied, stale, wrong-owner and unknown-catalog requests without touching history or redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				const before = yield* session.snapshot;
				const empty = required(before.identities.host?.[1]);
				const occupied = required(before.identities.host?.[0]);
				for (const request of [
					{
						type: "backpack-add",
						farmerId: "host",
						entityId: occupied,
						catalogId: "Wood",
					},
					{
						type: "backpack-add",
						farmerId: "host",
						entityId: empty,
						catalogId: "unknown",
					},
					{
						type: "backpack-add",
						farmerId: "guest",
						entityId: empty,
						catalogId: "Wood",
					},
					{ type: "backpack-remove", farmerId: "host", entityId: empty },
					{ type: "backpack-remove", farmerId: "host", entityId: "item:stale" },
				] satisfies BackpackLifecycleRequest[]) {
					expect(
						Result.isFailure(yield* Effect.result(session.execute([request]))),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
				yield* session.execute([
					{
						type: "backpack-add",
						farmerId: "host",
						entityId: empty,
						catalogId: "Wood",
					},
				]);
				const added = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{
									type: "backpack-add",
									farmerId: "host",
									entityId: empty,
									catalogId: "Parsnip",
								},
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(added);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.execute([
								{
									type: "backpack-remove",
									farmerId: "host",
									entityId: required(added.identities.host?.[1]),
								},
							]),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(undone);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(added.document);
			}),
		));
	it("resolves empty and occupied handles through reorder and preserves malformed unrelated owners", () =>
		run(
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.farmhands = {
					Farmer: [
						null,
						{ UniqueMultiplayerID: { toString: 0 }, items: "opaque" },
					] as never,
				};
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const empty = required(before.identities.host?.[1]);
				yield* session.execute([
					{ type: "reorder", farmerId: "host", order: [1, 2, 0] },
				]);
				yield* session.execute([
					{
						type: "backpack-add",
						farmerId: "host",
						entityId: empty,
						catalogId: "Parsnip",
					},
				]);
				const added = yield* session.snapshot;
				expect(added.document.SaveGame.player.items.Item[0]).toMatchObject({
					name: "Parsnip",
				});
				expect(added.document.SaveGame.farmhands).toEqual(
					document.SaveGame.farmhands,
				);
				yield* session.execute([
					{
						type: "backpack-remove",
						farmerId: "host",
						entityId: required(added.identities.host?.[0]),
					},
				]);
				expect(
					(yield* session.snapshot).document.SaveGame.player.items.Item[0],
				).toEqual({ "@_xsi:nil": "true" });
			}),
		));
	it("validates own schema fields and rolls back a compound request if a later slot operation fails", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture());
				const before = yield* session.snapshot;
				const empty = required(before.identities.host?.[1]);
				const inherited = Object.create({
					farmerId: "host",
					entityId: empty,
					catalogId: "Wood",
				});
				inherited.type = "backpack-add";
				const failed = yield* Effect.result(
					session.execute([
						{
							type: "backpack-add",
							farmerId: "host",
							entityId: empty,
							catalogId: "Wood",
						},
						{
							type: "backpack-add",
							farmerId: "host",
							entityId: empty,
							catalogId: "Parsnip",
						},
					]),
				);
				expect(Result.isFailure(failed)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				expect(
					Result.isFailure(yield* Effect.result(session.execute([inherited]))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
});

// The command returns its own committed handle pair even when Undo is already
// queued behind it. UI selection can follow that lineage without a racy reread.
// Full-save import, projection and several queued history revisions need the same
// bounded CI budget as the other application integration tests (25 seconds).
it("returns exact replacement lineage before a queued Undo and preserves raw instances", async () => {
	const original = parser.parse(fixtureXml);
	const farmerId = String(original.SaveGame.player.UniqueMultiplayerID);
	const slot = original.SaveGame.player.items.Item.findIndex(
		(item) => item && typeof item === "object" && "@_xsi:nil" in item,
	);
	if (slot < 0) throw Error("Expected empty full-save slot");
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(original)),
		{},
		{ validateExport: false },
	);
	try {
		const before = await opened.model.snapshot();
		const empty = required(before.identities[farmerId]?.[slot]);
		const addition = opened.model.commands.changeBackpackSlot({
			type: "backpack-add",
			farmerId,
			entityId: empty,
			catalogId: "Wood",
		});
		const undo = opened.model.commands.undo();
		const result = await addition;
		expect(result && Result.isSuccess(result)).toBe(true);
		if (!result || Result.isFailure(result))
			throw Error("Expected successful slot replacement");
		expect(result.success).toMatchObject({
			farmerId,
			previousEntityId: empty,
		});
		expect(result.success.entityId).not.toBe(empty);
		await undo;
		expect((await opened.model.snapshot()).identities[farmerId]?.[slot]).toBe(
			empty,
		);
		await opened.model.commands.redo();
		expect((await opened.model.snapshot()).identities[farmerId]?.[slot]).toBe(
			result.success.entityId,
		);
		const removal = await opened.model.commands.changeBackpackSlot({
			type: "backpack-remove",
			farmerId,
			entityId: result.success.entityId,
		});
		expect(removal && Result.isSuccess(removal)).toBe(true);
		if (!removal || Result.isFailure(removal))
			throw Error("Expected successful removal");
		expect(removal.success.previousEntityId).toBe(result.success.entityId);
		expect((await opened.model.snapshot()).identities[farmerId]?.[slot]).toBe(
			removal.success.entityId,
		);
	} finally {
		await opened.close();
	}
}, 25_000);
