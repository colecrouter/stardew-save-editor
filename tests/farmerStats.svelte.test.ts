import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager } from "../src/lib/SaveManager.svelte";

const removeStatValues = (xml: string) =>
	xml.replace(/<Values>[\s\S]*?<\/Values>/, "<Values />");

describe("Farmer stats", () => {
	mockIDB();

	it("treats missing stat values as zero", async () => {
		const baseline = await readFile("tests/TestSave", "utf-8");
		const saveXml = removeStatValues(baseline);

		let importTask: Promise<void> = Promise.resolve();
		let saveManager: SaveManager | undefined;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			importTask = saveManager.import(
				new File([saveXml], "MissingStatsValues.xml", { type: "text/xml" }),
			);
		});
		await importTask;
		cleanup();

		const player = saveManager?.save?.player;
		expect(player?.trinketSlots).toBe(0);
		expect(player?.trinketsUnlocked).toBe(false);
	});
});
