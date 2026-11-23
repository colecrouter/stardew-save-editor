import { sentrySvelteKit } from "@sentry/sveltekit/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import legacy from "vite-plugin-sveltekit-legacy";
import { defineConfig } from "vite-plus";
import { configDefaults } from "vitest/config";

import { lintPolicy } from "./lint-policy.ts";
import { testTimeouts } from "./tests/helpers/timeouts.ts";

// Legacy editor regressions are opt-in for local development and CI alike.
// Keep ownership explicit: shared controls, catalogs, validation and save-format
// compatibility remain in the default suite even when they serve both editors.
const legacyTests = [
	"src/lib/proxies/**/*.spec.ts",
	// Match the route group's literal parentheses rather than glob grouping.
	"src/routes/[(]legacy[)]/**/*.test.ts",
	"tests/animalBuildings.svelte.test.ts",
	"tests/babyQuestion.svelte.test.ts",
	"tests/backupManager.svelte.test.ts",
	"tests/bundleRequirements.stringIds.svelte.test.ts",
	"tests/bundleReward.riverFish.svelte.test.ts",
	"tests/bundleRewards.sanitizer.svelte.test.ts",
	"tests/bundleSideEffects.svelte.test.ts",
	"tests/calendar.svelte.test.ts",
	"tests/calendarDocument.svelte.test.ts",
	"tests/chest.svelte.test.ts",
	"tests/chestGroups.test.ts",
	"tests/chestMoves.svelte.test.ts",
	"tests/chestTypes.svelte.test.ts",
	"tests/e2e.import-export.svelte.test.ts",
	"tests/e2e.svelte.test.ts",
	"tests/editor/legacy-boundary.svelte.test.ts",
	"tests/equipment-omission.svelte.test.ts",
	"tests/eventsSeen.svelte.test.ts",
	"tests/farmerStats.svelte.test.ts",
	"tests/friendship.svelte.test.ts",
	"tests/heartBar.svelte.test.ts",
	"tests/inventorySwap.svelte.test.ts",
	"tests/issue101.iridium-pan-hat.svelte.test.ts",
	"tests/item.svelte.test.ts",
	"tests/itemLifetime.svelte.test.ts",
	"tests/itemResolution.svelte.test.ts",
	"tests/itemSpriteDispose.svelte.test.ts",
	"tests/itemSprites.svelte.test.ts",
	"tests/navigation-layouts.svelte.test.ts",
	"tests/qiQuests.svelte.test.ts",
	"tests/quests.svelte.test.ts",
	"tests/saveFile.svelte.test.ts",
	"tests/saveValidation.legacy.svelte.test.ts",
	"tests/upgrades.svelte.test.ts",
	"tests/upload.svelte.test.ts",
	"tests/walletFlags.migration.svelte.test.ts",
];

export default defineConfig(({ mode }) => ({
	// Parallel browser runs must not replace each other's optimized dependency
	// URLs. Keep test caches with their process-owned Kit output; app caching stays
	// conventional for development and builds.
	cacheDir:
		(process.env["VITEST"] ?? "").length > 0
			? `.svelte-kit/vitest/${process.pid}/cache`
			: "node_modules/.vite",
	// Share formatting and linting with the same versioned toolchain as builds/tests.
	fmt: {
		// Svelte formatting is opt-in in Oxfmt; preserve the existing component policy.
		svelte: true,
		useTabs: true,
		endOfLine: "lf",
		printWidth: 80,
		// Preserve documented import sections while sorting declarations within them.
		sortImports: {
			internalPattern: ["$lib/", "$types/", "$generated/", "$app/"],
			groups: [
				"builtin",
				"external",
				"internal",
				["parent", "sibling", "index"],
				"style",
				"unknown",
			],
			partitionByComment: true,
			sortSideEffects: false,
		},
		sortPackageJson: false,
		ignorePatterns: [
			"content/**",
			"generated/**",
			"static/**",
			"**/package-lock.json",
			".cache/**",
			"tools/xnbhack/upstream/**",
			"tools/game-data/tests/generated/**",
		],
		overrides: [
			{
				files: [
					"src/lib/editor/ui/**/*.svelte",
					"src/lib/ui/kit/**/*.svelte",
					"tests/ui/**/*.svelte",
				],
				options: {
					htmlWhitespaceSensitivity: "ignore",
					singleAttributePerLine: true,
					bracketSameLine: false,
				},
			},
		],
	},
	lint: lintPolicy,

	plugins: [
		mode === "production"
			? sentrySvelteKit({
					// Sentry 11 accepts bundler options directly; explicit credentials
					// also let benchmarks suppress uploads despite a local dotenv file.
					...(process.env["SENTRY_AUTH_TOKEN"] === undefined
						? {}
						: { authToken: process.env["SENTRY_AUTH_TOKEN"] }),
					org: "cole-crouter",
					project: "stardew-save-editor",
					bundleSizeOptimizations: {
						excludeReplayIframe: true,
						excludeReplayShadowDom: true,
						excludeDebugStatements: true,
					},
				})
			: undefined,
		sveltekit({
			// Kit briefly writes an empty asset manifest while resolving config.
			// Give each test process its own generated modules so concurrent tests,
			// checks or dev servers cannot make a browser cache that empty manifest.
			// Kit resolves its runtime aliases from this directory; normal tooling
			// keeps the conventional output and generated type locations.
			outDir:
				(process.env["VITEST"] ?? "").length > 0
					? `.svelte-kit/vitest/${process.pid}`
					: ".svelte-kit",
			// Preserve the static GitHub Pages deployment while Kit owns its Vite configuration.
			adapter: adapter(),
			alias: {
				// Kit 3 no longer supplies $lib; keep existing imports stable in this tooling migration.
				$lib: "./src/lib",
				$types: "./codegen",
				$generated: "./generated",
			},
			paths: {
				base:
					process.env["NODE_ENV"] === "production"
						? "/stardew-save-editor"
						: "",
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
					// Images (CSS ones included) only come from the site itself, so text from an
					// uploaded save can never make the page fetch an image from another host
					"img-src": ["self", "data:", "blob:"],
				},
			},
			// Rendering tests use the normal CSS pipeline, including asset URLs.
			// The inspector injects an application mount, which is unrelated to test
			// rendering and must not enter isolated Browser Mode module graphs.
			inspector: (process.env["VITEST"] ?? "").length === 0,
		}),
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
	],
	server: {
		fs: {
			// The project root, for generated/ and codegen/ (outside src/). Not "..":
			// that would let the dev server hand out any file next to the clone
			allow: ["."],
		},
	},
	optimizeDeps: {
		// Scan browser workers before opening a save starts them. Preserve Kit's
		// route scan and server exclusions so server-only imports stay out.
		entries: [
			"src/routes/**/+*.{svelte,js,ts}",
			"!src/routes/**/+*server.*",
			"src/**/*.worker.ts",
		],
		// Prebundle known browser dependencies together on cold starts, including
		// the worker-only runner, rather than discovering them during page use.
		// Keep discovery enabled for new imports; list only used Effect subpaths
		// to avoid eagerly optimizing its entire export surface.
		include: [
			"idb",
			"@thisux/sveltednd",
			"comlink",
			"@sentry/sveltekit",
			"@effect/platform-browser/BrowserWorker",
			"@effect/platform-browser/BrowserWorkerRunner",
			"bits-ui",
			"effect-atom-svelte",
			"effect",
			"effect/Schema",
			"effect/SchemaTransformation",
			"effect/encoding",
			"effect/reactivity/Atom",
			"effect/reactivity/AtomRegistry",
			"effect/rpc/Rpc",
			"effect/rpc/RpcClient",
			"effect/rpc/RpcGroup",
			"effect/rpc/RpcServer",
			"effect/workers/Transferable",
			"effect/workers/Worker",
			"mutative",
			"pako",
		],
	},
	test: {
		// All projects share stuck-test guards; assertions have their own retry
		// budget so a missing UI state fails before the enclosing test expires.
		testTimeout: testTimeouts.test,
		hookTimeout: testTimeouts.hook,
		// Assertions must execute, including those inside Effect generators and helpers.
		expect: {
			requireAssertions: true,
			poll: { timeout: testTimeouts.assertion },
		},
		// A dedicated mode keeps the opt-in command portable across shells. Both
		// selections retain Vitest's built-in exclusions and the same runtime setup.
		exclude: [
			...configDefaults.exclude,
			...(mode === "legacy-test" ? [] : legacyTests),
		],
		css: true,
		// Domain tests use native Node globals; rendering tests opt into the DOM.
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include:
						mode === "legacy-test" ? legacyTests : configDefaults.include,
					// Keep rendering tests in the Svelte project and preserve runner exclusions.
					exclude: [...configDefaults.exclude, "**/*.svelte.test.ts"],
					setupFiles: ["./tests/helpers/fixture-setup.ts"],
				},
			},
			{
				extends: true,
				// Rendering always uses Svelte's browser runtime. Filename ownership
				// stays the same for modern and opt-in legacy component suites.
				resolve: { conditions: ["browser"] },
				test: {
					name: "browser",
					include:
						mode === "legacy-test"
							? legacyTests
									// Intersect broad legacy route globs with the component suffix;
									// colocated route tests must run in the same browser project.
									.map((file) =>
										file.replace("**/*.test.ts", "**/*.svelte.test.ts"),
									)
									.filter((file) => file.endsWith(".svelte.test.ts"))
							: ["**/*.svelte.test.ts"],
					setupFiles: [
						"./tests/helpers/fixture-browser-setup.ts",
						"@testing-library/svelte/vitest",
						"./tests/helpers/setup-dom.ts",
						"./tests/helpers/setup.ts",
					],
					browser: {
						enabled: true,
						headless: true,
						// Match the desktop navigation used by workspace tests. Responsive
						// tests resize explicitly when exercising the phone section picker.
						viewport: { width: 1280, height: 900 },
						provider: playwright({ actionTimeout: testTimeouts.assertion }),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
		// Preparation stays in Node; each runtime loads a private decoded baseline
		// through its own filesystem adapter while preserving bigint values.
		globalSetup: ["./tests/helpers/global-setup.ts"],
		// Required for SvelteKit with Vite 7+
		// Ensures that SvelteKit's virtual modules ($app, __sveltekit) are properly resolved
		server: {
			deps: {
				inline: [
					/@sveltejs\/kit/,
					/@thisux\/sveltednd/,
					/@sentry\/sveltekit/,
					// Load the Effect adapter through the test runner so its test
					// declarations use the same Vitest suite state as direct imports.
					/@effect\/vitest/,
				],
			},
		},
	},
}));
