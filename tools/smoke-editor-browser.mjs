import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { XMLCodec } from "../src/lib/xmlCodec.ts";

// Drive an already-built production preview. Keep browser installation/server
// ownership with the caller; this script never starts a server or reads private saves.
const argument = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? fallback : process.argv[index + 1];
};
const url = argument("--url", "http://127.0.0.1:4269/stardew-save-editor/");
const output = argument("--output", "/tmp/v2-browser-smoke.json");
const browser = await chromium.launch({
	headless: true,
	executablePath: argument("--chromium", undefined),
});
const codec = new XMLCodec();
const bytes = readFileSync(new URL("../tests/TestSave", import.meta.url));
const results = [];
try {
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 1024, height: 600 },
		{ width: 390, height: 900 },
		{ width: 320, height: 700 },
	]) {
		const context = await browser.newContext({
			viewport,
			acceptDownloads: true,
		});
		try {
			const page = await context.newPage(),
				errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			// Use the bounded anchor-download fallback rather than an OS picker.
			await page.addInitScript(() =>
				Reflect.deleteProperty(window, "showSaveFilePicker"),
			);
			await page.goto(url);
			const load = async (buffer) => {
				await page.getByLabel("Save file", { exact: true }).setInputFiles({
					name: "SmokeFarm_123",
					mimeType: "application/octet-stream",
					buffer,
				});
				await page
					.getByRole("button", { name: "Export save", exact: true })
					.waitFor();
				await page.evaluate(() => document.fonts.ready);
			};
			await load(bytes);
			const navigate = async (id) => {
				if (viewport.width <= 900)
					await page.getByLabel("Section", { exact: true }).selectOption(id);
				else await page.locator(`a[href="#${id}"]`).click();
			};
			const sections = await page
				.getByLabel("Section", { exact: true })
				.locator("option")
				.evaluateAll((options) => options.map((option) => option.value));
			assert(sections.length > 0, "No workspace sections");
			for (const id of sections) {
				await navigate(id);
				const geometry = await page.evaluate(() => ({
					width: innerWidth,
					height: innerHeight,
					scrollWidth: document.documentElement.scrollWidth,
					scrollHeight: document.documentElement.scrollHeight,
					missingHints: [
						...document.querySelectorAll('input[type="search"]'),
					].filter((input) => !input.placeholder).length,
				}));
				assert.equal(
					geometry.scrollWidth,
					geometry.width,
					`${id}: horizontal overflow`,
				);
				if (viewport.width > 900)
					assert(
						geometry.scrollHeight <= geometry.height,
						`${id}: desktop document overflow`,
					);
				assert.equal(geometry.missingHints, 0, `${id}: missing search hint`);
			}
			await navigate("farm");
			const name = page.getByRole("textbox", {
				name: "Farm name",
				exact: true,
			});
			const originalName = await name.inputValue(),
				changedName = "Smoke Farm";
			await name.fill(changedName);
			await name.blur();
			await page.getByRole("button", { name: "Undo", exact: true }).click();
			await page.waitForFunction(
				({ element, value }) => element.value === value,
				{ element: await name.elementHandle(), value: originalName },
			);
			await page.getByRole("button", { name: "Redo", exact: true }).click();
			await page.waitForFunction(
				({ element, value }) => element.value === value,
				{ element: await name.elementHandle(), value: changedName },
			);
			// Native desktop dragging has different behavior from simulated DOM events.
			// Undo it before export so the expected document contains only the farm edit.
			if (viewport.width > 900) {
				await navigate("inventory");
				await page
					.getByRole("button", { name: "Slot 5: Parsnip", exact: true })
					.dragTo(
						page.getByRole("button", { name: "Slot 4: Empty", exact: true }),
					);
				await page
					.getByRole("button", { name: "Slot 4: Parsnip", exact: true })
					.waitFor();
				await page.getByRole("button", { name: "Undo", exact: true }).click();
				await page
					.getByRole("button", { name: "Slot 5: Parsnip", exact: true })
					.waitFor();
			}
			const downloadPending = page.waitForEvent("download");
			await page
				.getByRole("button", { name: "Export save", exact: true })
				.click();
			const download = await downloadPending;
			assert.equal(download.suggestedFilename(), "SmokeFarm_123");
			const exportedBytes = readFileSync(await download.path());
			const expected = codec.parse(bytes);
			expected.SaveGame.player.farmName = changedName;
			const farmers = expected.SaveGame.farmhands?.Farmer;
			for (const farmer of Array.isArray(farmers)
				? farmers
				: farmers
					? [farmers]
					: [])
				farmer.farmName = changedName;
			assert.deepEqual(codec.parse(exportedBytes), expected);
			await page.getByRole("button", { name: "Exit", exact: true }).click();
			await load(exportedBytes);
			await navigate("farm");
			await page.waitForFunction(
				({ element, value }) => element.value === value,
				{ element: await name.elementHandle(), value: changedName },
			);
			assert.deepEqual(errors, []);
			assert.equal(await page.locator("vite-error-overlay").count(), 0);
			await download.delete();
			results.push({
				viewport,
				sections: sections.length,
				exactExport: true,
				reimport: true,
				nativeDrag: viewport.width > 900,
				pageErrors: errors,
			});
		} finally {
			await context.close();
		}
	}
} finally {
	await browser.close();
	writeFileSync(output, JSON.stringify({ url, results }, null, 2));
}
console.log(
	`Browser smoke passed for ${results.length} viewports. Evidence: ${output}`,
);
