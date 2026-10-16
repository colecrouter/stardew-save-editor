import { describe, expect, it } from "vitest";
import {
	lovedGiftNames,
	matchItemName,
	parseVillagerWikitext,
	wikiToText,
} from "../codegen/wikiVillager";

const items = new Set([
	"Amethyst",
	"Banana Pudding",
	"Pufferfish",
	"Diamond",
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

	it("handles pages without favorites or a lead line", () => {
		expect(parseVillagerWikitext("{{Infobox villager}}", items)).toEqual({
			description: "",
			loves: [],
		});
	});

	it("reads loved gifts and leaves out ones with no matching item", () => {
		expect(lovedGiftNames(abigail)).toEqual([
			"Amethyst",
			"Banana Pudding",
			"Pufferfish",
			"Unknown Thing",
		]);
		expect(parseVillagerWikitext(abigail, items).loves).toEqual([
			{ name: "Amethyst", item: "Amethyst" },
			{ name: "Banana Pudding", item: "Banana Pudding" },
			{ name: "Pufferfish", item: "Pufferfish" },
		]);
	});

	it("skips category entries such as Penny's books", () => {
		const penny =
			"{{Infobox villager\n|favorites =  <ul><li>All [[Books]]</li></ul>{{Name|Diamond}}\n}}";
		expect(lovedGiftNames(penny)).toEqual(["Diamond"]);
	});

	it("lists variants of one item once", () => {
		const jas =
			"{{Infobox villager\n|favorites = {{Name|Strange Doll (green)}}{{Name|Strange Doll (yellow)}}\n}}";
		expect(parseVillagerWikitext(jas, items).loves).toEqual([
			{ name: "Strange Doll", item: "Strange Doll" },
		]);
	});

	it("matches wiki display names to item keys", () => {
		expect(matchItemName("Diamond", items)).toBe("Diamond");
		expect(matchItemName("Parrot Egg", items)).toBe("ParrotEgg");
		expect(matchItemName("Green Frog Egg", items)).toBe("FrogEgg");
		expect(matchItemName("Strange Doll (green)", items)).toBe("Strange Doll");
		expect(matchItemName("Nothing Here", items)).toBeUndefined();
	});

	it("leaves no HTML tags behind, even nested ones", () => {
		expect(wikiToText("a <scr<b>ipt>alert(1)</script> b")).toBe("a alert(1) b");
		expect(wikiToText("x < y")).toBe("x y");
	});

	it("strips nested templates and formatting", () => {
		expect(wikiToText("A {{a|{{b}}}} ''b'' [[c]] [[d|e]]")).toBe("A b c e");
	});
});
