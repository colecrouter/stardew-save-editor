/** Villager info scraped from the lead section of a Stardew Valley Wiki villager page */
export interface VillagerInfo {
	/** First paragraph of the page, as plain text */
	description: string;
	/** The villager's own loved gifts, from the infobox's `favorites` field */
	loves: LovedGift[];
}

export interface LovedGift {
	/** Name to show, as written on the wiki */
	name: string;
	/** Matching key in generated/iteminfo.json, for `Item.fromName` */
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
 * Names of the items in the infobox's `favorites` field, e.g. `{{Name|Diamond}}`.
 * Entries that aren't a single item, such as Penny's "All Books", are left out.
 */
export function lovedGiftNames(wikitext: string) {
	const favorites = /^\|\s*favorites\s*=(.*)$/m.exec(wikitext)?.[1] ?? "";
	return [...favorites.matchAll(/\{\{\s*Name\s*\|([^|}]+)/g)].map(
		(match) => match[1]?.trim() ?? "",
	);
}

/** Drop a variant suffix such as " (green)" */
const withoutVariant = (name: string) => name.replace(/\s*\([^)]*\)$/, "");

/**
 * Find the item key for a wiki item name. The wiki uses display names, which
 * sometimes differ from the keys in generated/iteminfo.json: "Parrot Egg" is
 * `ParrotEgg`, "Green Frog Egg" is `FrogEgg` and "Strange Doll (green)" is
 * `Strange Doll`.
 */
export function matchItemName(name: string, items: ReadonlySet<string>) {
	const base = withoutVariant(name);
	// Every colour of Frog Egg is the same item
	const uncoloured = base.replace(
		/^(?:Black|Blue|Brown|Gray|Green|Grey|Orange|Pink|Purple|Red|White|Yellow) /,
		"",
	);
	return [base, uncoloured]
		.flatMap((candidate) => [candidate, candidate.replaceAll(" ", "")])
		.find((candidate) => items.has(candidate));
}

/**
 * Parse the wikitext of a villager page's lead section. Loved gifts are matched
 * against `items` (the keys of generated/iteminfo.json); ones with no match are left out.
 */
export function parseVillagerWikitext(
	wikitext: string,
	items: ReadonlySet<string>,
): VillagerInfo {
	const loves: LovedGift[] = [];
	for (const name of lovedGiftNames(wikitext)) {
		const item = matchItemName(name, items);
		if (!item) continue;
		const same = loves.find((gift) => gift.item === item);
		if (same) {
			// Variants of one item (both Strange Dolls) would show the same icon
			// twice, so list it once, without the variant
			same.name = withoutVariant(same.name);
		} else {
			loves.push({ name, item });
		}
	}

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
