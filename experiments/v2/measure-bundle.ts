import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

// Standalone synthetic bundles, not incremental application download sizes.
for (const [name, entry] of [
	["plain-session", 'export { PlainSession } from "./plain.ts"'],
	["effect-session", 'export { makeEffectSession } from "./effect.ts"'],
	["effect-codec", 'export { SaveCodecLive } from "./save-service.ts"'],
	[
		"inventory-atoms",
		'export { makeAtomInventory } from "./inventory-atoms.ts"',
	],
	[
		"inventory-stores",
		'export { makeStoreInventory } from "./inventory-stores.ts"',
	],
] as const) {
	const result = await build({
		stdin: {
			contents: entry,
			resolveDir: fileURLToPath(new URL(".", import.meta.url)),
			loader: "ts",
		},
		bundle: true,
		minify: true,
		platform: "browser",
		format: "esm",
		target: "es2022",
		write: false,
	});
	const bytes = result.outputFiles[0].contents;
	console.log(
		JSON.stringify({
			name,
			bytes: bytes.length,
			gzipBytes: gzipSync(bytes).length,
		}),
	);
}
