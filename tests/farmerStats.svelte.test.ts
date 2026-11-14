import publicSaveXml from "./TestSave?raw";
import { describe, expect, it } from "vitest";
import { SaveManager } from "../src/lib/SaveManager.svelte";

const removeStatValues = (xml: string) =>
	xml.replace(/<Values>[\s\S]*?<\/Values>/, "<Values />");

// Full public-save fixtures verify codec correctness rather than latency. The
// shared runner deadline covers this work under normal test concurrency.
describe("Farmer stats", () => {
	it("treats missing stat values as zero", async () => {
		const baseline = publicSaveXml;
		const saveXml = removeStatValues(baseline);

		let importTask: Promise<void | boolean> = Promise.resolve();
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
