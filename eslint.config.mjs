import typescriptParser from "@typescript-eslint/parser";
import svelte from "eslint-plugin-svelte";

// Oxlint owns JavaScript and TypeScript. This pass supplies the Svelte template
// analysis that its script-only parser cannot provide, including component fixtures.
const components = ["src/**/*.svelte", "tests/**/*.svelte"];

export default [
	...svelte.configs.recommended.map((config) => ({
		...config,
		files: components,
	})),
	{
		files: components,
		languageOptions: {
			// Parse component scripts without duplicating the native type checker.
			parserOptions: { parser: typescriptParser },
		},
		rules: {
			// Debugging constructs and implicit form submission must not reach users.
			"svelte/no-at-debug-tags": "error",
			"svelte/no-inspect": "error",
			"svelte/button-has-type": "error",
			// Catch template and lifecycle mistakes beyond the recommended baseline.
			"svelte/no-bind-value-on-checkable-inputs": "error",
			"svelte/no-conflicting-module-names": "error",
			"svelte/no-nested-style-tag": "error",
			"svelte/no-top-level-browser-globals": "error",
			"svelte/no-ignored-unsubscribe": "error",
			"svelte/require-stores-init": "error",
			"svelte/require-store-callbacks-use-set-param": "error",
			"svelte/prefer-derived-over-derived-by": "error",
		},
	},
];
