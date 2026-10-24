import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import { getStatValue, setStatValue } from "$lib/proxies/Farmer.svelte";
import { Item } from "$lib/proxies/Item.svelte";
import { masteryLevel } from "$lib/proxies/Skills.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";
import { withHouse, withToolAtClint } from "./helpers/upgrades";

// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
type Parsed = any;

async function importSave(xml: string): Promise<SaveManager> {
	let saveManager!: SaveManager;
	let promise: Promise<void> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([xml], "TestSave"));
	});
	await promise;
	flushSync();
	cleanup();
	return saveManager;
}

const stat = (key: string, value: number) =>
	`<item><key><string>${key}</string></key><value><unsignedInt>${value}</unsignedInt></value></item>`;

/** Add stats to the main player's (in the test save, the first <Values>) */
const withStats = (xml: string, ...stats: string[]) =>
	xml.replace("<Values>", `<Values>${stats.join("")}`);

const removeStatValues = (xml: string) =>
	xml.replace(/<Values>[\s\S]*?<\/Values>/, "<Values />");

describe("Farmer upgrades", () => {
	mockIDB();
	let xml: string;
	let saveManager: SaveManager;

	beforeEach(async () => {
		xml = await readFile("tests/TestSave", "utf-8");
		saveManager = await importSave(xml);
	});

	const player = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save.player;
	};
	const exported = async (): Promise<Parsed> =>
		new XMLManager().parse(await (await saveManager.export()).text());

	describe("Backpack", () => {
		it("grows like buying one from Pierre", () => {
			const farmer = player();
			expect(farmer.maxItems).toBe(12);
			expect(farmer.inventory.slotCount).toBe(12);

			farmer.setBackpackSize(24);
			expect(farmer[Raw].maxItems).toBe(24);
			expect(farmer[Raw].items.Item).toHaveLength(24);
			expect(farmer[Raw].items.Item[23]).toEqual({ "@_xsi:nil": "true" });
			expect(farmer.inventory.slotCount).toBe(24);

			farmer.setBackpackSize(36);
			expect(farmer[Raw].items.Item).toHaveLength(36);
			farmer.setBackpackSize(12);
			expect(farmer.maxItems).toBe(12);
			expect(farmer[Raw].items.Item).toHaveLength(12);
		});

		it("won't shrink over items, or take a size the game doesn't sell", () => {
			const farmer = player();
			farmer.setBackpackSize(24);
			farmer.inventory.set(20, Item.fromName("Parsnip"));

			expect(farmer.canResizeBackpack(12)).toBe(false);
			expect(farmer.canResizeBackpack(36)).toBe(true);
			expect(() => farmer.setBackpackSize(12)).toThrow(
				"Empty slots 13 to 24 of the backpack first",
			);
			expect(() => farmer.setBackpackSize(30)).toThrow("12, 24 or 36");
			expect(farmer[Raw].items.Item).toHaveLength(24);
			expect(farmer.maxItems).toBe(24);
		});

		it("won't shrink over a Secret Note, which the inventory doesn't load", () => {
			const farmer = player();
			farmer.setBackpackSize(24);
			const note = {
				"@_xsi:type": "Object",
				name: "Secret Note #7",
				itemId: "79",
				stack: 1,
			};
			(farmer[Raw].items.Item as Parsed[])[20] = note;

			expect(farmer.inventory.get(20)).toBeUndefined();
			expect(farmer.canResizeBackpack(12)).toBe(false);
			expect(() => farmer.setBackpackSize(12)).toThrow(
				"Empty slots 13 to 24 of the backpack first",
			);
			expect(farmer[Raw].items.Item[20]).toBe(note);
		});

		it("keeps the new size through an export", async () => {
			player().setBackpackSize(24);
			const parsed = await exported();
			expect(parsed.SaveGame.player.maxItems).toBe(24);
			expect(parsed.SaveGame.player.items.Item).toHaveLength(24);
		});
	});

	describe("House", () => {
		it("counts down to an upgrade the game does overnight", () => {
			const farmer = player();
			expect(farmer.houseUpgradeLevel).toBe(0);
			expect(farmer.daysUntilHouseUpgrade).toBe(-1);

			farmer.daysUntilHouseUpgrade = 1;
			expect(farmer[Raw].daysUntilHouseUpgrade).toBe(1);
			// The game changes the level, and moves the furniture, when it gets to 0
			expect(farmer[Raw].houseUpgradeLevel).toBe(0);

			// 0 means no upgrade, which the game saves as -1
			farmer.daysUntilHouseUpgrade = 0;
			expect(farmer[Raw].daysUntilHouseUpgrade).toBe(-1);
			expect(() => {
				farmer.daysUntilHouseUpgrade = 4;
			}).toThrow("up to 3 days");
		});

		it("stops an upgrade Robin has started", async () => {
			saveManager = await importSave(withHouse(xml, 1, 2));
			const farmer = player();
			expect(farmer.houseUpgradeLevel).toBe(1);
			expect(farmer.daysUntilHouseUpgrade).toBe(2);

			farmer.daysUntilHouseUpgrade = -1;
			const parsed = await exported();
			expect(parsed.SaveGame.player.daysUntilHouseUpgrade).toBe(-1);
			expect(parsed.SaveGame.player.houseUpgradeLevel).toBe(1);
		});

		it("won't upgrade past the cellar", async () => {
			saveManager = await importSave(withHouse(xml, 3));
			const farmer = player();
			expect(() => {
				farmer.daysUntilHouseUpgrade = 1;
			}).toThrow("fully upgraded");
			expect(farmer[Raw].daysUntilHouseUpgrade).toBe(-1);
		});
	});

	describe("Trash can and Clint", () => {
		it("sets the trash can's level", () => {
			const farmer = player();
			expect(farmer.trashCanLevel).toBe(0);
			farmer.trashCanLevel = 4;
			expect(farmer[Raw].trashCanLevel).toBe(4);
			for (const level of [-1, 5, 1.5])
				expect(() => {
					farmer.trashCanLevel = level;
				}).toThrow("0 to 4");
			expect(farmer[Raw].trashCanLevel).toBe(4);
		});

		it("finishes the tool Clint is upgrading", async () => {
			expect(player().toolBeingUpgraded).toBeUndefined();

			saveManager = await importSave(withToolAtClint(xml, 2));
			const farmer = player();
			expect(farmer.toolBeingUpgraded?.itemId).toBe("CopperPickaxe");
			expect(farmer.trashCanAtClint).toBe(false);
			expect(farmer.daysLeftForToolUpgrade).toBe(2);

			farmer.daysLeftForToolUpgrade = 0;
			expect(farmer[Raw].daysLeftForToolUpgrade).toBe(0);
			expect(() => {
				farmer.daysLeftForToolUpgrade = 3;
			}).toThrow("0 to 2 days");

			const parsed = await exported();
			expect(parsed.SaveGame.player.daysLeftForToolUpgrade).toBe(0);
			expect(parsed.SaveGame.player.toolBeingUpgraded).toMatchObject({
				"@_xsi:type": "Pickaxe",
				itemId: "CopperPickaxe",
			});
		});

		it("leaves the trash can alone while Clint has it", async () => {
			saveManager = await importSave(withToolAtClint(xml, 1, "CopperTrashCan"));
			const farmer = player();
			expect(farmer.trashCanAtClint).toBe(true);
			// Collecting it upgrades it again
			expect(() => {
				farmer.trashCanLevel = 2;
			}).toThrow("collect it first");
			expect(farmer[Raw].trashCanLevel).toBe(0);
		});
	});

	describe("Mastery", () => {
		it("works out the level from the XP", () => {
			expect(
				[0, 9999, 10000, 25000, 44999, 99999, 100000, 250000].map(masteryLevel),
			).toEqual([0, 0, 1, 2, 2, 4, 5, 5]);
		});

		it("doesn't add the stat to a save that has none", () => {
			const farmer = player();
			expect(farmer.masteryExp).toBe(0);
			expect(farmer.masteryLevelsSpent).toBe(0);
			expect(
				farmer[Raw].stats.Values?.item?.some((s) =>
					/mastery/i.test(String(s.key.string)),
				),
			).toBe(false);
		});

		it("sets Mastery XP", () => {
			const farmer = player();
			farmer.masteryExp = 25000;
			expect(farmer[Raw].stats.Values?.item).toContainEqual({
				key: { string: "MasteryExp" },
				value: { unsignedInt: 25000 },
			});
			expect(masteryLevel(farmer.masteryExp)).toBe(2);

			// Like the game, a stat of 0 is left out
			farmer.masteryExp = 0;
			expect(getStatValue(farmer[Raw], "MasteryExp")).toBe(0);
			expect(
				farmer[Raw].stats.Values?.item?.some(
					(s) => s.key.string === "MasteryExp",
				),
			).toBe(false);
		});

		it("adds the stat to an empty stats list", async () => {
			saveManager = await importSave(removeStatValues(xml));
			const farmer = player();
			farmer.masteryExp = 10000;
			expect(getStatValue(farmer[Raw], "MasteryExp")).toBe(10000);
		});

		it("matches stat keys whatever their case, as the game does", async () => {
			saveManager = await importSave(withStats(xml, stat("masteryExp", 12000)));
			const farmer = player();
			expect(farmer.masteryExp).toBe(12000);
			farmer.masteryExp = 30000;
			const mastery = farmer[Raw].stats.Values?.item?.filter((s) =>
				/^masteryexp$/i.test(String(s.key.string)),
			);
			// Updated in place, not added a second time
			expect(mastery).toEqual([
				{ key: { string: "masteryExp" }, value: { unsignedInt: 30000 } },
			]);
		});

		it("can't go below what the claimed masteries cost", async () => {
			saveManager = await importSave(
				withStats(
					xml,
					stat("MasteryExp", 30000),
					stat("mastery_0", 1),
					stat("mastery_3", 1),
				),
			);
			const farmer = player();
			expect(farmer.masteryLevelsSpent).toBe(2);
			expect(() => {
				farmer.masteryExp = 20000;
			}).toThrow("2 masteries are claimed, which takes at least 25000");
			expect(getStatValue(farmer[Raw], "MasteryExp")).toBe(30000);
			farmer.masteryExp = 25000;
			expect(getStatValue(farmer[Raw], "MasteryExp")).toBe(25000);
		});

		it("counts the levels spent stat too", async () => {
			saveManager = await importSave(
				withStats(xml, stat("MasteryLevelsSpent", 3)),
			);
			expect(player().masteryLevelsSpent).toBe(3);
		});

		it("refuses XP the stat can't hold", () => {
			const farmer = player();
			expect(() => {
				farmer.masteryExp = 1.5;
			}).toThrow("0 to 4294967295");
			expect(() => setStatValue(farmer[Raw], "MasteryExp", -1)).toThrow();
		});
	});
});
