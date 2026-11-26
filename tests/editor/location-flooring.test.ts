import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { planFlooringPlacement } from "../../src/lib/editor/location-flooring.ts";
import { readFarmOccupancy } from "../../src/lib/editor/location-placement.ts";
import { readFarmTerrain } from "../../src/lib/editor/location-terrain.ts";
import { tinyFixture } from "../helpers/editor-document.ts";

it.effect(
	"replaces only the chosen material inside the area and undoes it in one step",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const value = {
				$type: "StardewValley.TerrainFeatures.Flooring",
				whichFloor: "8",
				whichView: 13,
			} as const;
			const farm = {
				$type: "StardewValley.Farm",
				name: "Farm",
				terrainFeatures: [
					{ key: { X: 7, Y: 14 }, value },
					{ key: { X: 8, Y: 14 }, value: { ...value, whichFloor: "9" } },
					{ key: { X: 9, Y: 14 }, value: { ...value } },
				],
			} satisfies NonNullable<typeof document.SaveGame.locations>[number];
			document.SaveGame.locations = [farm];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;

			// Match the first tile only. The tile of the other material and the
			// matching tile outside the rectangle retain their original records.
			yield* session.execute([
				{
					type: "farm-flooring-place",
					locationIndex: 0,
					material: "12",
					tiles: planFlooringPlacement(
						{ width: 10, height: 15, placement: new Set() },
						readFarmOccupancy(farm),
						readFarmTerrain(farm),
						{ left: 6, top: 14, right: 8, bottom: 14 },
						"12",
						{ kind: "replace", from: ["8"] },
					).tiles,
				},
			]);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.locations?.[0]).toEqual({
				...farm,
				terrainFeatures: [
					{ key: { X: 7, Y: 14 }, value: { ...value, whichFloor: "12" } },
					...farm.terrainFeatures.slice(1),
				],
			});
			yield* session.undo;
			const undone = yield* session.snapshot;
			expect(undone.document).toEqual(before.document);
		}),
);

it.effect(
	"fills only eligible empty tiles and restores the terrain dictionary with one Undo",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const farm = {
				$type: "StardewValley.Farm",
				name: "Farm",
				objects: [
					{
						key: { X: 1, Y: 0 },
						value: { $type: "StardewValley.Object", name: "Stone" },
					},
				],
				terrainFeatures: [
					{
						key: { X: 2, Y: 0 },
						value: {
							$type: "StardewValley.TerrainFeatures.Flooring",
							whichFloor: "9",
							whichView: 3,
						},
					},
				],
			} satisfies NonNullable<typeof document.SaveGame.locations>[number];
			document.SaveGame.locations = [farm];

			// The static map blocks (3, 0). Existing objects and paths block
			// (1, 0) and (2, 0) even though their ground tiles are passable.
			const { tiles } = planFlooringPlacement(
				{ width: 5, height: 1, placement: new Set([0, 1, 2, 4]) },
				readFarmOccupancy(farm),
				readFarmTerrain(farm),
				"farm",
				"8",
				{ kind: "empty" },
			);
			expect(tiles).toEqual([
				{ x: 0, y: 0 },
				{ x: 4, y: 0 },
			]);

			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.execute([
				{ type: "farm-flooring-place", locationIndex: 0, material: "8", tiles },
			]);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.locations?.[0]).toEqual({
				...farm,
				terrainFeatures: [
					...farm.terrainFeatures,
					...tiles.map(({ x, y }) => ({
						key: { X: x, Y: y },
						value: {
							$type: "StardewValley.TerrainFeatures.Flooring",
							whichFloor: "8",
							whichView: 0,
						},
					})),
				],
			});

			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);

it("fills perimeter tiles without filling the interior or occupied corners", () => {
	const map = {
		width: 3,
		height: 3,
		placement: new Set([0, 1, 2, 3, 4, 5, 6, 7]),
	};
	const occupancy = {
		incomplete: false,
		blocked: [{ x: 0, y: 0, width: 1, height: 1, label: "a stone" }],
	};
	const { tiles: edge } = planFlooringPlacement(
		map,
		occupancy,
		[],
		"farm",
		"8",
		{ kind: "empty" },
		"perimeter",
	);

	// The center is eligible for Whole selection, and both blocked corners
	// stay empty in either mode.
	expect(edge).toHaveLength(6);
	expect(edge).not.toContainEqual({ x: 1, y: 1 });
	expect(edge).not.toContainEqual({ x: 0, y: 0 });
	expect(edge).not.toContainEqual({ x: 2, y: 2 });
	expect(
		planFlooringPlacement(map, occupancy, [], "farm", "8", { kind: "empty" })
			.tiles,
	).toHaveLength(7);
	expect(
		planFlooringPlacement(
			map,
			occupancy,
			[],
			{ left: 1, top: 1, right: 1, bottom: 1 },
			"8",
			{ kind: "empty" },
			"perimeter",
		).tiles,
	).toEqual([{ x: 1, y: 1 }]);
});

it.effect(
	"overwrites a path and adds a new tile in the same undoable edit",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const farm = {
				$type: "StardewValley.Farm",
				name: "Farm",
				terrainFeatures: [
					{
						key: { X: 1, Y: 0 },
						value: {
							$type: "StardewValley.TerrainFeatures.Flooring",
							whichFloor: "9",
							whichView: 3,
						},
					},
				],
			} satisfies NonNullable<typeof document.SaveGame.locations>[number];
			document.SaveGame.locations = [farm];
			const preview = planFlooringPlacement(
				{ width: 3, height: 1, placement: new Set([0, 1]) },
				readFarmOccupancy(farm),
				readFarmTerrain(farm),
				"farm",
				"8",
				{ kind: "overwrite" },
			);
			expect(preview).toEqual({
				tiles: [
					{ x: 0, y: 0 },
					{ x: 1, y: 0, previous: "9" },
				],
				blocked: 1,
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.execute([
				{
					type: "farm-flooring-place",
					locationIndex: 0,
					material: "8",
					tiles: preview.tiles,
				},
			]);
			expect(
				(yield* session.snapshot).document.SaveGame.locations?.[0]
					?.terrainFeatures,
			).toEqual([
				{
					key: { X: 1, Y: 0 },
					value: { ...farm.terrainFeatures[0]?.value, whichFloor: "8" },
				},
				{
					key: { X: 0, Y: 0 },
					value: {
						$type: "StardewValley.TerrainFeatures.Flooring",
						whichFloor: "8",
						whichView: 0,
					},
				},
			]);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);
