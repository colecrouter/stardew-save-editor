import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [
		mode === "production"
			? sentrySvelteKit({
					sourceMapsUploadOptions: {
						org: "cole-crouter",
						project: "stardew-save-editor",
					},
					bundleSizeOptimizations: {
						excludeReplayIframe: true,
						excludeReplayShadowDom: true,
						excludeDebugStatements: true,
					},
				})
			: undefined,
		sveltekit(),
		svelteTesting(),
	],
	server: {
		fs: {
			allow: [".."],
		},
	},
	optimizeDeps: {
		include: [
			"idb",
			"@thisux/sveltednd",
			"comlink",
			"fast-xml-parser",
			"@sentry/sveltekit",
		],
	},
	test: {
		environment: "happy-dom",
		setupFiles: ["@vitest/web-worker"],
	},
}));
