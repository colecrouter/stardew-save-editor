import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
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
					type: "farm-flooring-replace",
					locationIndex: 0,
					scope: { left: 6, top: 14, right: 8, bottom: 14 },
					from: "8",
					to: "12",
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
