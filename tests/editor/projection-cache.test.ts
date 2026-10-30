import { get } from "svelte/store";
import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	EditorOperations,
	coreOperations,
} from "../../src/lib/editor/operations";
import { setFarmSettings } from "../../src/lib/editor/farm-operations";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations";
import { readChests } from "../../src/lib/editor/inventory-views";
import { XMLCodec } from "../../src/lib/xmlCodec";
import { fixtureXml, parser, tinyFixture } from "./fixtures";

const locations = () => ({
	GameLocation: [
		{
			name: "Cache island",
			objects: {
				item: [
					{
						key: { Vector2: { X: 1, Y: 2 } },
						value: {
							Object: {
								"@_xsi:type": "Chest",
								name: "Chest",
								items: {
									Item: [
										{
											"@_xsi:type": "Object",
											itemId: "388",
											name: "Wood",
											stack: 20,
											quality: 0,
											bigCraftable: false,
											category: -16,
											modData: { opaque: "preserved" },
										},
									],
								},
							},
						},
					},
				],
			},
		},
	],
});
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

it(
	"shares immutable chest views across unrelated edits and invalidates item edits and Undo/Redo",
	{ timeout: 15000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame, { locations: locations() });
		const opened = await openEditor(new XMLCodec().stringify(document));
		try {
			const model = opened.model;
			const original = required(get(model.view));
			const chest = required(original.chests[0]);
			const item = required(chest.slots[0]);
			expect(item).not.toHaveProperty("raw");
			expect(item.quantity).toBe(20);
			// Immutable presentation objects may be shared; neither shallow nor nested
			// mutation can poison the next cache hit. Snapshots remain mutable copies.
			expect(() => Object.assign(item, { quantity: 90 })).toThrow(TypeError);
			expect(() =>
				Object.assign(required(item.visual).sourceRect, { x: 900 }),
			).toThrow(TypeError);
			const snapshot = await model.snapshot();
			snapshot.document.SaveGame.player.farmName = "Only the detached copy";
			const edit = await model.commands.transact(
				setFarmSettings({ name: "Cache test" }),
			);
			expect(edit && Result.isSuccess(edit)).toBe(true);
			const renamed = required(get(model.view));
			expect(renamed.chests).toBe(original.chests);
			expect(renamed.farm.name).toBe("Cache test");
			await model.commands.undo();
			expect(required(get(model.view)).chests).toBe(original.chests);
			await model.commands.redo();
			expect(required(get(model.view)).chests).toBe(original.chests);
			const changed = await model.commands.transact(
				setInventoryItem({
					ownerId: chest.ownerId,
					entityId: item.entityId,
					property: "stack",
					value: 25,
				}),
			);
			expect(changed && Result.isSuccess(changed)).toBe(true);
			const updated = required(get(model.view)).chests;
			expect(updated).not.toBe(original.chests);
			expect(updated[0]?.slots[0]?.quantity).toBe(25);
			await model.commands.undo();
			expect(required(get(model.view)).chests[0]?.slots[0]?.quantity).toBe(20);
			await model.commands.redo();
			expect(required(get(model.view)).chests[0]?.slots[0]?.quantity).toBe(25);
			// Views never carry mod fields, but exports/snapshots still preserve them.
			expect(JSON.stringify((await model.snapshot()).document)).toContain(
				'"opaque":"preserved"',
			);
		} finally {
			await opened.close();
		}
	},
);

it("versions actual committed inputs for custom writes, ID collisions and Undo", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const document = tinyFixture();
				Object.assign(document.SaveGame, { locations: locations() });
				const session = yield* makeHistorySession(document).pipe(
					Effect.provideService(EditorOperations, {
						prepare: (state, action) =>
							coreOperations.prepare(state, action).pipe(
								Effect.map((prepared) => {
									// The action label says farm-name, but a custom adapter also changes
									// world storage. Invalidation must inspect its prepared result.
									if (action.type === "farm-name") {
										const world = locations();
										if (action.value === "World change")
											required(
												required(world.GameLocation[0]).objects.item[0],
											).value.Object.name = "Renamed chest";
										Object.assign(prepared.document.SaveGame, {
											locations: world,
										});
									}
									if (action.type === "money")
										prepared.document.SaveGame.player.UniqueMultiplayerID =
											required(
												readChests({
													...state,
													identities: required(state.inventory).identities,
												})[0],
											).ownerId;
									return prepared;
								}),
							),
					}),
				);
				const before = yield* session.snapshot;
				// Equal replacement data remains shared after publication and does not
				// invalidate merely because the preparer allocated another object.
				const same = yield* session.execute([
					{ type: "farm-name", value: "New" },
				]);
				expect(same.chestRevision).toBe(before.chestRevision);
				const worldChanged = yield* session.execute([
					{ type: "farm-name", value: "World change" },
				]);
				expect(worldChanged.chestRevision).toBeGreaterThan(same.chestRevision);
				expect(readChests(worldChanged)[0]?.name).toContain("Renamed chest");
				const collided = yield* session.execute([
					{ type: "money", farmerId: "host", value: 22 },
				]);
				expect(collided.chestRevision).toBeGreaterThan(same.chestRevision);
				expect(readChests(collided)[0]?.supported).toBe(false);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(undone.chestRevision).toBeGreaterThan(collided.chestRevision);
				expect(readChests(undone)[0]?.supported).toBe(true);
			}),
		),
	));
