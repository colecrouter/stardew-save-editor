import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

// Run from the repository root after installing that revision's dependencies.
// Choose tools from package.json so the same harness can measure the base commit
// when copied outside the checkout. Logs stay separate from timing metadata.
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const migrated = Boolean(manifest.devDependencies["vite-plus"]);
const output = resolve(process.argv[2] ?? "/tmp/stardew-toolchain-benchmark");
mkdirSync(output, { recursive: true });
// Each benchmark entry pairs a stable log name with its shell command.
/** @type {Array<[string, string]>} */
// The old combined project and new scopes must both cover app, test and tooling
// inputs; separate Svelte passes preserve each scope's intended ambient globals.
const commands = [
	["lint", migrated ? "npm run lint" : "npx --no-install biome lint ."],
	[
		"types",
		migrated
			? "npm run check:types && node node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.tests.json && npm run check:tooling"
			: "npm run check:types",
	],
	[
		"svelte",
		migrated
			? "npx --no-install svelte-check --tsgo --tsconfig ./tsconfig.app.json && npx --no-install svelte-check --tsgo --tsconfig ./tsconfig.tests.json"
			: "npx --no-install svelte-check --tsconfig ./tsconfig.json",
	],
	[
		"test",
		"npm test -- tests/editor/inventory-operations.test.ts tests/editor/chest-inventory.test.ts --maxWorkers=2",
	],
	// Keep codec-heavy preservation work separate from the small inventory probe.
	// Fixed concurrency is only a measurement control; normal tests remain uncapped.
	[
		"test-full-save",
		"npm test -- tests/e2e.import-export.svelte.test.ts --maxWorkers=1",
	],
	["build", "npm run build"],
];

// Measure sequential wall time to avoid competing benchmark commands. One run
// is a local observation, not a statistical claim; record failures as well as
// successful runs so a faster failing command cannot masquerade as improvement.
// Disable authenticated Sentry uploads so network/credentials do not skew builds.
// Pin the checkout and machine characteristics beside each run. A dirty tree is
// explicit because an unchanged commit ID alone cannot identify measured code.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const status = spawnSync("git", ["status", "--porcelain"], {
	encoding: "utf8",
});
const environment = {
	node: process.version,
	platform: process.platform,
	architecture: process.arch,
	availableParallelism: availableParallelism(),
	cpuModel: cpus()[0]?.model,
	memoryBytes: totalmem(),
	revision: revision.status === 0 ? revision.stdout.trim() : undefined,
	dirty: status.status === 0 ? Boolean(status.stdout.trim()) : undefined,
};
const results = [];
for (const [name, command] of commands) {
	const start = performance.now();
	const result = spawnSync(command, {
		shell: true,
		encoding: "utf8",
		env: { ...process.env, SENTRY_AUTH_TOKEN: "" },
		maxBuffer: 64 * 1024 * 1024,
	});
	writeFileSync(
		join(output, `${name}.log`),
		`${result.stdout ?? ""}${result.stderr ?? ""}`,
	);
	results.push({
		name,
		command,
		seconds: Math.round(performance.now() - start) / 1000,
		exitCode: result.status,
		error: result.error?.message,
	});
	writeFileSync(
		join(output, "results.json"),
		JSON.stringify({ ...environment, migrated, results }, null, 2) + "\n",
	);
	console.log(results.at(-1));
}

// Complete the suite to leave useful evidence even if an early check fails.
process.exitCode = results.some((result) => result.exitCode !== 0) ? 1 : 0;
