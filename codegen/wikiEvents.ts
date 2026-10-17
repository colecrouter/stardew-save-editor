import { wikiToText } from "./wikiText.js";

/** A vanilla event from the Stardew Modding Wiki's List of Vanilla Event IDs */
export interface EventInfo {
	/** Event ID as stored in the save's eventsSeen list */
	id: string;
	/** Short title, e.g. "Abigail's 2 heart event" */
	name: string;
	/** The rest of the wiki's description (empty when the title says it all) */
	description: string;
	/** Where the event plays, e.g. "Pierre's General Store" */
	location: string;
	/** Characters the wiki lists the event under (empty for e.g. Grandpa's evaluation) */
	npcs: string[];
}

/**
    Split a wiki description such as "Abigail's 2 heart event: she asks the farmer
    to play..." into a short title and the rest.
*/
export function splitDescription(text: string) {
	const match = /: |\. /.exec(text);
	if (!match) return { name: text.replace(/\.$/, ""), description: "" };
	const rest = text.slice(match.index + 2);
	return {
		name: text.slice(0, match.index),
		description: rest.charAt(0).toUpperCase() + rest.slice(1),
	};
}

/** The cells of each row of the wikitables in some wikitext, ignoring headers */
function tableRows(wikitext: string) {
	return wikitext.split(/\n\|-/).map((block) =>
		block
			.split("\n")
			.filter((line) => line.startsWith("|") && !line.startsWith("|}"))
			.flatMap((line) => line.slice(1).split("||"))
			.map((cell) => cell.trim()),
	);
}

/** Group headings span the table, e.g. `| colspan="5" ... |'''Location: Beach'''` */
function groupName(cells: string[]) {
	const [first = ""] = cells;
	if (!first.includes("colspan")) return undefined;
	return /'''(.+?)'''/.exec(first)?.[1]?.trim() ?? "";
}

/**
    Parse the wikitext of the List of Vanilla Event IDs.

    The page has two tables of the same events: grouped by location (ID and
    description), then grouped by character (ID, description and location). The
    location table is the tidier one, so descriptions and locations come from it,
    and the character table only says whose event each is (in heart order). An ID
    only in the character table would be left out; the page has none.

    @param npcs Known villager names, to tell whose event one only in the location table is
*/
export function parseEventWikitext(
	wikitext: string,
	npcs: readonly string[],
): EventInfo[] {
	const split = /^=+\s*'''Grouped by Character'''\s*=+\s*$/m.exec(wikitext);
	if (!split) throw new Error("No 'Grouped by Character' table on the page");
	const byLocation = wikitext.slice(0, split.index);
	const byCharacter = wikitext.slice(split.index);

	// Some IDs are listed twice, e.g. a longer description of the same event, or
	// (ID 36) two different events
	const texts = new Map<string, { location: string; texts: string[] }>();
	let group = "";
	for (const cells of tableRows(byLocation)) {
		const heading = groupName(cells);
		if (heading !== undefined) {
			group = heading.replace(/^Location:\s*/, "");
			continue;
		}
		const [id, text] = cells.map(wikiToText);
		if (!id || !text) continue;
		const event = texts.get(id);
		if (!event) {
			texts.set(id, { location: group, texts: [text] });
			continue;
		}
		const extended = event.texts.findIndex((t) => text.startsWith(t));
		if (extended !== -1) event.texts[extended] = text;
		else if (!event.texts.some((t) => t.startsWith(text)))
			event.texts.push(text);
	}

	const events = new Map<string, EventInfo>();
	for (const [id, { location, texts: all }] of texts) {
		const parts = all.map(splitDescription);
		events.set(id, {
			id,
			name: parts.map((p) => p.name).join(" / "),
			description: parts
				.map((p) => p.description)
				.filter(Boolean)
				.join(" "),
			location,
			npcs: [],
		});
	}

	// Only the IDs: the character table's location cells are sometimes missing or swapped
	const order: string[] = [];
	group = "";
	for (const cells of tableRows(byCharacter)) {
		const heading = groupName(cells);
		if (heading !== undefined) {
			group = heading;
			continue;
		}
		const event = events.get(wikiToText(cells[0] ?? ""));
		if (!event || !group) continue;
		if (!event.npcs.includes(group)) event.npcs.push(group);
		if (!order.includes(event.id)) order.push(event.id);
	}

	// Events missing from the character table (e.g. all of Leo's) are still often
	// named after a villager, as in "Leo's 2 heart event"
	for (const event of events.values()) {
		if (event.npcs.length > 0) continue;
		const owner = /^(\S+)'s /.exec(event.name)?.[1];
		if (owner && npcs.includes(owner)) event.npcs.push(owner);
	}

	if (events.size === 0) throw new Error("No events found on the page");
	// By character (alphabetically, each in heart order), then the rest by location.
	// An array, as objects would put integer-like IDs first in numeric order.
	const sorted = order.flatMap((id) => events.get(id) ?? []);
	return [
		...sorted,
		...[...events.values()].filter((e) => !order.includes(e.id)),
	];
}
