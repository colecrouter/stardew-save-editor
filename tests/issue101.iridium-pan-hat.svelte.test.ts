import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager } from "../src/lib/SaveManager.svelte";

const injectInvalidHat = (xml: string) =>
	xml.replace(
		"</player>",
		[
			'<hat><isLostItem>false</isLostItem><category>-95</category><hasBeenInInventory>true</hasBeenInInventory><name>Iridium Pan</name><itemId>IridiumPanHat</itemId><specialItem>false</specialItem><isRecipe>false</isRecipe><quality>0</quality><stack>1</stack><SpecialVariable>0</SpecialVariable><which xsi:nil="true" /><skipHairDraw>false</skipHairDraw><ignoreHairstyleOffset>true</ignoreHairstyleOffset><hairDrawType>1</hairDrawType><isPrismatic>false</isPrismatic></hat>',
			"</player>",
		].join(""),
	);

describe("issue #101 malformed hat slot", () => {
	mockIDB();

	it("imports saves with non-hat items written into the hat slot", async () => {
		const baseline = await readFile("tests/TestSave", "utf-8");
		const invalidHatXml = injectInvalidHat(baseline);

		let importTask: Promise<void> = Promise.resolve();
		let saveManager: SaveManager | undefined;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			importTask = saveManager.import(
				new File([invalidHatXml], "Issue101InvalidHat.xml", {
					type: "text/xml",
				}),
			);
		});
		await importTask;
		cleanup();

		const manager = saveManager;
		if (!manager) throw new Error("Save manager not initialised");

		const hatSlotItem = manager.save?.player.inventory.get("hat");
		expect(hatSlotItem).toBeDefined();
		expect(hatSlotItem?.name).toBe("Iridium Pan");
		expect(manager.save?.player.hat).toBeDefined();
		expect(manager.save?.player.hat?.info).toMatchObject({
			_type: "Hat",
			_key: "IridiumPanHat",
			name: "Iridium Pan",
		});
	});
});
