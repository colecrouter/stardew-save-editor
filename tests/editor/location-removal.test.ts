import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { tinyFixture } from "../helpers/editor-document.ts";

it.effect(
	"clears only matching full footprints and keeps reindexed chest handles through Undo",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const chest = {
				$type: "StardewValley.Objects.Chest",
				name: "Chest",
				items: [{ $type: "StardewValley.Object", itemId: "388", stack: 7 }],
			} as const;
			const farm = {
				$type: "StardewValley.Farm",
				name: "Farm",
				objects: [
					{
						key: { X: 2, Y: 3 },
						value: {
							$type: "StardewValley.Object",
							name: "Stone",
							category: -999,
						},
					},
					{
						key: { X: 3, Y: 3 },
						value: {
							...chest,
							items: chest.items.map((item) => ({ ...item })),
						},
					},
				],
				terrainFeatures: [
					{
						key: { X: 2, Y: 4 },
						value: { $type: "StardewValley.TerrainFeatures.Grass" },
					},
					{
						key: { X: 3, Y: 4 },
						value: {
							$type: "StardewValley.TerrainFeatures.Tree",
							treeType: "1",
							tapped: true,
						},
					},
					{
						key: { X: 4, Y: 4 },
						value: {
							$type: "StardewValley.TerrainFeatures.Tree",
							treeType: "1",
						},
					},
				],
				resourceClumps: [
					{
						$type: "StardewValley.TerrainFeatures.ResourceClump",
						parentSheetIndex: 602,
						tile: { X: 4, Y: 4 },
						width: 2,
						height: 2,
					},
				],
			} satisfies NonNullable<typeof document.SaveGame.locations>[number];
			document.SaveGame.locations = [farm];

			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const originalOwner = "chest:locations.0.objects.1";
			const reindexedOwner = "chest:locations.0.objects.0";
			// The clump crosses the selection edge. Grass and the tapped tree stay
			// even though their anchor tiles are also inside the selected rectangle.
			yield* session.execute([
				{
					type: "farm-obstacles-remove",
					locationIndex: 0,
					scope: { left: 2, top: 3, right: 4, bottom: 5 },
					groups: ["debris", "trees"],
				},
			]);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.locations?.[0]).toEqual({
				...farm,
				objects: farm.objects.slice(1),
				terrainFeatures: farm.terrainFeatures.slice(0, 2),
			});
			expect(before.identities[originalOwner]).toHaveLength(36);
			expect(after.identities[reindexedOwner]).toEqual(
				before.identities[originalOwner],
			);
			expect(after.identities[originalOwner]).toBeUndefined();

			yield* session.undo;
			const undone = yield* session.snapshot;
			expect(undone.document).toEqual(before.document);
			expect(undone.identities).toEqual(before.identities);
		}),
);

it.effect(
	"removes flooring under a chest without touching the chest or adjacent paths",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const tile = { X: 2, Y: 3 };
			const floor = {
				$type: "StardewValley.TerrainFeatures.Flooring",
				whichFloor: "8",
			} as const;
			const farm = {
				$type: "StardewValley.Farm",
				name: "Farm",
				objects: [
					{
						key: tile,
						value: {
							$type: "StardewValley.Objects.Chest",
							name: "Chest",
							items: [],
						},
					},
				],
				terrainFeatures: [
					{ key: tile, value: floor },
					{ key: { X: 3, Y: 3 }, value: { ...floor, whichFloor: "9" } },
				],
			} satisfies NonNullable<typeof document.SaveGame.locations>[number];
			document.SaveGame.locations = [farm];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;

			// The path and chest share a coordinate but live in separate dictionaries.
			yield* session.execute([
				{
					type: "farm-obstacles-remove",
					locationIndex: 0,
					scope: { left: 2, right: 3, top: 3, bottom: 3 },
					groups: ["flooring"],
					materials: ["8"],
				},
			]);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.locations?.[0]).toEqual({
				...farm,
				terrainFeatures: farm.terrainFeatures.slice(1),
			});
			expect(after.identities).toEqual(before.identities);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);
