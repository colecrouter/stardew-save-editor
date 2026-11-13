import { expect, it } from "vitest";
import { fixtureXml, parser } from "./fixtures.ts";

it("keeps nested edits private while preserving bigint fixture identities", () => {
	const first = parser.parse(fixtureXml);
	const expected = structuredClone(first.SaveGame.player);
	first.SaveGame.player.money = -1;
	first.SaveGame.player.items.length = 0;

	// A later consumer must see the pristine run baseline, not the first test's edits.
	const second = parser.parse(fixtureXml);
	expect(second.SaveGame.player).toEqual(expected);
	expect(typeof second.SaveGame.player.UniqueMultiplayerID).toBe("bigint");
});
