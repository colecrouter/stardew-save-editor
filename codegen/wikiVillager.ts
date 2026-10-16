/** Villager info scraped from the lead section of a Stardew Valley Wiki villager page */
export interface VillagerInfo {
	/** First paragraph of the page, as plain text */
	description: string;
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

/** Parse the wikitext of a villager page's lead section */
export function parseVillagerWikitext(wikitext: string): VillagerInfo {
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

	return { description: lead ? wikiToText(lead) : "" };
}
