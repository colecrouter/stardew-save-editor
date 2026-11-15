import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { readChildren } from "../../src/lib/editor/children-data.ts";
import { renameChild } from "../../src/lib/editor/children-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readItemPresentation } from "../../src/lib/editor/item-presentation.ts";
import {
	readRelationships,
	setRelationship,
} from "../../src/lib/editor/relationship-operations.ts";
import {
	exportDocument,
	parser,
	tinyFixture,
} from "../helpers/editor-document.ts";
import { childrenFixture, renameRequest } from "./children-fixture.ts";

it.effect(
	"preserves custom IDs, NPCs and opaque classes through edits, XML and Undo",
	() =>
		Effect.gen(function* () {
			const input = tinyFixture();
			input.SaveGame.player.items = [
				{
					$type: "StardewValley.Object",
					itemId: "Example.ModCrystal",
					name: "Mod Crystal",
					stack: 4,
					modData: [{ key: "Example/charge", value: "007" }],
				},
				{
					$type: "$unknown",
					$xmlType: { name: "Object", namespace: "urn:example-mod" },
					itemId: "390",
					name: "Stone",
					customPayload: { charge: "007" },
				},
				null,
			];
			input.SaveGame.player.friendshipData = [
				{
					key: "Example.ModFriend",
					value: { Points: 250, Status: "Friendly", customPayload: "007" },
				},
			];
			input.SaveGame.locations = [
				{
					$type: "StardewValley.GameLocation",
					name: "Town",
					characters: [
						{
							$type: "StardewValley.NPC",
							name: "Example.ModFriend",
							modData: [{ key: "Example/story", value: "007" }],
						},
						{
							$type: "$unknown",
							$xmlType: { name: "NPC", namespace: "urn:example-mod" },
							name: "Example.CustomClass",
							customPayload: "007",
						},
					],
				},
			];
			// Start at the production decoder boundary, so assertions compare actual
			// mod representations rather than hand-built approximations of opaque XML.
			const document = parser.parse(exportDocument(input));
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const entityId = before.identities["1"]?.[1];
			if (entityId === undefined || entityId === "")
				throw Error("Missing opaque item handle");
			expect(
				readRelationships(document)[0]?.relationships.find(
					(row) => row.name === "Example.ModFriend",
				)?.supported,
			).toBe(true);
			yield* session.execute([
				{
					type: "item-move",
					ownerId: "1",
					slot: 1,
					toOwnerId: "1",
					toSlot: 2,
					entityId,
				},
			]);
			yield* session.transact(
				setRelationship({
					farmerId: "1",
					name: "Example.ModFriend",
					kind: "points",
					value: 500,
				}),
			);
			const after = yield* session.snapshot;
			const imported = parser.parse(exportDocument(after.document));
			expect(imported).toEqual(after.document);
			expect(imported.SaveGame.locations).toEqual(document.SaveGame.locations);
			expect(imported.SaveGame.player.items[0]).toEqual(
				document.SaveGame.player.items[0],
			);
			expect(imported.SaveGame.player.items[2]).toEqual(
				document.SaveGame.player.items[1],
			);
			expect(imported.SaveGame.player.friendshipData?.[0]?.value).toMatchObject(
				{
					Points: 500,
					customPayload: "007",
				},
			);
			// A safe fallback icon is presentation only; familiar IDs do not grant an
			// opaque class vanilla property edits or equipment authority.
			const view = readItemPresentation(imported.SaveGame.player.items[2]);
			expect(view.visual?.sheet).toBe("springobjects.png");
			expect(view.properties).toEqual([]);
			expect(view.allowedEquipmentSlots).toEqual([]);
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);

it.effect("retains mod NPCs while renaming a child in a known home", () =>
	Effect.gen(function* () {
		const input = childrenFixture();
		const home = input.SaveGame.locations?.[0];
		if (home?.$type !== "StardewValley.Locations.FarmHouse")
			throw Error("Missing fixture home");
		home.characters?.push({
			$type: "$unknown",
			$xmlType: { name: "NPC", namespace: "urn:example-mod" },
			name: "Example.HouseGuest",
			customPayload: "007",
		});
		const document = parser.parse(exportDocument(input));
		expect(readChildren(document)[0]?.supported).toBe(true);
		const session = yield* makeHistorySession(document);
		yield* session.transact(renameChild(renameRequest(document)));
		const after = parser.parse(
			exportDocument((yield* session.snapshot).document),
		);
		const savedHome = after.SaveGame.locations?.[0];
		if (savedHome?.$type !== "StardewValley.Locations.FarmHouse")
			throw Error("Missing exported home");
		expect(savedHome.characters?.[1]).toEqual(home.characters?.[1]);
	}),
);
