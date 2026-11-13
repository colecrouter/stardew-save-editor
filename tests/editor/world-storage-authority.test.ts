import { it } from "@effect/vitest";
import { expect } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	upgradeBuilding,
	adoptAnimal,
} from "../../src/lib/editor/building-operations";
import { inspectBuildings } from "../../src/lib/editor/building-data";
import {
	withAnimalBuildings,
	COOP_ID,
	PLAYER_ID,
} from "../helpers/animalBuildings";
import { fixtureXml, parser } from "./fixtures";

it.effect(
	"rejects a structural building change when raw storage aliases would collapse distinct handles",
	() =>
		Effect.gen(function* () {
			const document = parser.parse(withAnimalBuildings(fixtureXml)),
				coop = inspectBuildings(document).buildings.find(
					(row) => row.id === COOP_ID,
				);
			if (!coop?.interior) throw new Error("Missing Coop");
			const chest = {
				$type: "StardewValley.Objects.Chest" as const,
				name: "Chest",
				itemId: "130",
				items: [
					{ $type: "StardewValley.Object" as const, itemId: "388", stack: 3 },
				],
			};
			coop.interior.objects = [10, 11].map((x) => ({
				key: { X: x, Y: 3 },
				value: chest,
			}));
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			expect(
				Result.isFailure(
					yield* Effect.result(
						session.transact(upgradeBuilding(COOP_ID, "Big Coop")),
					),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}),
	30_000,
);
it.effect(
	"leaves unnamed farmhand records untouched by building and adoption progression",
	() =>
		Effect.gen(function* () {
			const document = parser.parse(withAnimalBuildings(fixtureXml)),
				ghost = structuredClone(document.SaveGame.player);
			Object.assign(ghost, {
				name: "",
				UniqueMultiplayerID: 0n,
				mailReceived: { opaque: "retain" },
				activeDialogueEvents: { unknown: true },
			});
			document.SaveGame.farmhands = [ghost];
			const session = yield* makeHistorySession(document);
			yield* session.transact(upgradeBuilding(COOP_ID, "Big Coop"));
			yield* session.transact(
				adoptAnimal(COOP_ID, "Duck", "Puddles", PLAYER_ID),
			);
			expect((yield* session.snapshot).document.SaveGame.farmhands).toEqual([
				ghost,
			]);
		}),
);
