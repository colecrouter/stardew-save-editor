import { describe, expect, it } from "vitest";
import { parseVillagerWikitext, wikiToText } from "../codegen/wikiVillager";

const abigail = `{{Infobox villager
|portrait  = Abigail.png
|family    = {{NPC|Pierre|Father}}{{NPC|Caroline|Mother}}
|favorites = {{Name|Amethyst}}{{Name|Banana Pudding}}
}}
{{Quote|Abigail lives at the general store
with her parents.|[https://example.com Dev Update]}}

'''Abigail''' is a [[Villagers|villager]] who lives at [[Pierre's General Store]] in [[Pelican Town]].<ref>Source</ref>

More text.`;

describe("villager wiki parsing", () => {
	it("reads the lead paragraph as plain text", () => {
		expect(parseVillagerWikitext(abigail).description).toBe(
			"Abigail is a villager who lives at Pierre's General Store in Pelican Town.",
		);
	});

	it("reads a lead paragraph that doesn't start with the bold name", () => {
		const emily =
			"{{Infobox villager\n}}\n[[Emily]] is a [[Villagers|villager]].";
		expect(parseVillagerWikitext(emily).description).toBe(
			"Emily is a villager.",
		);
	});

	it("handles pages without a lead line", () => {
		expect(parseVillagerWikitext("{{Infobox villager}}")).toEqual({
			description: "",
		});
	});

	it("leaves no HTML tags behind, even nested ones", () => {
		expect(wikiToText("a <scr<b>ipt>alert(1)</script> b")).toBe("a alert(1) b");
		expect(wikiToText("x < y")).toBe("x y");
	});

	it("strips nested templates and formatting", () => {
		expect(wikiToText("A {{a|{{b}}}} ''b'' [[c]] [[d|e]]")).toBe("A b c e");
	});
});
