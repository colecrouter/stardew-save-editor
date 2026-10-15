import { describe, expect, it } from "vitest";
import {
	matchItemName,
	parseVillagerWikitext,
	wikiToText,
} from "../codegen/wikiVillager";

const items = new Set([
	"Amethyst",
	"Banana Pudding",
	"Pufferfish",
	"ParrotEgg",
	"FrogEgg",
	"Strange Doll",
]);

const abigail = `{{Infobox villager
|portrait  = Abigail.png
|family    = {{NPC|Pierre|Father}}{{NPC|Caroline|Mother}}
|favorites = {{Name|Amethyst}}{{Name|Banana Pudding}}{{Name|Pufferfish|link=Fish}}{{Name|Unknown Thing}}
}}
{{Quote|Abigail lives at the general store
with her parents.|[https://example.com Dev Update]}}

'''Abigail''' is a [[Villagers|villager]] who lives at [[Pierre's General Store]] in [[Pelican Town]].<ref>Source</ref>

More text.`;

describe("villager wiki parsing", () => {
	it("reads the lead paragraph as plain text", () => {
		expect(parseVillagerWikitext(abigail, items).description).toBe(
			"Abigail is a villager who lives at Pierre's General Store in Pelican Town.",
		);
	});

	it("reads a lead paragraph that doesn't start with the bold name", () => {
		const emily =
			"{{Infobox villager\n}}\n[[Emily]] is a [[Villagers|villager]].";
		expect(parseVillagerWikitext(emily, items).description).toBe(
			"Emily is a villager.",
		);
	});

	it("reads loved gifts and drops ones with no matching item", () => {
		expect(parseVillagerWikitext(abigail, items).loves).toEqual([
			{ name: "Amethyst", item: "Amethyst" },
			{ name: "Banana Pudding", item: "Banana Pudding" },
			{ name: "Pufferfish", item: "Pufferfish" },
		]);
	});

	it("handles pages without favorites or a lead line", () => {
		expect(parseVillagerWikitext("{{Infobox villager}}", items)).toEqual({
			description: "",
			loves: [],
		});
	});

	it("matches wiki display names to item keys", () => {
		expect(matchItemName("Parrot Egg", items)).toBe("ParrotEgg");
		expect(matchItemName("Green Frog Egg", items)).toBe("FrogEgg");
		expect(matchItemName("Strange Doll (green)", items)).toBe("Strange Doll");
		expect(matchItemName("Nothing Here", items)).toBeUndefined();
	});

	it("strips nested templates and formatting", () => {
		expect(wikiToText("A {{a|{{b}}}} ''b'' [[c]] [[d|e]]")).toBe("A b c e");
	});
});
