import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { characters } from "../src/lib/NPCs.js";
import {
	lovedGiftNames,
	matchItemName,
	parseVillagerWikitext,
	type VillagerInfo,
} from "./wikiVillager.js";

// Villager descriptions aren't in the game's data files, so they come from
// the Stardew Valley Wiki (https://stardewvalleywiki.com, CC BY-NC-SA 3.0),
// along with the loved gifts listed in the same page's infobox.
const api = "https://stardewvalleywiki.com/mediawiki/api.php";

// The wiki's Cloudflare front end challenges Node's fetch, but lets curl through
// (curl ships with Windows 10+, macOS and Linux)
const run = promisify(execFile);
async function getJson(url: string) {
	const { stdout } = await run("curl", [
		"-sSf",
		"-A",
		"stardew-save-editor codegen (https://github.com/colecrouter/stardew-save-editor)",
		url,
	]);
	return JSON.parse(stdout) as { parse?: { wikitext: { "*": string } } };
}

// Loved gifts are matched to the item data from `npm run dump`
const items = new Set(
	(
		JSON.parse(await readFile("./generated/iteminfo.json", "utf-8")) as [
			string,
			unknown,
		][]
	).map(([name]) => name),
);

const villagers: Record<string, VillagerInfo> = {};
for (const name of characters) {
	const json = await getJson(
		`${api}?action=parse&prop=wikitext&format=json&section=0&redirects=1&page=${encodeURIComponent(name)}`,
	);
	if (!json.parse) throw new Error(`${name}: wiki page not found`);
	const wikitext = json.parse.wikitext["*"];
	villagers[name] = parseVillagerWikitext(wikitext, items);

	const unmatched = lovedGiftNames(wikitext).filter(
		(gift) => !matchItemName(gift, items),
	);
	if (unmatched.length > 0) {
		console.warn(`${name}: no item found for ${unmatched.join(", ")}`);
	}
}

await mkdir("./generated", { recursive: true });
await writeFile("./generated/villagers.json", JSON.stringify(villagers));
console.log(`Wrote ${Object.keys(villagers).length} villagers`);
