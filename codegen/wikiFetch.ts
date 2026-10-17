import { execFile } from "node:child_process";
import { promisify } from "node:util";

// The Stardew Valley Wiki's Cloudflare front end challenges Node's fetch, but lets curl
// through (curl ships with Windows 10+, macOS and Linux)
const run = promisify(execFile);

/** Fetch a MediaWiki API URL that returns a page's wikitext */
export async function getJson(url: string) {
	const { stdout } = await run("curl", [
		"-sSf",
		"-A",
		"stardew-save-editor codegen (https://github.com/colecrouter/stardew-save-editor)",
		url,
	]);
	return JSON.parse(stdout) as { parse?: { wikitext: { "*": string } } };
}
