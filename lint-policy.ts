import { recommended as effectRules } from "@effect/tsgo/oxlint-presets";
import type { OxlintConfig } from "oxlint";

// App and SDK-backed fixture checks share one policy. Separate command scopes
// decide which maintained files exist and are ready for type-aware analysis.
export const lintPolicy: OxlintConfig = {
	// Effect's explicit diagnostics remain alongside the broader native rule categories.
	extends: [effectRules],
	plugins: [
		"typescript",
		"unicorn",
		"oxc",
		"effecttsgo",
		"import",
		"promise",
		"jsdoc",
	],
	// Stale exceptions must fail so a suppression cannot outlive its original proof.
	options: {
		typeAware: true,
		respectEslintDisableDirectives: false,
		reportUnusedDisableDirectives: "error",
		maxWarnings: 0,
	},
	categories: { correctness: "error", suspicious: "error", perf: "error" },
	// Prefer explicit conditions, checked boundaries and an acyclic module graph.
	// Exceptions below preserve ordered work, owned mutation and immutable projections.
	rules: {
		// The compiler understands never-returning Effect failures; syntax-only return
		// uniformity misreads these void generators. noImplicitReturns owns this check.
		"typescript/consistent-return": "off",
		// Void callbacks and two-handler queue settlement are deliberate Promise contracts.
		"promise/always-return": "off",
		"promise/prefer-catch": "off",
		"promise/catch-or-return": "off",
		// Styles are intentional side effects, rather than unused value imports.
		"import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
		"typescript/no-explicit-any": "error",
		"typescript/no-non-null-assertion": "error",
		// All-type inline specifiers can retain an empty runtime import under
		// verbatimModuleSyntax. Erase those edges entirely to prevent initialization cycles.
		"typescript/no-import-type-side-effects": "error",
		"typescript/no-unsafe-argument": "error",
		"typescript/no-unsafe-assignment": "error",
		"typescript/no-unsafe-call": "error",
		"typescript/no-unsafe-function-type": "error",
		"typescript/no-unsafe-member-access": "error",
		"typescript/no-unsafe-return": "error",
		"typescript/no-misused-promises": "error",
		"typescript/only-throw-error": "error",
		"typescript/prefer-promise-reject-errors": "error",
		"typescript/use-unknown-in-catch-callback-variable": "error",
		"typescript/require-await": "error",
		"typescript/prefer-nullish-coalescing": "error",
		"typescript/switch-exhaustiveness-check": "error",
		"typescript/consistent-type-exports": "error",
		"eslint/array-callback-return": "error",
		"eslint/accessor-pairs": "error",
		"eslint/no-constructor-return": "error",
		"eslint/no-fallthrough": "error",
		"eslint/no-loop-func": "error",
		"eslint/no-new-wrappers": "error",
		"eslint/no-object-constructor": "error",
		"eslint/no-promise-executor-return": "error",
		"eslint/no-prototype-builtins": "error",
		"eslint/no-self-compare": "error",
		"eslint/no-template-curly-in-string": "error",
		"eslint/default-case-last": "error",
		"eslint/default-param-last": "error",
		"eslint/guard-for-in": "error",
		"eslint/no-implicit-coercion": "error",
		"eslint/no-new-func": "error",
		"eslint/no-return-assign": "error",
		"eslint/no-script-url": "error",
		"eslint/no-var": "error",
		"eslint/prefer-const": "error",
		"eslint/prefer-object-has-own": "error",
		"import/no-self-import": "error",
		"import/no-absolute-path": "error",
		"import/no-empty-named-blocks": "error",
		"import/no-mutable-exports": "error",
		"import/no-commonjs": "error",
		"import/no-dynamic-require": "error",
		"import/first": "error",
		"import/newline-after-import": "error",
		"promise/no-multiple-resolved": "error",
		"promise/no-new-statics": "error",
		"promise/valid-params": "error",
		"promise/spec-only": "error",
		"promise/no-callback-in-promise": "error",
		"jsdoc/check-tag-names": "error",
		"jsdoc/check-property-names": "error",
		"jsdoc/implements-on-classes": "error",
		"jsdoc/no-defaults": "error",
		"jsdoc/no-blank-blocks": "error",
		"effecttsgo/catch-unfailable-effect": "error",
		"effecttsgo/effect-in-failure": "error",
		"effecttsgo/effect-in-void-success": "error",
		"effecttsgo/effect-try-without-catch": "error",
		"effecttsgo/lazy-promise-in-effect-sync": "error",
		"effecttsgo/leaking-requirements": "error",
		"effecttsgo/run-effect-inside-effect": "error",
		"effecttsgo/return-effect-in-gen": "error",
		"effecttsgo/unknown-in-effect-catch": "error",
		"typescript/ban-ts-comment": [
			"error",
			{
				"ts-expect-error": "allow-with-description",
				"ts-ignore": true,
				"ts-nocheck": true,
				minimumDescriptionLength: 10,
			},
		],
		"typescript/return-await": ["error", "error-handling-correctness-only"],
		"typescript/strict-boolean-expressions": [
			"error",
			{
				allowAny: false,
				allowString: false,
				allowNumber: false,
				allowNullableBoolean: false,
				allowNullableEnum: false,
				allowNullableString: false,
				allowNullableNumber: false,
				allowNullableObject: true,
			},
		],
		"typescript/restrict-plus-operands": [
			"error",
			{
				allowAny: false,
				allowBoolean: false,
				allowNullish: false,
				allowNumberAndString: false,
				allowRegExp: false,
			},
		],
		"typescript/consistent-type-assertions": [
			"error",
			{
				assertionStyle: "as",
				objectLiteralTypeAssertions: "never",
				arrayLiteralTypeAssertions: "never",
			},
		],
		"typescript/consistent-type-imports": [
			"error",
			{
				prefer: "type-imports",
				fixStyle: "inline-type-imports",
				// import() annotations are already type-only and useful for ESM mock contracts.
				disallowTypeAnnotations: false,
			},
		],
		"eslint/eqeqeq": [
			"error",
			"always",
			{
				null: "ignore",
			},
		],
		"import/no-cycle": [
			"error",
			{
				ignoreTypes: true,
				ignoreExternal: true,
			},
		],
		"import/no-duplicates": [
			"error",
			{
				considerQueryString: true,
				preferInline: true,
			},
		],
		"sort-imports": [
			"error",
			{
				ignoreDeclarationSort: true,
				ignoreCase: true,
			},
		],
		"eslint/no-underscore-dangle": "off",
		"eslint/no-await-in-loop": "off",
		"unicorn/consistent-function-scoping": "off",
		"unicorn/no-array-sort": "off",
		"unicorn/no-array-reverse": "off",
		"oxc/no-map-spread": "off",
		"effecttsgo/unstable-api-usage": "off",
	},
	// Generated data and vendored code are checked at their generator boundaries.
	ignorePatterns: [
		"content/**",
		"generated/**",
		"static/**",
		"build/**",
		".svelte-kit/**",
		".cache/**",
		"tools/xnbhack/upstream/**",
		"tools/game-data/tests/generated/**",
	],
	overrides: [
		{
			files: ["tests/engine/worker-service.ts", "tests/engine/xml-worker.ts"],
			// These are Node worker_threads messages; their API has no browser targetOrigin.
			rules: { "unicorn/require-post-message-target-origin": "off" },
		},
		{
			files: [
				"src/lib/xmlObject.ts",
				"src/lib/save-format/events.ts",
				"src/lib/save-format/xml.ts",
			],
			// The XML codec deliberately adopts Effect's experimental XML API;
			// unrelated experimental APIs must still be reviewed at their call sites.
			rules: { "effecttsgo/experimental-api-usage": "off" },
		},
		{
			files: ["src/**"],
			// Browser modules must not acquire Node-only runtime dependencies.
			rules: { "import/no-nodejs-modules": "error" },
		},
		{
			files: ["**/*.svelte"],
			// The Svelte parser owns template references and rune bindings.
			rules: { "no-unused-vars": "off", "no-undef": "off" },
		},
		{
			files: ["src/**/*.js"],
			// TypeScript owns TS names; plain browser scripts need explicit global checking.
			env: { browser: true },
			rules: { "no-undef": "error" },
		},
		{
			files: [
				"scripts/**",
				"tools/**/*.mjs",
				"tools/**/*.mts",
				"tools/**/*.node.ts",
				"vite.config.ts",
				"eslint.config.mjs",
			],
			plugins: [
				"typescript",
				"unicorn",
				"oxc",
				"effecttsgo",
				"import",
				"promise",
				"jsdoc",
				"node",
			],
			env: { node: true, browser: true },
			// Browser automation evaluates callbacks in the page; compiler scopes still
			// distinguish those callbacks from the surrounding Node process.
			rules: {
				"node/no-exports-assign": "error",
				"node/no-new-require": "error",
				"node/no-path-concat": "error",
				"node/handle-callback-err": "error",
				"no-undef": "error",
			},
		},
		{
			files: ["tests/**", "src/**/*.test.*", "src/**/*.spec.*"],
			plugins: [
				"typescript",
				"unicorn",
				"oxc",
				"effecttsgo",
				"import",
				"promise",
				"jsdoc",
				"vitest",
				"node",
			],
			env: { node: true, browser: true },
			// Effect tests and Vitest assertion messages are supported explicitly.
			// Assertion presence is enforced at runtime, including generator bodies.
			rules: {
				"node/no-exports-assign": "error",
				"node/no-new-require": "error",
				"node/no-path-concat": "error",
				"node/handle-callback-err": "error",
				"vitest/no-conditional-expect": "error",
				"vitest/require-mock-type-parameters": "error",
				"vitest/require-to-throw-message": "error",
				"vitest/no-standalone-expect": [
					"error",
					{
						additionalTestBlockFunctions: ["it.effect", "it.effect.each"],
					},
				],
				"vitest/valid-expect": [
					"error",
					{
						maxArgs: 2,
					},
				],
				"vitest/expect-expect": "off",
				// Each test is an isolated application root with its own Layer lifetime.
				"effecttsgo/strict-effect-provide": "off",
				"import/no-nodejs-modules": "off",
			},
		},
	],
};
