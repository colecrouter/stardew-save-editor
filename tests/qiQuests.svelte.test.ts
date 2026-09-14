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
