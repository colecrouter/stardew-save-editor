import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

// Run from the repository root after installing that revision's dependencies.
// Choose tools from package.json so the same harness can measure the base commit
// when copied outside the checkout. Logs stay separate from timing metadata.
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const migrated = Boolean(manifest.devDependencies["vite-plus"]);
// The full-save probe deliberately measures the retained legacy codec. Opt in
// when this checkout separates legacy tests, while supporting older revisions.
const legacyTestCommand = manifest.scripts["test:legacy"]
	? "npm run test:legacy"
	: "npm test";
const output = resolve(process.argv[2] ?? "/tmp/stardew-toolchain-benchmark");
mkdirSync(output, { recursive: true });
// npm/npx and Vite+ can select different Node executables. Capture each actual
// Node startup rather than inferring child runtimes from the harness launcher.
// Keep startup overhead inside timings, but parse provenance after timing ends.
const runtimeProbe = join(output, "record-node-runtime.mjs");
writeFileSync(
	runtimeProbe,
	`import { appendFileSync } from "node:fs";
appendFileSync(process.env.TOOLCHAIN_BENCHMARK_NODE_LOG, JSON.stringify({
  version: process.version,
  execPath: process.execPath,
  entrypoint: process.argv[1],
}) + "\\n");
`,
);
// Preserve existing launch options; an encoded file URI stays one option even
// when the output directory contains spaces, without shell interpolation.
const nodeOptions = [
	process.env.NODE_OPTIONS,
	`--import=${pathToFileURL(runtimeProbe).href}`,
]
	.filter(Boolean)
	.join(" ");

/** @param {string} path */
function readNodeProvenance(path) {
	/** @type {Array<{ version: string, execPath: string, entrypoint?: string }>} */
	const nodeProcesses = [];
	/** @type {string[]} */
	const errors = [];
	let journal = "";
	try {
		journal = readFileSync(path, "utf8");
	} catch (error) {
		errors.push(
			error instanceof Error ? error.message : "Missing Node runtime journal",
		);
	}
	for (const line of journal.split("\n").filter(Boolean)) {
		try {
			const record = JSON.parse(line);
			// Validate only the fields our preload writes; do not collect arguments,
			// environment variables or credentials alongside runtime provenance.
			if (
				record === null ||
				typeof record !== "object" ||
				typeof record.version !== "string" ||
				typeof record.execPath !== "string" ||
				(record.entrypoint !== undefined &&
					typeof record.entrypoint !== "string")
			) {
				throw new Error("Invalid Node runtime record");
			}
			nodeProcesses.push({
				version: record.version,
				execPath: record.execPath,
				entrypoint: record.entrypoint,
			});
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: "Unreadable Node runtime record",
			);
		}
	}
	if (nodeProcesses.length === 0)
		errors.push("No Node process reported its runtime");
	// Retain raw records for inspection and distinct runtimes for comparison.
	const selectedNodes = [
		...new Map(
			nodeProcesses.map(({ version, execPath }) => [
				`${execPath}\0${version}`,
				{ version, execPath },
			]),
		).values(),
	];
	return { nodeProcesses, selectedNodes, nodeProvenanceErrors: errors };
}

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
		`${legacyTestCommand} -- tests/e2e.import-export.svelte.test.ts --maxWorkers=1`,
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
	launcherNode: { version: process.version, execPath: process.execPath },
	nodeProvenance:
		"Node startup preload; command wall times include instrumentation overhead",
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
	// Start each command with an empty append-only journal, including failed runs.
	const nodeLog = join(output, `${name}.nodes.jsonl`);
	writeFileSync(nodeLog, "");
	const start = performance.now();
	const result = spawnSync(command, {
		shell: true,
		encoding: "utf8",
		env: {
			...process.env,
			SENTRY_AUTH_TOKEN: "",
			NODE_OPTIONS: nodeOptions,
			TOOLCHAIN_BENCHMARK_NODE_LOG: nodeLog,
		},
		maxBuffer: 64 * 1024 * 1024,
	});
	const seconds = Math.round(performance.now() - start) / 1000;
	const provenance = readNodeProvenance(nodeLog);
	writeFileSync(
		join(output, `${name}.log`),
		`${result.stdout ?? ""}${result.stderr ?? ""}`,
	);
	results.push({
		name,
		command,
		seconds,
		exitCode: result.status,
		error: result.error?.message,
		...provenance,
	});
	writeFileSync(
		join(output, "results.json"),
		JSON.stringify({ ...environment, migrated, results }, null, 2) + "\n",
	);
	console.log(results.at(-1));
}

// Complete the suite to leave useful evidence even if an early check fails.
// A command can succeed while provenance is incomplete; keep that limitation
// explicit and leave a failing harness status instead of inventing child versions.
process.exitCode = results.some(
	(result) => result.exitCode !== 0 || result.nodeProvenanceErrors.length > 0,
)
	? 1
	: 0;
