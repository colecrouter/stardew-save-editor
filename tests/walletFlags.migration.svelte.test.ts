import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { MailFlag } from "../src/lib/proxies/Mail.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";

const injectLegacyWalletNodes = (xml: string) =>
	xml.replace(
		'<catPerson xsi:nil="true" />',
		[
			'<catPerson xsi:nil="true" />',
			"        <hasRustyKey />",
			"        <HasTownKey />",
			'        <hasMagnifyingGlass xsi:nil="true" />',
		].join("\n"),
	);

describe("wallet flag migration", () => {
	mockIDB();

	it("removes legacy wallet fields and rewrites unlocked flags into mail", async () => {
		const baseline = await readFile("tests/TestSave", "utf-8");
		const legacyXml = injectLegacyWalletNodes(baseline);

		let importTask: Promise<void> = Promise.resolve();
		let saveManager: SaveManager | undefined;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			importTask = saveManager.import(
				new File([legacyXml], "LegacyWalletSave.xml", { type: "text/xml" }),
			);
		});
		await importTask;
		cleanup();

		expect(saveManager).toBeDefined();
		const manager = saveManager;
		if (!manager) throw new Error("Save manager not initialised");
		const player = manager.save?.player;
		expect(player).toBeDefined();
		const raw = player?.raw ?? {};
		expect("hasRustyKey" in raw).toBe(false);
		expect("HasTownKey" in raw).toBe(false);
		expect("hasMagnifyingGlass" in raw).toBe(false);

		const mail = player?.mailReceived;
		expect(mail).toBeDefined();
		expect(mail?.has(MailFlag.HasRustyKey)).toBe(true);
		expect(mail?.has(MailFlag.HasTownKey)).toBe(true);
		expect(mail?.has(MailFlag.HasMagnifyingGlass)).toBe(false);
	});
});
