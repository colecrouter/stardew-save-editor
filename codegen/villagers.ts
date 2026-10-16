import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { characters } from "../src/lib/NPCs.js";
import { parseVillagerWikitext, type VillagerInfo } from "./wikiVillager.js";

// Villager descriptions aren't in the game's data files, so they come from
// the Stardew Valley Wiki (https://stardewvalleywiki.com, CC BY-NC-SA 3.0).
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

const villagers: Record<string, VillagerInfo> = {};
for (const name of characters) {
	const json = await getJson(
		`${api}?action=parse&prop=wikitext&format=json&section=0&redirects=1&page=${encodeURIComponent(name)}`,
	);
	if (!json.parse) throw new Error(`${name}: wiki page not found`);
	villagers[name] = parseVillagerWikitext(json.parse.wikitext["*"]);
}

await mkdir("./generated", { recursive: true });
await writeFile("./generated/villagers.json", JSON.stringify(villagers));
console.log(`Wrote ${Object.keys(villagers).length} villagers`);
