/** Villager info scraped from the lead section of a Stardew Valley Wiki villager page */
export interface VillagerInfo {
	/** First paragraph of the page, as plain text */
	description: string;
	/** The villager's loved gifts, from the infobox's `favorites` field */
	loves: LovedGift[];
}

export interface LovedGift {
	/** Name as shown on the wiki */
	name: string;
	/** Matching key in generated/iteminfo.json */
	item: string;
}

/** Strip wiki markup from a line of article text */
export function wikiToText(text: string) {
	let out = text;
	// Drop templates, innermost first so nested ones collapse
	for (let prev = ""; prev !== out; ) {
		prev = out;
		out = out.replace(/\{\{[^{}]*\}\}/g, "");
	}
	// Drop footnotes, then any other HTML tags until none are left
	out = out
		.replace(/<ref[^>]*\/>/g, "")
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
	for (let prev = ""; prev !== out; ) {
		prev = out;
		out = out.replace(/<[^<>]*>/g, "");
	}
	return out
		.replace(/[<>]/g, "")
		.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
		.replace(/'{2,}/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
    Find the item key for a wiki item name. The wiki uses display names, which
    sometimes differ from the editor's keys (e.g. "Parrot Egg" is `ParrotEgg`,
    "Strange Doll (green)" is `Strange Doll`, "Green Frog Egg" is `FrogEgg`).
*/
export function matchItemName(name: string, items: ReadonlySet<string>) {
	const base = name.replace(/\s*\([^)]*\)\s*$/, "");
	// Colour variants share one item (e.g. every Frog Egg colour is `FrogEgg`)
	const uncoloured = base.replace(
		/^(?:Black|Blue|Brown|Gray|Green|Grey|Orange|Pink|Purple|Red|White|Yellow) /,
		"",
	);
	return [base, uncoloured]
		.flatMap((n) => [n, n.replaceAll(" ", "")])
		.find((candidate) => items.has(candidate));
}

/** Parse the wikitext of a villager page's lead section */
export function parseVillagerWikitext(
	wikitext: string,
	items: ReadonlySet<string>,
): VillagerInfo {
	const favorites = /^\|\s*favorites\s*=(.*)$/m.exec(wikitext)?.[1] ?? "";
	const loves = [...favorites.matchAll(/\{\{\s*Name\s*\|([^|}]+)/g)]
		.map((m) => m[1]?.trim() ?? "")
		.flatMap((name) => {
			const item = matchItemName(name, items);
			return item ? [{ name, item }] : [];
		})
		// Variants of one item (e.g. both Strange Dolls) would show as identical icons
		.filter((gift, i, all) => all.findIndex((g) => g.item === gift.item) === i);

	// The article starts at the first plain line after the infobox and quote templates
	let depth = 0;
	let lead: string | undefined;
	for (const line of wikitext.split("\n")) {
		const atTop = depth === 0;
		depth += (line.match(/\{\{/g) ?? []).length;
		depth -= (line.match(/\}\}/g) ?? []).length;
		const text = line.trim();
		if (atTop && depth === 0 && text && !/^(\{\{|\[\[File:|__)/.test(text)) {
			lead = text;
			break;
		}
	}

	return { description: lead ? wikiToText(lead) : "", loves };
}
