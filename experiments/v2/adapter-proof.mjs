// Run after starting the lab. This complements the full UI proof with the
// externally-owned registry contract that ordinary file close does not isolate.
export default async function proof(page) {
	const failures = [];
	page.on("pageerror", (error) => failures.push(String(error)));
	await page.goto("http://127.0.0.1:5190/?flow=editor");
	await page.evaluate(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.id = "adapter-fixture";
		document.body.append(input);
	});
	await page.locator("#adapter-fixture").setInputFiles("tests/TestSave");
	await page.evaluate(async () => {
		const api = await import("/testing/adapter-proof-entry.ts");
		const input = document.querySelector("#adapter-fixture");
		const bytes = new Uint8Array(await input.files[0].arrayBuffer());
		input.remove();
		const session = await api.openEditor(bytes);
		const target = document.createElement("div");
		target.id = "adapter-probe";
		document.body.append(target);
		window.__adapterProof = { api, session, target, instance: undefined };
	});
	const samples = [];
	try {
		for (let cycle = 0; cycle < 10; cycle++) {
			// Edit while no provider/consumer exists, then verify remount freshness.
			await page.evaluate(async (cycle) => {
				const proof = window.__adapterProof;
				await proof.session.model.execute([
					{ type: "calendar-date", change: { day: 7 + cycle } },
				]);
				proof.instance = proof.api.mount(proof.api.AdapterLifecycleProbe, {
					target: proof.target,
					props: { model: proof.session.model },
				});
			}, cycle);
			await page
				.getByLabel("Adapter day")
				.filter({ hasText: String(7 + cycle) })
				.waitFor();
			await page.evaluate(async () => {
				const proof = window.__adapterProof;
				await proof.api.unmount(proof.instance);
				proof.instance = undefined;
			});
			const resources = await page.evaluate(() =>
				window.__adapterProof.api.editorResources(),
			);
			if (
				resources.models !== 1 ||
				resources.registries !== 1 ||
				resources.streams !== 1
			)
				throw new Error(
					`Provider disposed session resources: ${JSON.stringify(resources)}`,
				);
			samples.push(resources);
		}
		// The owner closes only after hook consumers are unmounted. A disposed
		// registry cannot serve another reactive read; unlike a stream completion,
		// disposal is not a final "closed" value for mounted components.
		await page.evaluate(async () => {
			await window.__adapterProof.session.close();
		});
	} finally {
		await page.evaluate(async () => {
			const proof = window.__adapterProof;
			if (proof.instance) await proof.api.unmount(proof.instance);
			await proof.session.close();
			proof.target.remove();
			window.__adapterProofResult = proof.api.editorResources();
			delete window.__adapterProof;
		});
	}
	const closed = await page.evaluate(() => {
		const result = window.__adapterProofResult;
		delete window.__adapterProofResult;
		return result;
	});
	if (Object.values(closed).some((value) => value !== 0) || failures.length)
		throw new Error(
			`Adapter teardown failed: ${JSON.stringify({ closed, failures })}`,
		);
	return { remounts: samples.length, closed, failures };
}
