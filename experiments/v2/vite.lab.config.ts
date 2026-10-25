import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	root: fileURLToPath(new URL("./ui", import.meta.url)),
	plugins: [svelte({ configFile: false })],
	server: {
		host: "127.0.0.1",
		port: 5190,
		strictPort: true,
		fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] },
	},
	build: { outDir: "../lab-build", emptyOutDir: true },
});
