import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { assertXmlEqual } from "./helpers/xmlDiff";

// helpers moved to tests/helpers/xmlDiff.ts

describe("Import/Export roundtrip", () => {
	mockIDB();
	let saveManager: SaveManager;
	let originalXml: string;

	beforeEach(async () => {
		const fileBlob = await readFile("tests/TestSave");
		originalXml = fileBlob.toString("utf-8");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([fileBlob], "TestSave"));
		});
		await promise;
		cleanup();
	});

	it("exports identical XML after immediate re-export", async () => {
		const blob = await saveManager.export(true);
		const exportedXml = await blob.text();
		assertXmlEqual(originalXml, exportedXml);
		expect(true).toBe(true);
	});
});
