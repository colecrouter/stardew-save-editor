import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [svelte({ configFile: false })],
	resolve: { conditions: ["browser"], dedupe: ["svelte"] },
	test: { environment: "happy-dom", include: ["*.ui.test.svelte.ts"] },
});
