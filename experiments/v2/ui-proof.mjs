// Run with Playwright CLI's run-code (see docs/v2-workflow-proof.md). No production
// instrumentation or public debug handles are needed beyond resource counters.
export default async function proof(page) {
	const assert = (condition, message) => {
		if (!condition) throw new Error(message);
	};
	const failures = [];
	page.on("pageerror", (error) => failures.push(String(error)));
	await page.goto("http://127.0.0.1:5190/?flow=editor");
	await page.setViewportSize({ width: 1280, height: 800 });
	const load = async () => {
		await page.locator("input[type=file]").setInputFiles("tests/TestSave");
		await page
			.getByRole("heading", { name: "Date and weather", exact: true })
			.waitFor();
	};
	await load();
	await page.getByLabel("Year", { exact: true }).fill("3");
	await page.getByRole("link", { name: "Review changes", exact: true }).click();
	assert(
		await page
			.getByRole("button", { name: "Export save", exact: true })
			.isDisabled(),
		"Draft must block export across navigation",
	);
	await page
		.getByRole("link", { name: "Date and weather", exact: true })
		.click();
	assert(
		(await page.getByLabel("Year", { exact: true }).inputValue()) === "3",
		"Draft lost on navigation",
	);
	await page.getByRole("button", { name: "Apply date", exact: true }).click();
	await page
		.getByText("Current save: Saturday, Spring 6, Year 3", { exact: true })
		.waitFor();
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await page.getByLabel("Year", { exact: true }).fill("4");
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await page.getByText("The save changed.", { exact: false }).waitFor();
	assert(
		(await page.getByLabel("Year", { exact: true }).inputValue()) === "4",
		"Conflict overwrote draft",
	);
	await page
		.getByRole("button", { name: "Reload current date", exact: true })
		.click();
	await page.getByRole("link", { name: "Bundles", exact: true }).click();
	const trigger = page.getByRole("button", {
		name: "Complete bundle",
		exact: true,
	});
	await trigger.click();
	assert(
		await page
			.getByRole("button", { name: "Cancel", exact: true })
			.evaluate((element) => element === document.activeElement),
		"Dialog must initially focus Cancel",
	);
	await page.keyboard.press("Escape");
	assert(
		await trigger.evaluate((element) => element === document.activeElement),
		"Escape must restore trigger focus",
	);
	await trigger.click();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	assert(await trigger.isVisible(), "Cancel must not complete bundle");
	await trigger.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Complete bundle", exact: true })
		.click();
	await page
		.getByText("30 Spring Seeds are available", { exact: false })
		.waitFor();
	await page.waitForFunction(
		() => document.activeElement?.getAttribute("role") === "status",
	);
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await trigger.waitFor();
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await page.getByRole("link", { name: "Review changes", exact: true }).click();
	await page
		.locator("strong")
		.filter({ hasText: "Complete Spring Foraging bundle" })
		.waitFor();
	await page
		.getByText("Operations in this change (1)", { exact: true })
		.last()
		.click();
	await page
		.getByText("Tags: community-center, bundle:13", { exact: true })
		.waitFor();
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	const download = await downloadPromise;
	assert((await download.failure()) === null, "Export failed");
	const exportedPath = await download.path();
	await page.getByRole("button", { name: "Exit", exact: true }).click();
	await page.locator("input[type=file]").setInputFiles(exportedPath);
	await page
		.getByText("Current save: Saturday, Spring 6, Year 3", { exact: true })
		.waitFor();
	await page.getByRole("link", { name: "Review changes", exact: true }).click();
	await page
		.getByRole("heading", { name: "Net changes (0)", exact: true })
		.waitFor();
	const layouts = [];
	for (const width of [1280, 768, 390, 320]) {
		await page.setViewportSize({ width, height: 800 });
		await page
			.getByRole("link", { name: "Date and weather", exact: true })
			.click();
		const dimensions = await page.evaluate(() => ({
			width: innerWidth,
			scroll: document.documentElement.scrollWidth,
		}));
		assert(
			dimensions.scroll <= width,
			`Horizontal overflow at ${width}: ${dimensions.scroll}`,
		);
		layouts.push(dimensions);
	}
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.getByRole("button", { name: "Exit", exact: true }).click();
	const moduleUrl = await page.evaluate(
		() =>
			performance
				.getEntriesByType("resource")
				.find((entry) => entry.name.includes("/editor-model.ts"))?.name,
	);
	assert(moduleUrl, "Model module wasn't observed");
	const counters = () =>
		page.evaluate(
			async (url) => (await import(url)).editorResources(),
			moduleUrl,
		);
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => {
		await cdp.send("HeapProfiler.collectGarbage");
		return (await cdp.send("Runtime.getHeapUsage")).usedSize;
	};
	await page.evaluate(() => {
		const urls = new Set();
		const create = URL.createObjectURL.bind(URL),
			revoke = URL.revokeObjectURL.bind(URL);
		URL.createObjectURL = (value) => {
			const url = create(value);
			urls.add(url);
			return url;
		};
		URL.revokeObjectURL = (url) => {
			urls.delete(url);
			revoke(url);
		};
		window.__proofUrls = urls;
	});
	const samples = [];
	for (let cycle = 0; cycle < 30; cycle++) {
		const start = Date.now();
		await load();
		const imported = Date.now();
		await page.getByLabel("Year", { exact: true }).fill("2");
		await page.getByRole("button", { name: "Apply date", exact: true }).click();
		await page
			.getByText("Current save: Saturday, Spring 6, Year 2", { exact: true })
			.waitFor();
		const edited = Date.now();
		await page
			.getByRole("link", { name: "Review changes", exact: true })
			.click();
		await page.getByRole("button", { name: "Undo", exact: true }).click();
		const pendingDownload = page.waitForEvent("download");
		await page
			.getByRole("button", { name: "Export save", exact: true })
			.click();
		await pendingDownload;
		const exported = Date.now();
		await page.getByRole("button", { name: "Exit", exact: true }).click();
		await page
			.getByRole("heading", { name: "V2 editing workspace", exact: true })
			.waitFor();
		const resources = await counters();
		assert(
			Object.values(resources).every((value) => value === 0),
			`Resources leaked: ${JSON.stringify(resources)}`,
		);
		assert(
			(await page.evaluate(() => window.__proofUrls.size)) === 0,
			"Export object URL leaked",
		);
		samples.push({
			cycle,
			importMs: imported - start,
			editMs: edited - imported,
			reviewUndoExportMs: exported - edited,
			heapBytes: await heap(),
			resources,
		});
	}
	assert(failures.length === 0, `Browser errors: ${failures.join("; ")}`);
	return {
		layouts,
		samples,
		failures,
		browser: await page.context().browser().version(),
	};
}
