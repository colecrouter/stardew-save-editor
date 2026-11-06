import { expect, it } from "vitest";
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
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));

it("rejects a structural building change when raw storage aliases would collapse distinct handles", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(withAnimalBuildings(fixtureXml)),
				coop = inspectBuildings(document).buildings.find(
					(row) => row.id === COOP_ID,
				);
			if (!coop?.interior) throw new Error("Missing Coop");
			const chest = {
				"@_xsi:type": "Chest",
				name: "Chest",
				itemId: "130",
				items: { Item: [{ itemId: "388", stack: 3 }] },
			};
			coop.interior.objects = {
				item: [10, 11].map((x) => ({
					key: { Vector2: { X: x, Y: 3 } },
					value: { Object: chest },
				})),
			};
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
	));
it("leaves unnamed farmhand records untouched by building and adoption progression", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(withAnimalBuildings(fixtureXml)),
				ghost = structuredClone(document.SaveGame.player);
			Object.assign(ghost, {
				name: "",
				UniqueMultiplayerID: "0",
				mailReceived: { opaque: "retain" },
				activeDialogueEvents: { unknown: true },
			});
			document.SaveGame.farmhands = { Farmer: [ghost] };
			const session = yield* makeHistorySession(document);
			yield* session.transact(upgradeBuilding(COOP_ID, "Big Coop"));
			yield* session.transact(
				adoptAnimal(COOP_ID, "Duck", "Puddles", PLAYER_ID),
			);
			expect((yield* session.snapshot).document.SaveGame.farmhands).toEqual({
				Farmer: [ghost],
			});
		}),
	));
