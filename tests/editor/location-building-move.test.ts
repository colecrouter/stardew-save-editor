import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { coopXml, withAnimalBuildings } from "../helpers/animalBuildings.ts";
import { parser } from "../helpers/editor-document.ts";
import { fixtureXml } from "./fixtures";

it.effect(
	"moves an occupied coop as one edit and rejects a blocked door approach",
	() =>
		Effect.gen(function* () {
			const document = parser.parse(
				withAnimalBuildings(fixtureXml, [coopXml()]),
			);
			const locationIndex =
				document.SaveGame.locations?.findIndex(
					(location) => location?.$type === "StardewValley.Farm",
				) ?? -1;
			const farm = document.SaveGame.locations?.[locationIndex];
			if (farm?.$type !== "StardewValley.Farm") throw new Error("Missing farm");
			const coop = farm.buildings?.[0];
			if (
				coop?.$type !== "StardewValley.Buildings.Building" ||
				coop.buildingType !== "Coop"
			)
				throw new Error("Missing coop");

			// Use deliberately clear saved ground with a barrier at the human door
			// of one candidate. The viewport independently validates the map tiles.
			farm.objects = [
				{
					key: { X: 51, Y: 28 },
					value: {
						$type: "StardewValley.Object",
						name: "Stone",
						itemId: "343",
					},
				},
			];
			// Flooring can stay in the clear approach at the allowed destination.
			farm.terrainFeatures = [
				{
					key: { X: 51, Y: 32 },
					value: { $type: "StardewValley.TerrainFeatures.Flooring" },
				},
			];
			farm.largeTerrainFeatures = [];
			farm.resourceClumps = [];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;

			const request = {
				type: "farm-coop-move",
				locationIndex,
				buildingIndex: 0,
				source: { x: 40, y: 20 },
				destination: { x: 50, y: 25 },
			} as const;
			const blocked = yield* Effect.result(session.execute([request]));
			expect(Result.isFailure(blocked)).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before.document);

			yield* session.execute([{ ...request, destination: { x: 50, y: 29 } }]);
			const moved = yield* session.snapshot;
			const movedFarm = moved.document.SaveGame.locations?.[locationIndex];
			expect(
				movedFarm?.$type === "StardewValley.Farm" && movedFarm.buildings?.[0],
			).toEqual({ ...coop, tileX: 50, tileY: 29 });
			expect(
				movedFarm?.$type === "StardewValley.Farm" && movedFarm.animals,
			).toEqual(farm.animals);
			expect(
				movedFarm?.$type === "StardewValley.Farm" && movedFarm.terrainFeatures,
			).toEqual(farm.terrainFeatures);
			expect(moved.identities).toEqual(before.identities);

			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);
