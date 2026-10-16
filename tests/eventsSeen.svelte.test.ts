import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import type { EventIdList } from "../codegen/save";
import { Raw } from "../src/lib/proxies";
import { EventsSeen, toEventId } from "../src/lib/proxies/EventsSeen.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

/** The test save, as if the player hadn't seen any events */
const importWithoutEvents = async () => {
	const xml = (await readFile("tests/TestSave", "utf-8")).replace(
		/<eventsSeen>[\s\S]*?<\/eventsSeen>/,
		"<eventsSeen />",
	);
	let saveManager!: SaveManager;
	let importTask!: Promise<void>;
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		importTask = saveManager.import(new File([xml], "TestSave"));
	});
	await importTask;
	flushSync();
	return { saveManager, cleanup };
};

describe("events seen", () => {
	mockIDB();

	it("reads numeric and string IDs, and writes changes back in order", () => {
		const data: EventIdList = { int: [60367, "Example.Mod_Event"] };
		let events!: EventsSeen;
		const cleanup = $effect.root(() => {
			events = new EventsSeen(data);
		});

		expect(events.has("60367")).toBe(true);
		expect(events.has("Example.Mod_Event")).toBe(true);
		events.delete("60367");
		events.add("1");
		events.add("1");
		flushSync();
		expect(data.int).toEqual(["Example.Mod_Event", "1"]);
		cleanup();
	});

	it("adds events to a save that hasn't seen any", async () => {
		const { saveManager, cleanup } = await importWithoutEvents();

		const player = saveManager.save?.player;
		if (!player) throw new Error("No player");
		expect(player.eventsSeen.size).toBe(0);
		player.eventsSeen.add("60367");
		player.eventsSeen.add("Example.ModId_Event");
		flushSync();
		expect(player[Raw].eventsSeen).toEqual({
			int: ["60367", "Example.ModId_Event"],
		});

		const exported = await (await saveManager.export(true)).text();
		expect(exported).toMatch(
			/<eventsSeen>\s*<int>60367<\/int>\s*<int>Example\.ModId_Event<\/int>\s*<\/eventsSeen>/,
		);
		cleanup();
	});

	it("keeps an empty list empty", async () => {
		const { saveManager, cleanup } = await importWithoutEvents();

		const exported = await (await saveManager.export(true)).text();
		expect(exported).toMatch(/<eventsSeen\s*\/>/);
		cleanup();
	});

	it("drops leading zeros from typed IDs, and refuses numbers that read back differently", () => {
		expect(toEventId(" 1 ")).toBe("1");
		expect(toEventId("01")).toBe("1");
		expect(toEventId("007")).toBe("7");
		expect(toEventId("00")).toBe("0");
		expect(toEventId("-1")).toBe("-1");
		expect(toEventId("1.5")).toBe("1.5");
		expect(toEventId("123abc")).toBe("123abc");
		expect(toEventId("Example.Mod_Event")).toBe("Example.Mod_Event");
		for (const id of [
			"",
			" ",
			"a b",
			"a/b",
			"1e3",
			"1E3",
			"0x1F",
			"1.0",
			"+5",
			"-01",
			".5",
			"5.",
			"-0",
		])
			expect(toEventId(id), id).toBeUndefined();
	});

	it("saves typed IDs so they read back the same", async () => {
		const { saveManager, cleanup } = await importWithoutEvents();
		const typed = ["01", "007", "-1", "1.5", "123abc", "1e400", "Mod.Id_1"];
		const ids = typed.map(toEventId);
		const player = saveManager.save?.player;
		if (!player) throw new Error("No player");
		for (const id of ids) if (id !== undefined) player.eventsSeen.add(id);
		flushSync();

		const exported = await (await saveManager.export()).text();
		const { player: saved } = new XMLManager().parse<SaveFile>(
			exported,
		).SaveGame;
		const events = typeof saved.eventsSeen === "object" ? saved.eventsSeen : {};
		expect(events.int?.map(String)).toEqual([
			"1",
			"7",
			"-1",
			"1.5",
			"123abc",
			"1e400",
			"Mod.Id_1",
		]);
		cleanup();
	});
});
