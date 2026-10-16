import { writeFile } from "node:fs/promises";
import { characters } from "../src/lib/NPCs.js";
import { parseEventWikitext } from "./wikiEvents.js";
import { getJson } from "./wikiFetch.js";

// Event names aren't in the game's data files (the Data/Events keys are just IDs and
// preconditions), so they come from the Stardew Modding Wiki's List of Vanilla Event IDs
// (https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs, CC BY-SA 4.0).
const page = "List_of_Vanilla_Event_IDs";
const json = await getJson(
	`https://stardewmodding.wiki.gg/api.php?action=parse&prop=wikitext&format=json&redirects=1&page=${page}`,
);
if (!json.parse) throw new Error(`${page}: wiki page not found`);
const events = parseEventWikitext(json.parse.wikitext["*"], characters);

await writeFile("./generated/events.json", JSON.stringify(events));
console.log(`Wrote ${events.length} events`);
