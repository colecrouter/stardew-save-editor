import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import qiQuestTemplates from "../generated/qiquests.json";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

// A structurally realistic `<SpecialOrder>` block (shape borrowed from the
// fixture's own QiChallenge2 entry) for building an accepted order under
// `<specialOrders>`, which the fixture otherwise leaves self-closed/empty.
function specialOrderXml(questKey: string, requester: string): string {
	return `<SpecialOrder>
		<preSelectedItems />
		<selectedRandomElements />
		<objectives xsi:type="ShipObjective">
			<currentCount>0</currentCount>
			<maxCount>500</maxCount>
			<description>Ship 500 Qi Fruit</description>
			<failOnCompletion>false</failOnCompletion>
			<acceptableContextTagSets>item_qi_fruit</acceptableContextTagSets>
			<useShipmentValue>false</useShipmentValue>
		</objectives>
		<generationSeed>624245434</generationSeed>
		<seenParticipantsIDs />
		<participantsIDs />
		<unclaimedRewardsIDs />
		<appliedSpecialRules>false</appliedSpecialRules>
		<rewards xsi:type="GemsReward">
			<amount><int>100</int></amount>
		</rewards>
		<questKey>${questKey}</questKey>
		<questName>[${questKey}_Name]</questName>
		<questDescription>[${questKey}_Text]</questDescription>
		<requester>${requester}</requester>
		<orderType>${requester}</orderType>
		<specialRule />
		<readyForRemoval>false</readyForRemoval>
		<dueDate>28</dueDate>
		<duration>Month</duration>
		<questState>InProgress</questState>
	</SpecialOrder>`;
}

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

describe("QiQuests", () => {
	mockIDB();
	let saveManager: SaveManager;
	let fixture: string;

	beforeEach(async () => {
		fixture = (await readFile("tests/TestSave")).toString("utf-8");
		saveManager = await importSave(fixture);
	});

	it("imports an empty board and persists newly offered quests", async () => {
		const xml = fixture.replace(
			/<availableSpecialOrders>[\s\S]*?<\/availableSpecialOrders>/,
			"<availableSpecialOrders />",
		);
		expect(xml).not.toBe(fixture);
		saveManager = await importSave(xml);
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		expect([...save.qiQuests]).toEqual([]);
		save.qiQuests.add("QiChallenge8");
		flushSync();
		const exported = await (await saveManager.export()).text();
		const reimported = await importSave(exported);
		if (!reimported.save) throw new Error("Save reimport failed");
		expect([...reimported.save.qiQuests]).toEqual(["QiChallenge8"]);
	});

	it.each([
		[1, "spring", 6, 8],
		[3, "summer", 28, 282],
		[3, "winter", 28, 338],
	] as const)("uses the world date for deadlines in year %i, %s %i", async (year, season, day, expectedDeadline) => {
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		const game = save[Raw].SaveGame;
		game.year = year;
		game.currentSeason = season as typeof game.currentSeason;
		game.dayOfMonth = day;
		// Player statistics may be empty, stale, or edited independently.
		game.player.stats.daysPlayed = "9999";
		save.qiQuests.accept("QiChallenge8");
		flushSync();
		const exported = await (await saveManager.export()).text();
		const parsed = new XMLManager().parse<SaveFile>(exported);
		expect(
			parsed.SaveGame.specialOrders.SpecialOrder.find(
				(order) => order.questKey === "QiChallenge8",
			)?.dueDate,
		).toBe(expectedDeadline);
	});

	it("exports Four Precious Stones with a resolved collection objective", async () => {
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		save.qiQuests.accept("QiChallenge4");
		flushSync();
		const exported = await (await saveManager.export()).text();
		const parsed = new XMLManager().parse<SaveFile>(exported);
		const order = parsed.SaveGame.specialOrders.SpecialOrder.find(
			(entry) => entry.questKey === "QiChallenge4",
		);
		if (!order || !Array.isArray(order.objectives))
			throw new Error("Missing objectives");
		expect(order.objectives[0]).toMatchObject({
			maxCount: 4,
			acceptableContextTagSets: "item_prismatic_shard",
			description: "Collect 4 Prismatic Shards.",
		});
	});

	it("reflects the save's existing available Qi Challenges, leaving non-Qi orders alone", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// The fixture save has "Gus" and "Pam" special orders available, plus
		// two real Qi Challenges (QiChallenge2, QiChallenge6).
		expect([...save.qiQuests].sort()).toEqual(
			["QiChallenge2", "QiChallenge6"].sort(),
		);
		const rawKeys = save[Raw].SaveGame.availableSpecialOrders.SpecialOrder.map(
			(order) => order.questKey,
		);
		expect(rawKeys).toEqual(
			expect.arrayContaining(["Gus", "Pam", "QiChallenge6", "QiChallenge2"]),
		);
	});

	it("matches the real save format for an already-present Qi Challenge entry", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		const entry = save[Raw].SaveGame.availableSpecialOrders.SpecialOrder.find(
			(order) => order.questKey === "QiChallenge2",
		);
		expect(entry).toBeTruthy();
		if (!entry) return;

		// Ground truth captured from a real save file (tests/TestSave)
		expect(entry.questName).toBe("[QiChallenge2_Name]");
		expect(entry.questDescription).toBe("[QiChallenge2_Text]");
		expect(entry.requester).toBe("Qi");
		expect(entry.orderType).toBe("Qi");
		expect(entry.duration).toBe("Month");
		expect(entry.dueDate).toBe(28);
		expect(entry.questState).toBe("InProgress");
		expect(
			(entry.objectives as unknown as Record<string, unknown>[])[0],
		).toMatchObject({
			"@_xsi:type": "ShipObjective",
			maxCount: 500,
			acceptableContextTagSets: "item_qi_fruit",
			useShipmentValue: false,
		});
		expect(
			(entry.rewards as unknown as Record<string, unknown>[])[0],
		).toMatchObject({
			"@_xsi:type": "GemsReward",
			amount: { int: 100 },
		});
	});

	it("add() inserts a structurally valid entry without duplicating", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		const before =
			save[Raw].SaveGame.availableSpecialOrders.SpecialOrder.length;

		save.qiQuests.add("QiChallenge");
		flushSync();

		expect(save.qiQuests.has("QiChallenge")).toBe(true);
		const orders = save[Raw].SaveGame.availableSpecialOrders.SpecialOrder;
		expect(orders.length).toBe(before + 1);

		const entry = orders.find((order) => order.questKey === "QiChallenge");
		expect(entry).toBeTruthy();
		if (!entry) return;
		expect(entry.requester).toBe("Qi");
		expect(entry.orderType).toBe("Qi");
		expect(entry.questState).toBe("InProgress");
		// Save format keeps the raw, unresolved token (matches real save entries)
		expect(entry.questName).toBe("[QiChallenge_Name]");

		const template = qiQuestTemplates.find((t) => t.questKey === "QiChallenge");
		expect(template).toBeTruthy();
		expect(entry.duration).toBe(template?.duration);
		expect(entry.dueDate).toBeGreaterThan(0);

		// Adding again should not duplicate the entry
		save.qiQuests.add("QiChallenge");
		flushSync();
		expect(
			orders.filter((order) => order.questKey === "QiChallenge"),
		).toHaveLength(1);
	});

	it("delete() removes only the matching entry, preserving unrelated orders", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.add("QiChallenge3");
		flushSync();
		expect(save.qiQuests.has("QiChallenge3")).toBe(true);

		save.qiQuests.delete("QiChallenge3");
		flushSync();

		expect(save.qiQuests.has("QiChallenge3")).toBe(false);
		const rawKeys = save[Raw].SaveGame.availableSpecialOrders.SpecialOrder.map(
			(order) => order.questKey,
		);
		expect(rawKeys).not.toContain("QiChallenge3");
		// Pre-existing orders (Qi and non-Qi) must survive untouched
		expect(rawKeys).toEqual(
			expect.arrayContaining(["Gus", "Pam", "QiChallenge6", "QiChallenge2"]),
		);
	});

	it("inProgress is empty when specialOrders is unset (self-closed in XML)", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// The fixture save has never had a special order accepted, so
		// specialOrders parses as "" rather than an object.
		expect(save[Raw].SaveGame.specialOrders).toBe("");
		expect(save.qiQuests.inProgress).toEqual([]);
	});

	it("inProgress reports accepted Qi Challenges, ignoring non-Qi orders", async () => {
		const accepted = [
			specialOrderXml("QiChallenge", "Qi"),
			specialOrderXml("Gus", "Gus"),
		].join("\n");
		const xml = fixture.replace(
			"<specialOrders />",
			`<specialOrders>${accepted}</specialOrders>`,
		);
		saveManager = await importSave(xml);

		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		expect(save.qiQuests.inProgress).toEqual(["QiChallenge"]);
	});

	it("removeInProgress() cancels an accepted Qi Challenge, preserving other orders", async () => {
		const accepted = [
			specialOrderXml("QiChallenge", "Qi"),
			specialOrderXml("Gus", "Gus"),
		].join("\n");
		const xml = fixture.replace(
			"<specialOrders />",
			`<specialOrders>${accepted}</specialOrders>`,
		);
		saveManager = await importSave(xml);

		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;
		expect(save.qiQuests.inProgress).toEqual(["QiChallenge"]);

		save.qiQuests.removeInProgress("QiChallenge");
		flushSync();

		expect(save.qiQuests.inProgress).toEqual([]);
		const specialOrders = save[Raw].SaveGame.specialOrders;
		expect(typeof specialOrders).toBe("object");
		if (typeof specialOrders !== "object") return;
		expect(specialOrders.SpecialOrder.map((order) => order.questKey)).toEqual([
			"Gus",
		]);
	});

	it.each([
		["QiChallenge5", true],
		["QiChallenge10", true],
		["QiChallenge9", false],
	] as const)("preserves the mine location for offered and accepted %s", async (questKey, skullCave) => {
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		save.qiQuests.add(questKey);
		flushSync();
		const offered = new XMLManager().parse<SaveFile>(
			await (await saveManager.export()).text(),
		);
		const offeredOrder =
			offered.SaveGame.availableSpecialOrders.SpecialOrder.find(
				(order) => order.questKey === questKey,
			);
		if (!offeredOrder || !Array.isArray(offeredOrder.objectives))
			throw new Error("Missing objectives");
		expect(offeredOrder.objectives[0]).toMatchObject({
			"@_xsi:type": "ReachMineFloorObjective",
			skullCave,
		});
		save.qiQuests.accept(questKey);
		flushSync();
		const accepted = new XMLManager().parse<SaveFile>(
			await (await saveManager.export()).text(),
		);
		const acceptedOrder = accepted.SaveGame.specialOrders.SpecialOrder.find(
			(order) => order.questKey === questKey,
		);
		if (!acceptedOrder || !Array.isArray(acceptedOrder.objectives))
			throw new Error("Missing objectives");
		expect(acceptedOrder.objectives[0]).toMatchObject({
			"@_xsi:type": "ReachMineFloorObjective",
			skullCave,
		});
	});

	it.each([
		["MINE_HARD", true, 2, 1, 2, -1],
		["SC_HARD", true, 2, 2, 1, 65],
		[" MINE_HARD, SC_HARD, MINE_HARD ", true, 2, 1, 1, -1],
		["MINE_HARD", false, 2, 2, 2, 65],
		["SC_HARD", false, 2, 2, 2, 65],
		["MINE_HARD, SC_HARD", true, 0, 0, 0, -1],
	] as const)("cleans up %s only when applied=%s (difficulty %i)", async (rules, applied, difficulty, mines, skull, depth) => {
		const order = specialOrderXml("QiChallenge9", "Qi")
			.replace("<specialRule />", `<specialRule>${rules}</specialRule>`)
			.replace("<appliedSpecialRules>false", `<appliedSpecialRules>${applied}`);
		saveManager = await importSave(
			fixture.replace(
				"<specialOrders />",
				`<specialOrders>${order}</specialOrders>`,
			),
		);
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		const game = save[Raw].SaveGame;
		game.minesDifficulty = difficulty;
		game.skullCavesDifficulty = difficulty;
		game.mine_lowestLevelReachedForOrder = 65;
		game.mineShrineActivated = true;
		game.skullShrineActivated = true;
		save.qiQuests.removeInProgress("QiChallenge9");
		// A second cancellation must not undo shrine/other difficulty sources.
		save.qiQuests.removeInProgress("QiChallenge9");
		flushSync();
		const exported = new XMLManager().parse<SaveFile>(
			await (await saveManager.export()).text(),
		);
		expect(exported.SaveGame).toMatchObject({
			minesDifficulty: mines,
			skullCavesDifficulty: skull,
			mine_lowestLevelReachedForOrder: depth,
			mineShrineActivated: true,
			skullShrineActivated: true,
		});
		expect(save.qiQuests.inProgress).toEqual([]);
	});

	it.each([
		true,
		false,
	])("accounts for a remaining quest with applied=%s", async (remainingApplied) => {
		const mineOrder = (key: string, applied: boolean) =>
			specialOrderXml(key, "Qi")
				.replace(
					"<specialRule />",
					"<specialRule>MINE_HARD, SC_HARD</specialRule>",
				)
				.replace(
					"<appliedSpecialRules>false",
					`<appliedSpecialRules>${applied}`,
				);
		const orders =
			mineOrder("QiChallenge9", true) +
			mineOrder("ModdedMineQuest", remainingApplied);
		saveManager = await importSave(
			fixture.replace(
				"<specialOrders />",
				`<specialOrders>${orders}</specialOrders>`,
			),
		);
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		const game = save[Raw].SaveGame;
		game.minesDifficulty = 2;
		game.skullCavesDifficulty = 2;
		game.mine_lowestLevelReachedForOrder = 65;
		const retainedOrder = structuredClone(game.specialOrders.SpecialOrder[1]);
		save.qiQuests.removeInProgress("QiChallenge9");
		expect(game.minesDifficulty).toBe(remainingApplied ? 2 : 1);
		expect(game.skullCavesDifficulty).toBe(remainingApplied ? 2 : 1);
		expect(game.mine_lowestLevelReachedForOrder).toBe(
			remainingApplied ? 65 : -1,
		);
		expect(game.specialOrders.SpecialOrder).toEqual([retainedOrder]);
	});

	it("does not repeat cleanup for a completed order", async () => {
		const order = specialOrderXml("QiChallenge9", "Qi")
			.replace("<specialRule />", "<specialRule>MINE_HARD</specialRule>")
			.replace("<questState>InProgress", "<questState>Complete");
		saveManager = await importSave(
			fixture.replace(
				"<specialOrders />",
				`<specialOrders>${order}</specialOrders>`,
			),
		);
		const save = saveManager.save;
		if (!save) throw new Error("Save import failed");
		const before = JSON.stringify(save[Raw].SaveGame);
		save.qiQuests.removeInProgress("QiChallenge9");
		expect(JSON.stringify(save[Raw].SaveGame)).toBe(before);
	});

	it("accept() inserts a structurally valid entry directly into specialOrders when none exist yet", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// The fixture save has never had a special order accepted, so
		// specialOrders parses as "" rather than an object.
		expect(save[Raw].SaveGame.specialOrders).toBe("");

		save.qiQuests.accept("QiChallenge");
		flushSync();

		expect(save.qiQuests.inProgress).toEqual(["QiChallenge"]);
		const specialOrders = save[Raw].SaveGame.specialOrders;
		expect(typeof specialOrders).toBe("object");
		if (typeof specialOrders !== "object") return;

		const entry = specialOrders.SpecialOrder.find(
			(order) => order.questKey === "QiChallenge",
		);
		expect(entry).toBeTruthy();
		if (!entry) return;
		expect(entry.requester).toBe("Qi");
		expect(entry.orderType).toBe("Qi");
		expect(entry.questState).toBe("InProgress");
	});

	it("accept() appends to an existing specialOrders list without disturbing other orders", async () => {
		const accepted = specialOrderXml("Gus", "Gus");
		const xml = fixture.replace(
			"<specialOrders />",
			`<specialOrders>${accepted}</specialOrders>`,
		);
		saveManager = await importSave(xml);

		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.accept("QiChallenge3");
		flushSync();

		expect(save.qiQuests.inProgress).toEqual(["QiChallenge3"]);
		const specialOrders = save[Raw].SaveGame.specialOrders;
		expect(typeof specialOrders).toBe("object");
		if (typeof specialOrders !== "object") return;
		expect(specialOrders.SpecialOrder.map((order) => order.questKey)).toEqual(
			expect.arrayContaining(["Gus", "QiChallenge3"]),
		);
	});

	it("accept() drops the quest from the available board list if it was selected there", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// QiChallenge2 is already offered on the board in the fixture save.
		expect(save.qiQuests.has("QiChallenge2")).toBe(true);

		save.qiQuests.accept("QiChallenge2");
		flushSync();

		expect(save.qiQuests.has("QiChallenge2")).toBe(false);
		expect(save.qiQuests.inProgress).toEqual(["QiChallenge2"]);
		const rawKeys = save[Raw].SaveGame.availableSpecialOrders.SpecialOrder.map(
			(order) => order.questKey,
		);
		expect(rawKeys).not.toContain("QiChallenge2");
	});

	it("accept() evicts the earliest-selected (by template order) quest to make room when the board is already full", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		// The fixture's board is already at capacity with QiChallenge2 and
		// QiChallenge6, and QiChallenge2 comes first in the template list.
		expect([...save.qiQuests].sort()).toEqual(
			["QiChallenge2", "QiChallenge6"].sort(),
		);

		save.qiQuests.accept("QiChallenge3");
		flushSync();

		expect(save.qiQuests.inProgress).toEqual(["QiChallenge3"]);
		expect([...save.qiQuests]).toEqual(["QiChallenge6"]);
	});

	it("accept() does not evict anything when the board isn't full", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.delete("QiChallenge6");
		flushSync();
		expect([...save.qiQuests]).toEqual(["QiChallenge2"]);

		save.qiQuests.accept("QiChallenge3");
		flushSync();

		expect(save.qiQuests.inProgress).toEqual(["QiChallenge3"]);
		expect([...save.qiQuests]).toEqual(["QiChallenge2"]);
	});

	it("accept() does not duplicate an already-accepted Qi Challenge", () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.accept("QiChallenge");
		save.qiQuests.accept("QiChallenge");
		flushSync();

		const specialOrders = save[Raw].SaveGame.specialOrders;
		expect(typeof specialOrders).toBe("object");
		if (typeof specialOrders !== "object") return;
		expect(
			specialOrders.SpecialOrder.filter(
				(order) => order.questKey === "QiChallenge",
			),
		).toHaveLength(1);
	});

	it("round-trips a directly-accepted Qi Challenge through XML export/import", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.accept("QiChallenge8");
		flushSync();

		const blob = await saveManager.export();
		const xml = await blob.text();

		const reparsed = new XMLManager().parse<SaveFile>(xml);
		const specialOrders = reparsed.SaveGame.specialOrders;
		expect(typeof specialOrders).toBe("object");
		if (typeof specialOrders !== "object") return;

		const order = specialOrders.SpecialOrder.find(
			(o) => o.questKey === "QiChallenge8",
		);
		expect(order).toBeTruthy();
		if (!order) return;
		expect(order.requester).toBe("Qi");
		expect(order.questState).toBe("InProgress");
	});

	it("round-trips a newly added Qi Challenge through XML export/import", async () => {
		const save = saveManager.save;
		expect(save).toBeTruthy();
		if (!save) return;

		save.qiQuests.add("QiChallenge8");
		flushSync();

		const blob = await saveManager.export();
		const xml = await blob.text();

		const reparsed = new XMLManager().parse<SaveFile>(xml);
		const order = reparsed.SaveGame.availableSpecialOrders.SpecialOrder.find(
			(o) => o.questKey === "QiChallenge8",
		);
		expect(order).toBeTruthy();
		if (!order) return;
		expect(order.requester).toBe("Qi");
		expect(Array.isArray(order.objectives)).toBe(true);
		expect(order.objectives).toHaveLength(5);

		// Pre-existing real Qi Challenge entries must still round-trip correctly
		const existing = reparsed.SaveGame.availableSpecialOrders.SpecialOrder.find(
			(o) => o.questKey === "QiChallenge2",
		);
		expect(existing?.questName).toBe("[QiChallenge2_Name]");
	});
});
