import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Probe the real picker rather than the anchor fallback used by the smoke test.
// Run against an existing server; optional --url also accepts the deployed app.
const argument = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? fallback : process.argv[index + 1];
};
const url = argument("--url", "http://127.0.0.1:5173/");
const browser = await chromium.launch({
	channel: argument("--channel", "chrome"),
	headless: true,
});
const results = [];
try {
	for (const rate of [1, 6, 20]) {
		const page = await browser.newPage();
		try {
			// A production reproduction must not send our intentional errors to Sentry.
			await page.route(/sentry\.io/, (route) => route.abort());
			await page.addInitScript(() => {
				window.pickerProbe = { events: [] };
				const probe = window.pickerProbe;
				const nativePicker = window.showSaveFilePicker.bind(window);
				// Capture a trusted click before Svelte starts export. Do not introduce
				// an artificial delay or replace the export/codec implementation.
				document.addEventListener(
					"click",
					(event) => {
						const button = event.target.closest("button");
						if (
							button?.getAttribute("aria-label") !== "Export save" &&
							!button?.textContent.includes("Export save")
						)
							return;
						probe.started = performance.now();
						probe.events.push({
							stage: "click",
							active: navigator.userActivation.isActive,
						});
					},
					true,
				);
				// Delegate to Chrome unchanged: its actual rejection distinguishes
				// missing activation from headless picker cancellation (AbortError).
				window.showSaveFilePicker = async (...args) => {
					probe.events.push({
						stage: "picker",
						elapsedMs: performance.now() - probe.started,
						active: navigator.userActivation.isActive,
					});
					try {
						return await nativePicker(...args);
					} catch (error) {
						probe.events.push({
							stage: "rejection",
							name: error.name,
							message: error.message,
						});
						throw error;
					}
				};
			});
			await page.goto(url);
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
			// Throttle only export, keeping fixture import out of the measurement.
			const cdp = await page.context().newCDPSession(page);
			await cdp.send("Emulation.setCPUThrottlingRate", { rate });
			await button.click();
			await page.waitForFunction(
				() =>
					window.pickerProbe.events.some(
						(event) => event.stage === "rejection",
					),
				undefined,
				{ timeout: 120_000 },
			);
			const events = await page.evaluate(() => window.pickerProbe.events);
			assert.equal(
				events[0].active,
				true,
				"The export must start with a trusted activation",
			);
			assert.equal(
				events.find((event) => event.stage === "picker").active,
				true,
				"The picker must open before export can expire activation",
			);
			assert.equal(
				events.at(-1).name,
				"AbortError",
				"Headless cancellation must not become an activation SecurityError",
			);
			const result = { rate, events };
			results.push(result);
			console.log(JSON.stringify(result));
		} finally {
			await page.close();
		}
	}
} finally {
	await browser.close();
	const output = argument("--output", undefined);
	if (output) writeFileSync(output, JSON.stringify({ url, results }, null, 2));
}
