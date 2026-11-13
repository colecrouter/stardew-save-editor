import { recommended as effectRules } from "@effect/tsgo/oxlint-presets";
import { sentrySvelteKit } from "@sentry/sveltekit/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite-plus";
import { configDefaults } from "vitest/config";
import legacy from "vite-plugin-sveltekit-legacy";

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
	// Share formatting and linting with the same versioned toolchain as builds/tests.
	fmt: {
		// Svelte formatting is opt-in in Oxfmt; preserve the existing component policy.
		svelte: true,
		useTabs: true,
		endOfLine: "lf",
		printWidth: 80,
		sortImports: false,
		sortPackageJson: false,
		ignorePatterns: [
			"content/**",
			"generated/**",
			"static/**",
			"**/package-lock.json",
			".cache/**",
			"tools/xnbhack/upstream/**",
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
				},
			},
		],
	},
	lint: {
		// Keep Effect diagnostics available in Oxlint as well as native compiler checks.
		extends: [effectRules],
		options: { typeAware: true },
		// Correctness findings block CI; intentional exceptions belong beside their
		// implementation so a future change cannot silently inherit a downgrade.
		categories: { correctness: "error" },
		rules: {
			// Atom APIs are an explicitly adopted foundation, matching tsconfig.base.json.
			"effecttsgo/unstable-api-usage": "off",
		},
		// Game assets, generated output and vendored extraction sources are not maintained app code.
		ignorePatterns: [
			"content/**",
			"generated/**",
			"static/**",
			"build/**",
			".svelte-kit/**",
			".cache/**",
			"tools/xnbhack/upstream/**",
		],
		overrides: [
			{
				files: ["**/*.svelte"],
				// Template references and rune bindings are owned by svelte-check.
				rules: { "no-unused-vars": "off", "no-undef": "off" },
			},
		],
	},

	plugins: [
		mode === "production"
			? sentrySvelteKit({
					// Sentry 11 accepts bundler options directly; explicit credentials
					// also let benchmarks suppress uploads despite a local dotenv file.
					authToken: process.env.SENTRY_AUTH_TOKEN,
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
					process.env.NODE_ENV === "production" ? "/stardew-save-editor" : "",
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
			// Tests inspect computed styles, so inject CSS rather than extracting it.
			compilerOptions: process.env.VITEST ? { css: "injected" } : {},
			inspector: true,
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
		// Install cleanup in the rendering project so Node tests avoid DOM setup.
		svelteTesting({ autoCleanup: false }),
	],
	server: {
		fs: {
			// The project root, for generated/ and codegen/ (outside src/). Not "..":
			// that would let the dev server hand out any file next to the clone
			allow: ["."],
		},
	},
	optimizeDeps: {
		include: ["idb", "@thisux/sveltednd", "comlink", "@sentry/sveltekit"],
	},
	test: {
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
				},
			},
			{
				extends: true,
				test: {
					name: "svelte",
					environment: "happy-dom",
					// Keep discovery in each project: inherited include arrays merge,
					// which would otherwise collect Node tests in happy-dom as well.
					include:
						mode === "legacy-test"
							? legacyTests.filter((file) => file.endsWith(".svelte.test.ts"))
							: ["**/*.svelte.test.ts"],
					// DOM cleanup and simulated browser workers belong only to rendering tests.
					setupFiles: [
						"@vitest/web-worker",
						"@testing-library/svelte/vitest",
						"./tests/helpers/setup.ts",
					],
				},
			},
		],
		globalSetup: ["./tests/helpers/global-setup.ts"],
		setupFiles: ["./tests/helpers/fixture-setup.ts"],
		// Required for SvelteKit with Vite 7+
		// Ensures that SvelteKit's virtual modules ($app, __sveltekit) are properly resolved
		server: {
			deps: {
				inline: [/@sveltejs\/kit/, /@thisux\/sveltednd/, /@sentry\/sveltekit/],
			},
		},
	},
}));
