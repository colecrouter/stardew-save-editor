import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { cpus, platform, release } from "node:os";
import { JsonPatch, Result, Schema } from "effect";
import { openEditor } from "../src/lib/editor/editor-model.ts";
import { XMLCodec } from "../src/lib/xmlCodec.ts";
import type { SaveDocument } from "../src/lib/editor/domain.ts";
import {
	setFarmSettings,
	readFarmSettings,
} from "../src/lib/editor/farm-operations.ts";
import {
	readBackpacks,
	readChests,
} from "../src/lib/editor/inventory-views.ts";
import { readCharacters } from "../src/lib/editor/character-operations.ts";
import { readAppearances } from "../src/lib/editor/appearance-operations.ts";
import { readRelationships } from "../src/lib/editor/relationship-operations.ts";
import { readRecipes } from "../src/lib/editor/recipe-operations.ts";
import { readEvents } from "../src/lib/editor/event-operations.ts";
import { readQuestJournals } from "../src/lib/editor/quest-operations.ts";
import { readQiOrders } from "../src/lib/editor/qi-order-operations.ts";

// This harness uses only the committed public fixture. Larger scenarios append
// deterministic synthetic chest data; no local player save is read or printed.
const argument = (name: string, fallback: string) => {
	const index = process.argv.indexOf(name);
	return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};
const samples = Number(argument("--samples", "16"));
const extraChests = Number(argument("--extra-chests", "250"));
const output = argument("--output", "/tmp/editor-profile.json");
if (
	!Number.isInteger(samples) ||
	samples < 4 ||
	!Number.isInteger(extraChests) ||
	extraChests < 1
)
	throw new Error("Use at least 4 samples and one synthetic chest");
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const summary = (values: number[]) => {
	const sorted = values.toSorted((a, b) => a - b);
	return {
		samples: values.length,
		medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
		p95Ms:
			sorted[
				Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
			] ?? 0,
		maxMs: sorted.at(-1) ?? 0,
	};
};
const memory = () => {
	// Forced collection makes phase deltas less dependent on when V8 happens to
	// collect. These are process measurements, not exact retained-object sizes.
	for (let pass = 0; pass < 3; pass++) globalThis.gc?.();
	const value = process.memoryUsage();
	return { heapUsed: value.heapUsed, rss: value.rss, external: value.external };
};
const nativeClone = globalThis.structuredClone;
async function measured<A>(work: () => Promise<A>) {
	let calls = 0,
		cloneMs = 0;
	globalThis.structuredClone = <T,>(
		value: T,
		options?: StructuredSerializeOptions,
	): T => {
		const start = performance.now();
		calls++;
		try {
			return nativeClone(value, options);
		} finally {
			cloneMs += performance.now() - start;
		}
	};
	const started = performance.now();
	try {
		const value = await work();
		await tick();
		return {
			value,
			wallMs: performance.now() - started,
			cloneCalls: calls,
			cloneMs,
		};
	} finally {
		globalThis.structuredClone = nativeClone;
	}
}
const check = <A, E>(
	result: import("../src/lib/editor/command-result.ts").CommandResult<A, E>,
) => {
	if (!result || Result.isFailure(result))
		throw new Error("A benchmark command did not commit");
};
const codec = new XMLCodec();
const fixtureBytes = readFileSync(
	new URL("../tests/TestSave", import.meta.url),
);
function enlarged() {
	const document = codec.parse<SaveDocument>(fixtureBytes);
	const farm = document.SaveGame.locations.GameLocation.find(
		(location) => location.name === "Farm",
	);
	if (!farm) throw new Error("Fixture has no Farm");
	// Objects are a dictionary list in the production fixture. The generated
	// coordinates are unique and fixed; every chest has36 ordinary item records.
	const items =
		typeof farm.objects === "object" && farm.objects
			? farm.objects.item
			: undefined;
	if (!Array.isArray(items))
		throw new Error("Fixture farm objects are unsupported");
	for (let chest = 0; chest < extraChests; chest++)
		items.push({
			key: { Vector2: { X: 2000 + chest, Y: 2000 } },
			value: {
				Object: {
					"@_xsi:type": "Chest",
					name: "Chest",
					items: {
						Item: Array.from({ length: 36 }, (_, slot) => ({
							"@_xsi:type": "Object",
							itemId: "390",
							name: "Stone",
							stack: 20,
							quality: 0,
							bigCraftable: false,
							modData: {
								fixture: "synthetic",
								slot: String(slot),
								payload: "x".repeat(256),
							},
						})),
					},
				},
			},
		});
	return codec.stringify(document);
}
async function scenario(name: string, bytes: Uint8Array) {
	const importStart = performance.now();
	const opened = await openEditor(bytes);
	const model = opened.model;
	const importMs = performance.now() - importStart;
	let sequence = 0;
	const commit = (
		gesture?: import("../src/lib/editor/edit-gesture.ts").EditGesture,
	) =>
		model.commands.edit(
			setFarmSettings({ name: `Profile ${name} ${++sequence}` }),
			gesture ?? model.edits.begin("profile-discrete"),
		);
	try {
		// Establish a changed current document before measuring an active gesture.
		// Otherwise its starting document is also the always-retained import baseline.
		for (let warm = 0; warm < 3; warm++) {
			check(await commit());
			await model.edits.endActive();
		}
		await tick();
		const before = memory();
		const gesture = model.edits.begin("profile-farm-name");
		const sequential = await measured(async () => {
			const times: number[] = [];
			for (let index = 0; index < samples; index++) {
				const start = performance.now();
				check(await commit(gesture));
				times.push(performance.now() - start);
			}
			return summary(times);
		});
		const active = memory();
		const closure = await measured(() => model.edits.end(gesture));
		const ended = memory();
		// Submit all commands before awaiting. Each latency includes time waiting for
		// earlier edits, matching a rapid typing burst rather than independent calls.
		const burstGesture = model.edits.begin("profile-burst");
		const burst = await measured(async () => {
			const pending = Array.from({ length: 8 }, () => {
				const start = performance.now();
				return commit(burstGesture).then((result) => {
					check(result);
					return performance.now() - start;
				});
			});
			return summary(await Promise.all(pending));
		});
		await model.edits.end(burstGesture);
		await tick();
		const details = await (async () => {
			const state = await model.snapshot();
			// A cache preserving the previous detached mutable-view contract must copy its
			// result on every hit. Measure that lower bound before adding invalidation
			// plumbing: descriptor-rich inventory views can cost more to clone than
			// rebuilding them from detached raw slot arrays.
			const cachedChests = readChests(state);
			const probes: Record<string, () => unknown> = {
				cachedChestDetachment: () => structuredClone(cachedChests),
				farm: () => readFarmSettings(state.document),
				backpacks: () => readBackpacks(state),
				chests: () => readChests(state),
				character: () => readCharacters(state.document),
				appearance: () => readAppearances(state.document),
				relationships: () => readRelationships(state.document),
				recipes: () => readRecipes(state.document),
				events: () => readEvents(state.document),
				quests: () => readQuestJournals(state.document),
				qiOrders: () => readQiOrders(state.document),
				baselineDiff: () =>
					JsonPatch.get(
						state.baseline as unknown as Schema.Json,
						state.document as unknown as Schema.Json,
					),
			};
			const projections: Record<string, ReturnType<typeof summary>> = {};
			for (const [key, read] of Object.entries(probes)) {
				const durations: number[] = [];
				for (let pass = 0; pass < 5; pass++) {
					const start = performance.now();
					read();
					durations.push(performance.now() - start);
				}
				projections[key] = summary(durations);
			}
			return {
				documentJsonBytes: Buffer.byteLength(JSON.stringify(state.document)),
				serializedHistoryBytes: state.retainedBytes,
				entries: state.entries.length,
				inventorySlots: Object.values(state.identities).reduce(
					(sum, slots) => sum + slots.length,
					0,
				),
				projectionProbes: projections,
			};
		})();
		await opened.close();
		await tick();
		return {
			name,
			xmlBytes: bytes.byteLength,
			importMs,
			...details,
			sequential,
			burst,
			closure,
			memory: {
				beforeGesture: before,
				activeGesture: active,
				afterEnd: ended,
				afterClose: memory(),
			},
			note: "Projection probes exclude calendar option assembly, registry dispatch and view entry mapping. Clone timing is instrumented wall time; memory deltas are GC-conditioned process observations.",
		};
	} finally {
		await opened.close();
	}
}
// Record the exact source inputs because concurrent cleanup edits can land while
// collecting samples. Matching hashes show the measured core stayed stable.
const sourcePaths = [
	"src/app.html",
	"src/lib/editor/plain-data.ts",
	"src/lib/editor/transaction-draft.ts",
	"src/lib/editor/history.ts",
	"src/lib/editor/editor-model.ts",
	"src/lib/editor/inventory-operations.ts",
	"src/lib/editor/inventory-views.ts",
	"src/lib/editor/item-presentation.ts",
	"src/lib/editor/immutable-view.ts",
	"src/lib/editor/appearance-operations.ts",
	"src/lib/editor/appearance-preview.ts",
	"src/lib/editor/item-catalog.ts",
];
const sourceFingerprint = () =>
	Object.fromEntries(
		sourcePaths.map((path) => [
			path,
			createHash("sha256")
				.update(readFileSync(new URL(`../${path}`, import.meta.url)))
				.digest("hex"),
		]),
	);
const sourcesBefore = sourceFingerprint();
const result = {
	measuredAt: new Date().toISOString(),
	source: {
		commit: execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim(),
		before: sourcesBefore,
	},
	runtime: {
		node: process.version,
		platform: platform(),
		release: release(),
		cpu: cpus()[0]?.model,
		forcedGc: typeof globalThis.gc === "function",
	},
	configuration: {
		samples,
		burst: 8,
		extraChests,
		chestSlots: 36,
		syntheticOpaqueCharacters: 256,
	},
	scenarios: [
		await scenario("fixture", fixtureBytes),
		await scenario("large", enlarged()),
	],
};
const sourcesAfter = sourceFingerprint();
Object.assign(result.source, {
	after: sourcesAfter,
	stable: JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter),
});
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(
	JSON.stringify(
		{
			output,
			sourceStable:
				JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter),
			scenarios: result.scenarios.map((row) => ({
				name: row.name,
				xmlBytes: row.xmlBytes,
				sequential: row.sequential.value,
				burst: row.burst.value,
				closureClones: row.closure.cloneCalls,
				heapActiveMinusEnded:
					row.memory.activeGesture.heapUsed - row.memory.afterEnd.heapUsed,
			})),
		},
		null,
		2,
	),
);
