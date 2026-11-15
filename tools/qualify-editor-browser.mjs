import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus, loadavg, platform, release } from "node:os";

import { Schema } from "effect";
import { chromium } from "playwright";

import { XmlSchema } from "../generated/save-format/save.ts";
import { makeLargeProfileFixture } from "./profile-fixtures.mts";

// Run with `node --import tsx`. This harness drives an already-built production
// preview, never starts a server or changes application code during measurements.
/** @template {string | undefined} T @param {string} key @param {T} fallback @returns {string | T} */
const arg = (key, fallback) => {
	const at = process.argv.indexOf(key);
	return at < 0 ? fallback : (process.argv[at + 1] ?? fallback);
};
const url = arg("--url", "http://127.0.0.1:4269/stardew-save-editor/");
const output = arg("--output", "/tmp/v2-browser-qualification.json");
const mode = arg("--mode", "lab");
const selectedCase = arg("--case", "all");
const executablePath = arg("--chromium", undefined);
/** @param {import("node:crypto").BinaryLike} bytes */
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const decodeSave = Schema.decodeUnknownSync(XmlSchema);
const fixture = readFileSync(new URL("../tests/TestSave", import.meta.url));
const large = Buffer.from(makeLargeProfileFixture(fixture));
// A changed hash means a different workload. Stop rather than silently comparing
// current timings against the old fixture's budgets and evidence.
assert.equal(
	hash(fixture),
	"16f6dfe6a94d84f7a3c36e26850b0efc9bfb72ddd1261857d1bab57a0529aae9",
);
assert.equal(
	hash(large),
	"4a2e22fa6e3e004d09b224ecc7710facfc9d63b389accb5bdf0c2c603e7a825a",
);
const fingerprint = () => {
	const paths = execFileSync(
		"git",
		["ls-files", "-z", "src", "generated", "tools/profile-fixtures.mts"],
		{ encoding: "utf8" },
	)
		.split("\0")
		.filter(Boolean);
	const digest = createHash("sha256");
	// The fingerprint must be identical across locales. Preserve JavaScript's
	// code-unit ordering rather than introducing locale-dependent collation.
	const measuredPaths = [
		...new Set([
			...paths,
			"tools/profile-fixtures.mts",
			"tools/qualify-editor-browser.mjs",
		]),
	].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
	for (const path of measuredPaths)
		digest.update(path).update(readFileSync(path));
	return digest.digest("hex");
};
const result = {
	measuredAt: new Date().toISOString(),
	mode,
	source: {
		commit: execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim(),
		before: fingerprint(),
		after: "",
		stable: false,
		harness: hash(readFileSync(new URL(import.meta.url))),
	},
	runtime: {
		node: process.version,
		platform: platform(),
		os: release(),
		cpu: cpus()[0]?.model,
		loadAtStart: loadavg(),
		browser: "",
	},
	fixtures: {
		public: { sha256: hash(fixture), bytes: fixture.length },
		large: { sha256: hash(large), bytes: large.length, slots: 9012 },
	},
	configuration: {
		url,
		samples: 8,
		warmups: 2,
		pacedNominalGapMs: 50,
		eventTimingDurationThresholdMs: 16,
	},
	// Consumers inspect gates; other measured fields remain attached to each row.
	cases: /** @type {Array<{gates:Record<string,boolean>}>} */ ([]),
	cycles: /** @type {unknown[]} */ ([]),
	hardTimingGatesPass: false,
	failure: /** @type {{message:string,stack?:string}|undefined} */ (undefined),
};
const save = () =>
	writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
/** @param {number[]} values */
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	const lower = sorted[3],
		upper = sorted[4];
	assert(
		lower !== undefined && upper !== undefined,
		"A median requires eight samples",
	);
	return (lower + upper) / 2;
};
/** @param {number[]} values */
const summary = (values) => ({
	samples: values,
	medianMs: median(values),
	maxMs: Math.max(...values),
});
const sectionIds = [
	"inventory",
	"buildings",
	"community",
	"farmers",
	"storage",
	"character",
	"relationships",
	"quests",
	"qi",
	"events",
	"recipes",
	"farm",
	"calendar",
	"review",
];
const headings = [
	"Inventory",
	"Buildings & animals",
	"Community development",
	"Farmhands",
	"Storage",
	"Character",
	"Relationships",
	"Quest journal",
	"Qi's orders",
	"Events",
	"Recipes",
	"Farm settings",
	"Date and weather",
	"Review changes",
];
const browser = await chromium.launch({
	headless: true,
	...(executablePath === undefined ? {} : { executablePath }),
});
result.runtime.browser = browser.version();

/** @param {{viewport: {width:number,height:number},cpu:number}} config @param {Buffer} bytes @param {string} name */
async function open(config, bytes, name) {
	const context = await browser.newContext({
		viewport: config.viewport,
		acceptDownloads: true,
	});
	const page = await context.newPage();
	/** @type {string[]} */
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	// Exercise the shared anchor-download path without invoking an OS picker.
	// Track only URL strings, never Blob/File/DOM references that retain a session.
	await page.addInitScript(() => {
		Reflect.deleteProperty(window, "showSaveFilePicker");
		window.__ownedDownloadUrls = new Set();
		const create = URL.createObjectURL.bind(URL),
			revoke = URL.revokeObjectURL.bind(URL);
		URL.createObjectURL = (blob) => {
			const value = create(blob);
			if (blob instanceof Blob && blob.type === "application/octet-stream")
				window.__ownedDownloadUrls.add(value);
			return value;
		};
		URL.revokeObjectURL = (value) => {
			window.__ownedDownloadUrls.delete(value);
			revoke(value);
		};
	});
	const cdp = await context.newCDPSession(page);
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: config.cpu });
	await page.goto(url);
	await page.getByLabel("Save file", { exact: true }).setInputFiles({
		name,
		mimeType: "application/octet-stream",
		buffer: bytes,
	});
	await page
		.getByRole("button", { name: "Export save", exact: true })
		.waitFor();
	await page.evaluate(() => document.fonts.ready);
	return { context, page, cdp, errors };
}

/** @param {import("playwright").Page} page @param {string} id */
async function navigate(page, id) {
	const expected = headings[sectionIds.indexOf(id)];
	// The observer reads only the active wrapper, first heading and first control.
	// Never enumerate thousands of inventory nodes inside a timing callback.
	return page.evaluate(
		({ id: targetId, expected: expectedHeading }) =>
			new Promise(
				/** @param {(value:number)=>void} resolve @param {(reason:Error)=>void} reject */ (
					resolve,
					reject,
				) => {
					const content = document.querySelector("#editor-content");
					const link = document.querySelector(`a[href="#${targetId}"]`);
					if (!content || !(link instanceof HTMLAnchorElement))
						throw new Error(`Missing navigation target: ${targetId}`);
					const started = performance.now();
					const timer = setTimeout(() => {
						observer.disconnect();
						reject(new Error(`Navigation timeout: ${targetId}`));
					}, 30000);
					const check = () => {
						const active = [...content.children].find(
							(child) =>
								child.tagName === "DIV" && !child.hasAttribute("hidden"),
						);
						const heading = active?.querySelector("h1");
						if (
							heading?.textContent.trim() !== expectedHeading ||
							!active ||
							!active.querySelector("button,input,select,summary")
						)
							return;
						observer.disconnect();
						clearTimeout(timer);
						requestAnimationFrame(() => resolve(performance.now() - started));
					};
					const observer = new MutationObserver(check);
					observer.observe(content, {
						childList: true,
						subtree: true,
						attributes: true,
						attributeFilter: ["hidden"],
					});
					link.click();
					check();
				},
			),
		{ id, expected },
	);
}

/** @param {import("playwright").Page} page */
async function settleReview(page) {
	// Review exposes its heading before the deferred comparison finishes. Let
	// that pending work finish before measuring another *idle* warm transition.
	// Otherwise every fast departure cancels the result and charges its queued
	// copying to the following Inventory navigation, so the cache never warms.
	const started = performance.now();
	await page.waitForFunction(
		() =>
			document.querySelector(".comparison")?.getAttribute("aria-busy") !==
			"true",
	);
	return performance.now() - started;
}

/** @param {import("playwright").Page} page @param {string} kind */
async function arm(page, kind) {
	// Cache the committed farm patch before hiding Review. Its typed comparison
	// intentionally stops updating while hidden, but raw view.net remains live.
	if (kind === "farm") {
		await navigate(page, "farm");
		await page
			.getByRole("textbox", { name: "Farm name", exact: true })
			.fill("PerfSeed");
		await page.getByRole("textbox", { name: "Farm name", exact: true }).blur();
		await navigate(page, "review");
		await page.getByText("Technical details", { exact: true }).click();
		await page.getByText("/SaveGame/player/farmName", { exact: true }).click();
		await page.locator("pre").filter({ hasText: '"PerfSeed"' }).waitFor();
		await navigate(page, "farm");
	} else {
		await navigate(page, "inventory");
		await page
			.getByRole("button", { name: "Slot 5: Parsnip", exact: true })
			.click();
		// The public fixture starts at one, where no quantity badge is rendered.
		// Establish a committed >1 baseline before caching that authoritative node.
		const quantity = page.getByRole("spinbutton", {
			name: "Quantity",
			exact: true,
		});
		await quantity.fill("9");
		await page.waitForFunction(
			() =>
				document
					.querySelector('button[aria-label="Slot 5: Parsnip"] .quantity')
					?.textContent.trim() === "9",
		);
		await quantity.blur();
	}
	const field =
		kind === "farm"
			? page.getByRole("textbox", { name: "Farm name", exact: true })
			: page.getByRole("spinbutton", { name: "Quantity", exact: true });
	await page.evaluate((probeKind) => {
		window.__editorProbe?.dispose();
		const measuredField = [...document.querySelectorAll("input")].find(
			(node) =>
				[...(node.labels ?? [])].some(
					(label) =>
						label.textContent.trim() ===
						(probeKind === "farm" ? "Farm name" : "Quantity"),
				) && !node.closest("[hidden]"),
		);
		const patch = [...document.querySelectorAll("summary code")]
			.find((node) => node.textContent === "/SaveGame/player/farmName")
			?.closest("details")
			?.querySelector("pre");
		const badge = document.querySelector(
			'button[aria-label="Slot 5: Parsnip"] .quantity',
		);
		const node = probeKind === "farm" ? patch : badge;
		if (!measuredField || !node)
			throw new Error(`Missing authoritative ${probeKind} probe`);
		// Measure the authoritative patch value, and reject a changed report format.
		const read = () => {
			if (probeKind !== "farm") return node.textContent.trim();
			/** @type {unknown} */
			const patchValue = JSON.parse(node.textContent);
			if (
				patchValue === null ||
				typeof patchValue !== "object" ||
				!("value" in patchValue) ||
				typeof patchValue.value !== "string"
			)
				throw new Error("Invalid farm-name patch evidence");
			return patchValue.value;
		};
		/** @type {import("./browser-probes.d.ts").EditorProbe} */
		const state = {
			dispose: () => {},
			phase: undefined,
			pending: [],
			commits: [],
			inputs: [],
			keys: [],
			timing: [],
			mismatches: [],
			read,
			field: measuredField,
			node,
		};
		/** @param {Event} event */
		const input = (event) => {
			if (state.phase === undefined || state.phase.length === 0) return;
			const sample = {
				phase: state.phase,
				value: measuredField.value,
				started: performance.now(),
				trusted: event.isTrusted,
				sequence: state.inputs.length,
			};
			state.inputs.push(sample);
			state.pending.push(sample);
		};
		/** @param {Event} event */
		const key = (event) => {
			if (
				state.phase === undefined ||
				state.phase.length === 0 ||
				!(event instanceof KeyboardEvent) ||
				!event.isTrusted ||
				event.key.length !== 1 ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				event.isComposing ||
				event.repeat
			)
				return;
			state.keys.push({
				phase: state.phase,
				type: event.type,
				key: event.key,
				timestamp: event.timeStamp,
				captureBoundMs: performance.now() - event.timeStamp,
			});
		};
		const observer = new MutationObserver(() => {
			if (state.pending.length === 0) return;
			const value = read(),
				first = state.pending[0];
			if (!first) return;
			if (value !== first.value) {
				state.mismatches.push({ expected: first.value, actual: value });
				return;
			}
			state.pending.shift();
			/** @type {import("./browser-probes.d.ts").CommitSample} */
			const record = {
				...first,
				committed: performance.now(),
				commitMs: performance.now() - first.started,
			};
			state.commits.push(record);
			requestAnimationFrame(() => {
				record.frameMs = performance.now() - first.started;
			});
		});
		observer.observe(node, {
			subtree: true,
			childList: true,
			characterData: true,
		});
		/** @type {PerformanceObserver | undefined} */
		let eventObserver;
		if (PerformanceObserver.supportedEntryTypes.includes("event")) {
			eventObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries())
					if (
						"target" in entry &&
						entry.target === measuredField &&
						"processingStart" in entry &&
						typeof entry.processingStart === "number"
					)
						state.timing.push({
							type: entry.name,
							timestamp: entry.startTime,
							processingDelayMs: entry.processingStart - entry.startTime,
						});
			});
			eventObserver.observe({
				type: "event",
				buffered: true,
				durationThreshold: 16,
			});
		}
		measuredField.addEventListener("input", input, true);
		for (const type of ["keydown", "keypress", "keyup"])
			measuredField.addEventListener(type, key, true);
		state.dispose = () => {
			observer.disconnect();
			eventObserver?.disconnect();
			measuredField.removeEventListener("input", input, true);
			for (const type of ["keydown", "keypress", "keyup"])
				measuredField.removeEventListener(type, key, true);
			Reflect.deleteProperty(window, "__editorProbe");
		};
		window.__editorProbe = state;
	}, kind);
	// Warm each independent gesture, and wait on committed DOM instead of the
	// optimistic input. Warmups are outside every measured phase.
	for (let i = 0; i < 2; i++) {
		const value = kind === "farm" ? `Warm${i}` : String(10 + i);
		await field.fill(value);
		await page.waitForFunction(
			(expectedValue) => window.__editorProbe.read() === expectedValue,
			value,
		);
		await field.blur();
	}
	return field;
}

/** @param {import("playwright").Page} page @param {import("playwright").Locator} field @param {string} kind @param {string} name @param {string[]} values */
async function phase(page, field, kind, name, values) {
	const baseline = await page.evaluate(() => window.__editorProbe.read());
	await field.focus();
	await page.evaluate((phaseName) => {
		const p = window.__editorProbe;
		p.phase = phaseName;
		p.pending = [];
		p.commits = [];
		p.inputs = [];
		p.mismatches = [];
	}, name);
	if (name === "burst") {
		// Same-task synthetic queue stress is deliberately separate from trusted
		// typing. Mutation delivery must expose all eight committed values in order.
		await page.evaluate((queuedValues) => {
			const input = window.__editorProbe.field;
			const descriptor = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			);
			// Bypass framework-installed instance setters while preserving the native
			// input receiver. A missing browser setter invalidates this stress probe.
			if (!descriptor?.set)
				throw new Error("Missing native input value setter");
			for (const value of queuedValues) {
				descriptor.set.call(input, value);
				input.dispatchEvent(
					new InputEvent("input", {
						bubbles: true,
						inputType: "insertText",
						data: value,
					}),
				);
			}
		}, values);
	} else {
		for (const [index, value] of values.entries()) {
			if (kind === "quantity") await field.press("ControlOrMeta+A");
			const key = kind === "farm" ? value.at(-1) : value;
			assert(key !== undefined, "A measured input must contain a key");
			await field.press(key);
			if (name === "settled")
				await page.waitForFunction(
					(count) => window.__editorProbe.commits.length === count,
					index + 1,
				);
			else await page.waitForTimeout(50);
		}
	}
	await page.waitForFunction(
		() =>
			window.__editorProbe.commits.length === 8 &&
			window.__editorProbe.pending.length === 0,
		null,
		{ timeout: 30000 },
	);
	await page.evaluate(() => new Promise(requestAnimationFrame));
	await field.blur();
	// Flush EventTiming's filtered delivery outside timed samples.
	await page.waitForTimeout(120);
	const data = await page.evaluate(() => {
		const p = window.__editorProbe;
		p.phase = undefined;
		return {
			inputs: p.inputs,
			commits: p.commits,
			mismatches: p.mismatches,
			value: p.read(),
		};
	});
	assert.deepEqual(
		data.commits.map((sample) => sample.value),
		values,
	);
	assert.equal(data.inputs.length, 8);
	assert(
		data.inputs.every((sample) => sample.trusted === (name !== "burst")),
		"Input trust does not match the declared phase",
	);
	assert.equal(data.value, values.at(-1));
	assert.equal(data.mismatches.length, 0);
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await page.waitForFunction(
		(expectedValue) => window.__editorProbe.read() === expectedValue,
		baseline,
	);
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await page.waitForFunction(
		(expectedValue) => window.__editorProbe.read() === expectedValue,
		values.at(-1),
	);
	const lastCommit = data.commits.at(-1),
		firstInput = data.inputs[0];
	assert(
		lastCommit && firstInput,
		"A completed phase must have input and commit samples",
	);
	const drainMs = lastCommit.committed - firstInput.started;
	return {
		...data,
		baseline,
		groupedUndoRedoExact: true,
		latency: summary(data.commits.map((sample) => sample.commitMs)),
		drainMs,
	};
}

/** @param {import("playwright").Page} page @param {string} kind */
async function feature(page, kind) {
	const field = await arm(page, kind);
	const initial = await page.evaluate(() => window.__editorProbe.read());
	// These fixed ASCII prefixes model eight successive keystrokes; generating
	// step indexes avoids suggesting this fixture segments arbitrary user text.
	const settledValues =
		kind === "farm"
			? Array.from(
					{ length: 8 },
					(_, i) => initial + "abcdefgh".slice(0, i + 1),
				)
			: [2, 3, 4, 5, 6, 7, 8, 9].map(String);
	const settled = await phase(page, field, kind, "settled", settledValues);
	const pacedValues =
		kind === "farm"
			? Array.from(
					{ length: 8 },
					(_, i) => settled.value + "ijklmnop".slice(0, i + 1),
				)
			: [8, 7, 6, 5, 4, 3, 2, 6].map(String);
	const paced = await phase(page, field, kind, "paced", pacedValues);
	const burstValues = Array.from({ length: 8 }, (_, i) =>
		kind === "farm" ? `QueuedFarm${i}` : String(101 + i),
	);
	const burst = await phase(page, field, kind, "burst", burstValues);
	const events = await page.evaluate(() => {
		const p = window.__editorProbe;
		return p.keys.map((key) => ({
			...key,
			eventTiming:
				p.timing.find(
					(entry) =>
						entry.type === key.type && entry.timestamp === key.timestamp,
				) ?? null,
		}));
	});
	assert.equal(
		events.length,
		48,
		"Expected eight settled and eight paced character keydown/keypress/keyup triples",
	);
	assert(
		events.every(
			(event) =>
				Number.isFinite(event.captureBoundMs) && event.captureBoundMs >= 0,
		),
	);
	const limits = {
		inputDelayMaxMs: Math.max(...events.map((event) => event.captureBoundMs)),
		eventTimingMatches: events.filter((event) => event.eventTiming).length,
		eventTimingUnavailable: events.filter((event) => !event.eventTiming).length,
	};
	await page.evaluate(() => window.__editorProbe.dispose());
	return { settled, paced, burst, events, limits, final: burst.value };
}

/** @param {import("playwright").Page} page @param {Buffer} original @param {string} name @param {string} farm @param {string} quantity */
async function exportCheck(page, original, name, farm, quantity) {
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	const download = await downloadPromise;
	assert.equal(download.suggestedFilename(), name);
	const exported = decodeSave(
		new TextDecoder().decode(readFileSync(await download.path())),
	);
	const expected = decodeSave(new TextDecoder().decode(original));
	assert(expected.player, "Fixture has no player");
	expected.player.farmName = farm;
	for (const guest of expected.farmhands ?? [])
		if (guest) guest.farmName = farm;
	const inventory = expected.player.items;
	const item = inventory?.[4];
	assert(inventory && item, "Fixture has no fifth inventory item");
	inventory[4] = { ...item, stack: Number(quantity) };
	assert.deepEqual(exported, expected);
	await download.delete();
	return { exactDocument: true, filename: name };
}

async function lifecycle() {
	// Reuse one page so closing the browser cannot conceal a retained file scope.
	// GC samples are diagnostic renderer-JS observations, not a total memory cap.
	const config = { viewport: { width: 390, height: 900 }, cpu: 1 };
	const { context, page, cdp, errors } = await open(
		config,
		fixture,
		"MemoryFixture_123",
	);
	await cdp.send("Performance.enable");
	const heap = async () => {
		for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");
		const metrics = await cdp.send("Performance.getMetrics");
		const memoryMetric = metrics.metrics.find(
			(metric) => metric.name === "JSHeapUsedSize",
		);
		assert(memoryMetric, "Chrome did not report renderer heap usage");
		return memoryMetric.value;
	};
	const cycles = [];
	try {
		for (let cycle = 0; cycle < 6; cycle++) {
			const big = cycle % 2 === 1;
			const bytes = big ? large : fixture;
			const name = big ? "MemoryLarge_123" : "MemoryFixture_123";
			if (cycle > 0) {
				await page.setViewportSize({ width: 1440, height: 900 });
				await page.getByLabel("Save file", { exact: true }).setInputFiles({
					name,
					mimeType: "application/octet-stream",
					buffer: bytes,
				});
				await page
					.getByRole("button", { name: "Export save", exact: true })
					.waitFor();
			}
			for (const id of sectionIds) await navigate(page, id);
			await navigate(page, "farm");
			const farm = `MemoryFarm${cycle}`;
			await page
				.getByRole("textbox", { name: "Farm name", exact: true })
				.fill(farm);
			await page
				.getByRole("textbox", { name: "Farm name", exact: true })
				.blur();
			await navigate(page, "inventory");
			await page
				.getByRole("button", { name: "Slot 5: Parsnip", exact: true })
				.click();
			const quantity = page.getByRole("spinbutton", {
				name: "Quantity",
				exact: true,
			});
			await quantity.fill("77");
			await quantity.blur();
			await page.waitForFunction(
				() =>
					document
						.querySelector('button[aria-label="Slot 5: Parsnip"] .quantity')
						?.textContent.trim() === "77",
			);
			await page.getByRole("button", { name: "Undo", exact: true }).click();
			await page.waitForFunction(() =>
				[
					...document.querySelectorAll(
						'.inventory-layout > .inspector input[type="number"]',
					),
				].some(
					(node) => node instanceof HTMLInputElement && node.value === "1",
				),
			);
			await page.getByRole("button", { name: "Redo", exact: true }).click();
			await page.waitForFunction(
				() =>
					document
						.querySelector('button[aria-label="Slot 5: Parsnip"] .quantity')
						?.textContent.trim() === "77",
			);
			await navigate(page, "review");
			const preservation = await exportCheck(page, bytes, name, farm, "77");
			const openHeapBytes = await heap();
			await page.getByRole("button", { name: "Exit", exact: true }).click();
			await page.getByLabel("Save file", { exact: true }).waitFor();
			await page.getByLabel("Save file", { exact: true }).focus();
			// Earlier qualification identified short-lived telemetry/automation
			// references. Keep the same nine-second cleanup window before GC.
			await page.waitForTimeout(9000);
			const closedHeapBytes = await heap();
			const owned = await page.evaluate(() => ({
				urls: window.__ownedDownloadUrls.size,
				anchors: document.querySelectorAll("a[download]").length,
				probe: Boolean(window.__editorProbe),
			}));
			assert.deepEqual(owned, { urls: 0, anchors: 0, probe: false });
			assert.deepEqual(errors, []);
			const row = {
				cycle: cycle + 1,
				viewport: page.viewportSize(),
				cpu: config.cpu,
				fixture: big ? "large" : "public",
				openHeapBytes,
				closedHeapBytes,
				preservation,
				owned,
				workers: page.workers().map((worker) => worker.url()),
			};
			cycles.push(row);
			result.cycles = cycles;
			save();
			console.log(JSON.stringify(row));
		}
	} finally {
		await context.close();
	}
}

const cases = [
	{
		id: "desktop-fixture",
		fixture: "public",
		viewport: { width: 1440, height: 900 },
		cpu: 1,
	},
	{
		id: "desktop-large",
		fixture: "large",
		viewport: { width: 1440, height: 900 },
		cpu: 1,
	},
	{
		id: "narrow4x-fixture",
		fixture: "public",
		viewport: { width: 390, height: 900 },
		cpu: 4,
	},
	{
		id: "narrow4x-large",
		fixture: "large",
		viewport: { width: 390, height: 900 },
		cpu: 4,
	},
	{
		id: "narrow4x-large-all-open",
		fixture: "large",
		viewport: { width: 390, height: 900 },
		cpu: 4,
		allOpen: true,
	},
];
try {
	if (mode === "memory") await lifecycle();
	else if (mode !== "lab") throw new Error("Use --mode lab or --mode memory");
	for (const config of cases.filter(
		(item) =>
			mode === "lab" && (selectedCase === "all" || item.id === selectedCase),
	)) {
		const bytes = config.fixture === "public" ? fixture : large;
		const name =
			config.fixture === "public" ? "PerfFixture_123" : "PerfLarge_123";
		const { context, page, errors } = await open(config, bytes, name);
		try {
			const firstInventoryMs = await navigate(page, "inventory");
			if (config.allOpen === true) {
				for (const id of sectionIds) await navigate(page, id);
				await settleReview(page);
			}
			const farm = await feature(page, "farm");
			const quantity = await feature(page, "quantity");
			// Mounting/navigation follows ordinary measurements, except for the
			// explicitly labelled current-full-UI stress case above.
			/** @type {Record<string, number>} */
			const postEditTraversal = {};
			for (const id of sectionIds)
				postEditTraversal[id] = await navigate(page, id);
			const reviewCompletionWaitMs = await settleReview(page);
			/** @type {Array<Record<string, number>>} */
			const warm = [];
			for (let pass = 0; pass < 3; pass++) {
				/** @type {Record<string, number>} */
				const row = {};
				for (const id of sectionIds) row[id] = await navigate(page, id);
				warm.push(row);
			}
			const preservation = await exportCheck(
				page,
				bytes,
				name,
				farm.final,
				quantity.final,
			);
			assert.deepEqual(errors, []);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > innerWidth,
			);
			assert.equal(overflow, false);
			const row = {
				...config,
				firstInventoryMs,
				farm,
				quantity,
				navigation: { postEditTraversal, reviewCompletionWaitMs, warm },
				preservation,
				pageErrors: errors,
				overflow,
			};
			const settledLimit = config.fixture === "public" ? 200 : 300;
			const gates = {
				farmCommit: farm.settled.latency.medianMs <= settledLimit,
				quantityCommit: quantity.settled.latency.medianMs <= settledLimit,
				farmQueue: farm.burst.drainMs <= 1000,
				quantityQueue: quantity.burst.drainMs <= 1000,
				inputDelay:
					Math.max(
						farm.limits.inputDelayMaxMs,
						quantity.limits.inputDelayMaxMs,
					) <= 100,
				firstInventory:
					firstInventoryMs <= (config.fixture === "public" ? 250 : 500),
			};
			const overTarget = Object.keys(warm[0] ?? {}).filter(
				(id) => Math.max(...warm.map((pass) => pass[id] ?? Infinity)) > 100,
			);
			const evidenceRow = {
				...row,
				gates,
				navigation: { ...row.navigation, overTarget },
			};
			result.cases.push(evidenceRow);
			save();
			console.log(
				JSON.stringify({
					case: config.id,
					firstInventoryMs,
					farmMedian: farm.settled.latency.medianMs,
					quantityMedian: quantity.settled.latency.medianMs,
					farmBurst: farm.burst.drainMs,
					quantityBurst: quantity.burst.drainMs,
					delayMax: Math.max(
						farm.limits.inputDelayMaxMs,
						quantity.limits.inputDelayMaxMs,
					),
				}),
			);
		} finally {
			await context.close();
		}
	}
	assert(mode === "memory" || result.cases.length > 0, "Unknown --case");
	if (mode === "lab") {
		result.hardTimingGatesPass = result.cases.every((row) =>
			Object.values(row.gates).every(Boolean),
		);
		if (!result.hardTimingGatesPass) process.exitCode = 1;
	}
} catch (error) {
	result.failure =
		error instanceof Error
			? {
					message: error.message,
					...(error.stack === undefined ? {} : { stack: error.stack }),
				}
			: { message: String(error) };
	save();
	throw error;
} finally {
	result.source.after = fingerprint();
	result.source.stable = result.source.before === result.source.after;
	// Preserve the samples for diagnosis, but reject runs whose workload changed.
	if (!result.source.stable) process.exitCode = 1;
	save();
	await browser.close();
}
