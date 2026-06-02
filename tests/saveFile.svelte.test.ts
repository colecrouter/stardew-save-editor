import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import type { Player, Save } from "../codegen/save";
import { SaveProxy } from "../src/lib/proxies/SaveFile.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("SaveProxy", () => {
	mockIDB();

	it("parses a single cellar assignment item as an array", () => {
		const raw = new XMLManager().parse<SaveFile>(`
			<SaveGame>
				<cellarAssignments>
					<item>
						<key><int>1</int></key>
						<value><long>123</long></value>
					</item>
				</cellarAssignments>
			</SaveGame>
		`);

		expect(Array.isArray(raw.SaveGame.cellarAssignments.item)).toBe(true);
		expect(raw.SaveGame.cellarAssignments.item).toHaveLength(1);
		expect(raw.SaveGame.cellarAssignments.item[0]?.value.long).toBe(123);
	});

	it("keeps cellar assignments aligned when promoting a farmhand to host", async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		let importTask: Promise<void> = Promise.resolve();
		let saveManager!: SaveManager;
		const managerCleanup = $effect.root(() => {
			saveManager = new SaveManager();
			importTask = saveManager.import(
				new File([xml], "TestSave", { type: "text/xml" }),
			);
		});
		await importTask;
		flushSync();

		const raw = saveManager.save?.raw;
		if (!raw) throw new Error("Expected imported save");

		const host = raw.SaveGame.player;
		const farmhand = clone(host);
		const hostId = host.UniqueMultiplayerID;
		const farmhandId = 123456789;

		farmhand.name = "Farmhand";
		farmhand.UniqueMultiplayerID = farmhandId;
		farmhand.homeLocation = "FarmHouse2";
		raw.SaveGame.farmhands = { Farmer: [farmhand as Player] };
		raw.SaveGame.cellarAssignments = {
			item: [
				{ key: { int: 1 }, value: { long: hostId } },
				{ key: { int: 2 }, value: { long: farmhandId } },
			],
		} as Save["cellarAssignments"];

		let save!: SaveProxy;
		const cleanup = $effect.root(() => {
			save = new SaveProxy(raw);
		});
		flushSync();

		const promotedFarmhand = save.players[1];
		const demotedHost = save.players[0];
		if (!promotedFarmhand || !demotedHost) {
			throw new Error("Expected host and farmhand");
		}
		save.players = [promotedFarmhand, demotedHost];
		flushSync();
		cleanup();
		managerCleanup();

		expect(raw.SaveGame.player.UniqueMultiplayerID).toBe(farmhandId);
		expect(raw.SaveGame.farmhands.Farmer[0]?.UniqueMultiplayerID).toBe(hostId);

		const assignments = new Map(
			raw.SaveGame.cellarAssignments.item.map((item) => [
				item.key.int,
				item.value.long,
			]),
		);
		expect(assignments.get(1)).toBe(farmhandId);
		expect(assignments.get(2)).toBe(hostId);
	});
});
