import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Compare the currently shipped legacy and V2 flows on the same public save.
// Measure click-to-write preparation only: OS interaction and disk writes vary
// independently of the editor. The destination accepts bytes without touching disk.
const argument = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? fallback : process.argv[index + 1];
};
const base = argument("--url", "http://127.0.0.1:4269/stardew-save-editor/");
const output = argument("--output", undefined);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
	for (const editor of ["v2", "legacy"]) {
		const page = await browser.newPage();
		try {
			await page.route(/sentry\.io/, (route) => route.abort());
			await page.addInitScript(() => {
				window.exportBenchmark = { samples: [], cloneCalls: [] };
				const probe = window.exportBenchmark;
				// Track full-document detachment without retaining uploaded data.
				const clone = window.structuredClone.bind(window);
				window.structuredClone = (...args) => {
					const start = performance.now();
					const result = clone(...args);
					if (probe.started !== undefined)
						probe.cloneCalls.push(performance.now() - start);
					return result;
				};
				document.addEventListener(
					"click",
					(event) => {
						const button = event.target.closest("button");
						if (!button?.textContent.includes("Export save")) return;
						probe.cloneCalls = [];
						probe.started = performance.now();
						probe.lastTick = probe.started;
						probe.maxStallMs = 0;
						// A heartbeat distinguishes wall time from a frozen main thread.
						probe.timer = setInterval(() => {
							const now = performance.now();
							probe.maxStallMs = Math.max(
								probe.maxStallMs,
								now - probe.lastTick,
							);
							probe.lastTick = now;
						}, 10);
					},
					true,
				);
				// Accept a destination immediately, then measure until validated bytes
				// are ready. The separate native-picker probe covers activation rules.
				window.showSaveFilePicker = async () => {
					const pickerMs = performance.now() - probe.started;
					const active = navigator.userActivation.isActive;
					return {
						createWritable: async () => ({
							write: async (blob) => {
								clearInterval(probe.timer);
								probe.samples.push({
									elapsedMs: performance.now() - probe.started,
									pickerMs,
									active,
									bytes: blob.size,
									maxStallMs: Math.max(
										probe.maxStallMs,
										performance.now() - probe.lastTick,
									),
									cloneCallsMs: probe.cloneCalls,
								});
								probe.started = undefined;
							},
							close: async () => {},
							abort: async () => {},
						}),
					};
				};
			});
			await page.goto(editor === "legacy" ? `${base}legacy` : base);
			await page
				.getByLabel("Save file", { exact: true })
				.setInputFiles(
					fileURLToPath(new URL("../tests/TestSave", import.meta.url)),
				);
			const button = page.getByRole("button", {
				name: "Export save",
				exact: true,
			});
			await button.waitFor({ timeout: 120_000 });
			const cdp = await page.context().newCDPSession(page);
			for (const rate of [1, 6]) {
				// CDP throttles this renderer's main thread, not the legacy XML worker.
				// Rate 1 compares wall time fairly; rate 6 exposes main-thread work
				// placement and must not be presented as equal slow-device emulation.
				await cdp.send("Emulation.setCPUThrottlingRate", { rate });
				// Keep the first sample visible but exclude it from warmed medians.
				const samples = [];
				for (let iteration = 0; iteration < 6; iteration++) {
					const before = await page.evaluate(
						() => window.exportBenchmark.samples.length,
					);
					await button.click();
					await page.waitForFunction(
						(count) => window.exportBenchmark.samples.length > count,
						before,
						{ timeout: 120_000 },
					);
					const sample = await page.evaluate(() =>
						window.exportBenchmark.samples.at(-1),
					);
					assert(Number.isFinite(sample.elapsedMs));
					samples.push(sample);
				}
				const warmed = samples
					.slice(1)
					.map((sample) => sample.elapsedMs)
					.sort((a, b) => a - b);
				const result = {
					editor,
					rate,
					firstMs: samples[0].elapsedMs,
					medianMs: warmed[2],
					samples,
				};
				results.push(result);
				console.log(JSON.stringify(result));
			}
		} finally {
			await page.close();
		}
	}
} finally {
	await browser.close();
	if (output) writeFileSync(output, JSON.stringify({ base, results }, null, 2));
}
