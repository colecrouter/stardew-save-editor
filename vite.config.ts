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
			// Native structuredClone is part of the supported browser baseline.
			modernTargets: [
				"chrome >= 100",
				"edge >= 100",
				"firefox >= 100",
				"safari >= 15.4",
				"ios >= 15.4",
			],
		}),
		svelteTesting(),
	],
	server: {
		fs: {
			// The project root, for generated/ and codegen/ (outside src/). Not "..":
			// that would let the dev server hand out any file next to the clone
			allow: ["."],
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
		css: true,
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
