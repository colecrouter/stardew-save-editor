import { type ChildProcess, execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { isRecord } from "../../src/lib/unknown.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Resolve the real config, including Kit's configResolved hook, without starting
// a server or browser. Each process leaves a marker where Kit wrote its manifest.
// A later config resolution must never replace another test runner's modules.
const probe = `
import { resolveConfig } from "vite";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
const config = await resolveConfig({}, "serve", "test");
const alias = config.resolve.alias.find(entry => entry.find === "<sveltekit:generated>");
if (!alias) throw new Error("Missing SvelteKit generated-module alias");
const manifest = resolve(alias.replacement, "app-manifest.js");
const marker = "// test process " + process.pid + "\\nexport const assets = [];\\n";
await writeFile(manifest, marker);
await mkdir(config.cacheDir, { recursive: true });
const cache = resolve(config.cacheDir, "config-isolation-marker");
await writeFile(cache, marker);
process.stdout.write(JSON.stringify({ manifest, cache, marker }));
`;

it("isolates generated modules and optimizer caches between test processes", async ({
	onTestFinished,
}) => {
	const children = new Set<ChildProcess>();
	// A runner deadline must also stop a stuck subprocess. There is deliberately
	// no separate child timeout which could disagree with the shared test budget.
	onTestFinished(() => {
		for (const child of children) child.kill();
	});
	const resolveManifest = () =>
		new Promise<{ manifest: string; cache: string; marker: string }>(
			(resolve, reject) => {
				// Strip worker identity so this models a fresh runner, then explicitly
				// opt the subprocess into the test-only generated-directory policy.
				const env = Object.fromEntries(
					Object.entries(process.env).filter(
						([name]) => !name.startsWith("VITEST"),
					),
				);
				env["VITEST"] = "true";
				const child = execFile(
					process.execPath,
					["--input-type=module", "--eval", probe],
					{ cwd: root, env, encoding: "utf8" },
					(error, stdout, stderr) => {
						children.delete(child);
						if (error) {
							reject(
								new Error(`Config resolution failed: ${stderr}`, {
									cause: error,
								}),
							);
							return;
						}
						// Check the subprocess transport envelope before using its paths.
						// The probe is fixed, but malformed stdout should fail at this boundary.
						try {
							const result: unknown = JSON.parse(stdout);
							if (
								!isRecord(result) ||
								typeof result["manifest"] !== "string" ||
								typeof result["cache"] !== "string" ||
								typeof result["marker"] !== "string"
							)
								throw new Error("Invalid config probe result");
							resolve({
								manifest: result["manifest"],
								cache: result["cache"],
								marker: result["marker"],
							});
						} catch (cause) {
							reject(
								cause instanceof Error
									? cause
									: new Error("Invalid config probe result", { cause }),
							);
						}
					},
				);
				children.add(child);
			},
		);
	const first = await resolveManifest();
	expect(await readFile(first.manifest, "utf8")).toBe(first.marker);
	const second = await resolveManifest();
	// This is the regression: Kit's second configResolved hook used to replace
	// the first manifest with an empty asset list in the shared .svelte-kit tree.
	expect(await readFile(first.manifest, "utf8")).toBe(first.marker);
	expect(second.manifest).not.toBe(first.manifest);
	expect(await readFile(second.manifest, "utf8")).toBe(second.marker);
	// Browser dependency URLs also belong to a run. Sharing the optimizer cache
	// lets one process invalidate files still being imported by another browser.
	expect(second.cache).not.toBe(first.cache);
	expect(await readFile(first.cache, "utf8")).toBe(first.marker);
	expect(await readFile(second.cache, "utf8")).toBe(second.marker);
});
