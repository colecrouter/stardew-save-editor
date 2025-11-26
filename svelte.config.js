import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			$types: "./codegen",
			$generated: "./generated",
		},
		paths: {
			base: process.env.NODE_ENV === "production" ? "/stardew-save-editor" : "",
		},
		prerender: {
			handleHttpError: "warn",
		},
		csp: {
			mode: "auto",
			directives: {
				"connect-src": ["self", "*.sentry.io", "*.ingest.us.sentry.io"],
				"script-src": ["self", "unsafe-inline"],
				"worker-src": ["self", "blob:"],
			},
		},
	},
	vitePlugin: { inspector: true },
};

export default config;
