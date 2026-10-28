import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	root: fileURLToPath(new URL("./ui", import.meta.url)),
	plugins: [svelte({ configFile: false })],
	// Shared production panels resolve catalog modules and sprites using the app's
	// aliases. The lab supplies only path/asset adapters, never another editor engine.
	publicDir: fileURLToPath(new URL("../../static", import.meta.url)),
	resolve: {
		dedupe: ["svelte"],
		alias: {
			$lib: fileURLToPath(new URL("../../src/lib", import.meta.url)),
			$types: fileURLToPath(new URL("../../codegen", import.meta.url)),
			$generated: fileURLToPath(new URL("../../generated", import.meta.url)),
			"$app/paths": fileURLToPath(
				new URL("./ui/app-paths.ts", import.meta.url),
			),
		},
	},
	server: {
		host: "127.0.0.1",
		port: 5190,
		strictPort: true,
		fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] },
	},
	build: { outDir: "../lab-build", emptyOutDir: true },
});
