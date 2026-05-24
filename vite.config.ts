import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";
import legacy from "vite-plugin-sveltekit-legacy";

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
		legacy({
			modernTargets: [
				"chrome >= 100",
				"edge >= 100",
				"firefox >= 100",
				"safari >= 15",
				"ios >= 15",
			],
		}),
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
		setupFiles: ["@vitest/web-worker", "./tests/helpers/setup.ts"],
		// Required for SvelteKit with Vite 7+
		// Ensures that SvelteKit's virtual modules ($app, __sveltekit) are properly resolved
		server: {
			deps: {
				inline: [/@sveltejs\/kit/, /@thisux\/sveltednd/, /@sentry\/sveltekit/],
			},
		},
	},
}));
