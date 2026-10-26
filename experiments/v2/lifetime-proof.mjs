// Headless session control for ui-proof.mjs. Invoke on the lab upload screen
// after the UI proof so the editor-model module is already loaded.
export default async function proof(page) {
	await page.evaluate(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.id = "proof-file";
		document.body.append(input);
	});
	await page.locator("#proof-file").setInputFiles("tests/TestSave");
	await page.evaluate(async () => {
		const url = performance
			.getEntriesByType("resource")
			.find((entry) => entry.name.includes("/editor-model.ts")).name;
		const module = await import(url);
		const input = document.querySelector("#proof-file");
		window.__directProof = {
			module,
			bytes: new Uint8Array(await input.files[0].arrayBuffer()),
		};
		input.remove();
	});
	const cdp = await page.context().newCDPSession(page);
	const samples = [];
	try {
		for (let batch = 0; batch < 6; batch++) {
			await page.evaluate(async () => {
				for (let index = 0; index < 5; index++) {
					const opened = await window.__directProof.module.openEditor(
						window.__directProof.bytes,
					);
					try {
						await opened.model.execute([
							{ type: "calendar-date", change: { year: 2 } },
						]);
						await opened.model.undo();
						await opened.model.export();
					} finally {
						await opened.close();
					}
				}
			});
			await cdp.send("HeapProfiler.collectGarbage");
			const counters = await page.evaluate(() =>
				window.__directProof.module.editorResources(),
			);
			if (Object.values(counters).some((value) => value !== 0))
				throw new Error("Session resources survived close");
			samples.push({
				batch,
				heap: (await cdp.send("Runtime.getHeapUsage")).usedSize,
				counters,
			});
		}
		return samples;
	} finally {
		await page.evaluate(() => delete window.__directProof);
	}
}
