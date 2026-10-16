import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import { getStatValue } from "$lib/proxies/Farmer.svelte";
import { Item } from "$lib/proxies/Item.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import { type Quest, questLabel } from "$lib/proxies/Quest.svelte";
import type { Player } from "$types/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
type Parsed = any;

// For tests that write out and read back the whole save
const slow = { timeout: 30_000 };

const questFields = ({
	title,
	id,
	daily = false,
	cancellable = true,
	money = 0,
	type,
	daysLeft = 0,
	next = "<nextQuests />",
}: {
	title: string;
	id?: number;
	daily?: boolean;
	cancellable?: boolean;
	money?: number;
	type: number;
	daysLeft?: number;
	next?: string;
}) => `
	<_currentObjective>${title} objective</_currentObjective>
	<_questDescription>${title} description</_questDescription>
	<_questTitle>${title}</_questTitle>
	<accepted>true</accepted>
	<completed>false</completed>
	<dailyQuest>${daily}</dailyQuest>
	<showNew>false</showNew>
	<canBeCancelled>${cancellable}</canBeCancelled>
	<destroy>false</destroy>
	${id === undefined ? "" : `<id>${id}</id>`}
	<moneyReward>${money}</moneyReward>
	<questType>${type}</questType>
	<daysLeft>${daysLeft}</daysLeft>
	<dayQuestAccepted>${daily ? 5 : -1}</dayQuestAccepted>
	${next}
	<questTitle>${title}</questTitle>`;

const rewardPart = (key: string, gold: number) =>
	`<DescriptionElement><xmlKey>Strings\\StringsFromCSFiles:${key}</xmlKey><param xsi:type="xsd:int">${gold}</param></DescriptionElement>`;

// Shaped like ItemDeliveryQuest.loadQuestInfo and Billboard's accept button make them
const DELIVERY = `<Quest xsi:type="ItemDeliveryQuest">${questFields({
	title: "Abigail's Request",
	daily: true,
	money: 960,
	type: 3,
	daysLeft: 1,
})}
	<targetMessage>Thanks!</targetMessage>
	<target>Abigail</target>
	<item>(O)66</item>
	<number>1</number>
	<parts>
		<DescriptionElement><xmlKey>Strings\\StringsFromCSFiles:ItemDeliveryQuest.cs.13385</xmlKey></DescriptionElement>
		${rewardPart("ItemDeliveryQuest.cs.13607", 960)}
	</parts>
	<dialogueparts />
	<objective><xmlKey>Strings\\StringsFromCSFiles:ItemDeliveryQuest.cs.13614</xmlKey></objective>
</Quest>`;

// SlayMonsterQuest: the reward is advertised, and paid when it's reported to Lewis
const SLAY = `<Quest xsi:type="SlayMonsterQuest">${questFields({
	title: "Wanted: Slimes",
	daily: true,
	type: 4,
	daysLeft: 2,
})}
	<targetMessage>Well done.</targetMessage>
	<monsterName>Green Slime</monsterName>
	<target>Lewis</target>
	<numberToKill>5</numberToKill>
	<reward>300</reward>
	<numberKilled>0</numberKilled>
	<parts>
		${rewardPart("SlayMonsterQuest.cs.13723", 5)}
		${rewardPart("FishingQuest.cs.13274", 300)}
	</parts>
	<dialogueparts />
	<objective><xmlKey>Strings\\StringsFromCSFiles:SlayMonsterQuest.cs.13770</xmlKey></objective>
</Quest>`;

// A story slay quest has no one to report to, so it pays its moneyReward
const STORY_SLAY = `<Quest xsi:type="SlayMonsterQuest">${questFields({
	title: "Initiation",
	id: 15,
	cancellable: false,
	money: 400,
	type: 4,
})}
	<monsterName>Green Slime</monsterName>
	<target>null</target>
	<numberToKill>10</numberToKill>
	<reward>180</reward>
	<numberKilled>3</numberKilled>
	<parts>${rewardPart("FishingQuest.cs.13274", 180)}</parts>
	<dialogueparts />
</Quest>`;

const LOST_ITEM = `<Quest xsi:type="LostItemQuest">${questFields({
	title: "Lost Item",
	id: 901,
	type: 9,
})}
	<npcName>Lewis</npcName>
	<locationOfItem>Town</locationOfItem>
	<itemIndex>(O)71</itemIndex>
	<tileX>10</tileX>
	<tileY>10</tileY>
	<itemFound>false</itemFound>
</Quest>`;

const SECRET = `<Quest xsi:type="SecretLostItemQuest">${questFields({
	title: "Secret Item",
	id: 900,
	type: 9,
})}
	<npcName>Lewis</npcName>
	<friendshipReward>250</friendshipReward>
	<exclusiveQuestId>901</exclusiveQuestId>
	<itemIndex>(O)71</itemIndex>
	<itemFound>true</itemFound>
</Quest>`;

// FishingQuest.loadQuestInfo for Willy: 13248 states the reward, how many to catch and the fish
const FISHING = `<Quest xsi:type="FishingQuest">${questFields({
	title: "Fishing",
	daily: true,
	type: 7,
	daysLeft: 2,
})}
	<target>Willy</target>
	<targetMessage>Nice catch!</targetMessage>
	<numberToFish>3</numberToFish>
	<reward>240</reward>
	<numberFished>3</numberFished>
	<whichFish>(O)131</whichFish>
	<parts>
		<DescriptionElement>
			<xmlKey>Strings\\StringsFromCSFiles:FishingQuest.cs.13248</xmlKey>
			<param xsi:type="xsd:int">240</param>
			<param xsi:type="xsd:int">3</param>
			<param xsi:type="Object"><name>Sardine</name><itemId>131</itemId><stack>1</stack></param>
		</DescriptionElement>
		${rewardPart("FishingQuest.cs.13274", 240)}
		<DescriptionElement><xmlKey>Strings\\StringsFromCSFiles:FishingQuest.cs.13275</xmlKey></DescriptionElement>
	</parts>
	<dialogueparts />
	<objective><xmlKey>Strings\\StringsFromCSFiles:FishingQuest.cs.13244</xmlKey></objective>
</Quest>`;

// Data/Quests 11, which starts Smelting (an ItemHarvest quest)
const FORGING = `<Quest xsi:type="CraftingQuest">${questFields({
	title: "Forging Ahead",
	id: 11,
	cancellable: false,
	type: 2,
	next: "<nextQuests><int>12</int></nextQuests>",
})}
	<isBigCraftable xsi:nil="true" />
	<indexToCraft>(BC)13</indexToCraft>
</Quest>`;

/** A basic quest that starts the given ones once it's complete */
const leadingTo = (id: number, ...next: string[]) =>
	`<Quest>${questFields({
		title: `Leads to ${next.join(" and ")}`,
		id,
		type: 1,
		next: `<nextQuests>${next.map((n) => `<int>${n}</int>`).join("")}</nextQuests>`,
	})}</Quest>`;

const insertQuests = (xml: string, ...quests: string[]) =>
	xml.replace("</questLog>", `${quests.join("")}</questLog>`);

/** Take a quest out of the test save's journal */
const dropQuest = (xml: string, title: string) =>
	xml.replace(
		new RegExp(
			`<Quest(?: [^>]*)?>(?:(?!</Quest>)[\\s\\S])*<_questTitle>${title}</_questTitle>[\\s\\S]*?</Quest>`,
		),
		"",
	);

/** The test save before Getting Started was finished, so Raising Animals and Advancement are still to come */
const beforeGettingStarted = (xml: string) =>
	dropQuest(dropQuest(xml, "Raising Animals"), "Advancement").replace(
		/(<_questTitle>Getting Started<\/_questTitle>[\s\S]*?<completed>)true/,
		"$1false",
	);

/** Give the test save a farmhand, with these quests in their journal */
const withFarmhand = (xml: string, quests = "") => {
	const start = xml.indexOf("<player>") + "<player>".length;
	const farmhand = xml
		.slice(start, xml.indexOf("</player>"))
		.replace("<name>Test</name>", "<name>Hand</name>")
		.replace(
			/<UniqueMultiplayerID>\d+<\/UniqueMultiplayerID>/,
			"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
		)
		.replace(
			/<questLog>[\s\S]*<\/questLog>/,
			quests ? `<questLog>${quests}</questLog>` : "<questLog />",
		);
	return xml.replace(
		"<farmhands />",
		`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
	);
};

const setBillboardQuestsDone = (xml: string, n: number) =>
	xml.replace(
		/(<string>BillboardQuestsDone<\/string>\s*<\/key>\s*<value>\s*<unsignedInt>)\d+/,
		`$1${n}`,
	);

describe("Quest log", () => {
	mockIDB();
	let fixture: string;
	let saveManager: SaveManager;
	let dispose: (() => void) | undefined;

	beforeAll(async () => {
		fixture = await readFile("tests/TestSave", "utf-8");
	});

	// The proxies write some edits (mail, item stacks) back through effects, so keep their root alive
	async function load(xml = fixture) {
		let promise!: Promise<void>;
		dispose = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([xml], "TestSave"));
		});
		await promise;
		flushSync();
		return log();
	}

	afterEach(() => {
		saveManager?.reset();
		dispose?.();
		dispose = undefined;
	});

	const farmer = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save.player;
	};
	const save = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save;
	};
	const log = () => farmer().questLog;
	const player = () => farmer()[Raw];
	const complete = (q: Quest) => log().complete(q, save());
	const byId = (id: string) => {
		const found = log().quests.find((q) => q.id === id);
		if (!found) throw new Error(`No quest #${id}`);
		return found;
	};
	const quest = (title: string) => {
		const found = log().quests.find((q) => q.title === title);
		if (!found) throw new Error(`No quest called ${title}`);
		return found;
	};
	const rawTitles = (p: Player = player()) =>
		typeof p.questLog === "object"
			? p.questLog.Quest.map((q) => q._questTitle)
			: [];
	const dialogueEvent = (key: string, p: Player = player()) =>
		typeof p.activeDialogueEvents === "object"
			? p.activeDialogueEvents.item.find((e) => e.key.string === key)?.value.int
			: undefined;
	const prizeTickets = () =>
		[...farmer().inventory.values()].filter(
			(item) => item?.[Raw].itemId === "PrizeTicket",
		);

	async function exported(): Promise<Parsed> {
		flushSync();
		const xml = await (await saveManager.export()).text();
		return new XMLManager().parse(xml);
	}

	it("lists the journal newest first, as the game does", async () => {
		const journal = (await load()).journal;
		expect(journal.map((q) => q.title)).toEqual([
			"Advancement",
			"Raising Animals",
			"Deeper In The Mine",
			"Getting Started",
			"Introductions",
		]);
		expect(journal.map((q) => q.id)).toEqual(["8", "7", "17", "6", "9"]);
		expect(journal.map((q) => q.type)).toEqual([
			"CraftingQuest",
			"Quest",
			"Quest",
			"ItemHarvestQuest",
			"SocializeQuest",
		]);
		const started = quest("Getting Started");
		expect(started.completed).toBe(true);
		expect(started.goldReward).toBe(100);
		expect(quest("Introductions").objective).toBe("14/28 people greeted");
		expect(quest("Introductions").rewardText).toBeUndefined();
		// No time limits on story quests
		for (const q of journal) expect(q.timed).toBe(false);
		expect(log().followUps(quest("Introductions"), save())).toEqual({
			start: [
				expect.objectContaining({ id: "25", title: "How To Win Friends" }),
			],
			cantStart: [],
		});
		// Quests 7 and 8 are already in the journal
		expect(log().followUps(started, save())).toEqual({
			start: [],
			cantStart: [],
		});
		expect(quest("Raising Animals").followUps).toEqual([]);
		expect(quest("Raising Animals").completionString).toBe("Coop");
	});

	it("removes a quest", slow, async () => {
		await load();
		log().remove(quest("Deeper In The Mine"));
		expect(log().journal).toHaveLength(4);
		const parsed = await exported();
		expect(
			parsed.SaveGame.player.questLog.Quest.map((q: Parsed) => q.id),
		).toEqual([9, 6, 7, 8]);
	});

	it("completes a story quest, leaving its gold to collect", async () => {
		await load();
		const advancement = quest("Advancement");
		const result = complete(advancement);
		flushSync();
		expect(result).toEqual({
			removed: false,
			started: [],
			skippedFollowUps: [],
		});
		expect(advancement.completed).toBe(true);
		expect(rawTitles()).toContain("Advancement");
		const raw = advancement[Raw];
		expect(raw.completed).toBe(true);
		expect(raw.moneyReward).toBe(100);
		// Villagers get to mention it
		expect(dialogueEvent("questComplete_8")).toBe(4);
		// Only Help Wanted and fishing quests count toward the stat
		expect(getStatValue(player(), "questsCompleted")).toBe(1);
		expect(getStatValue(player(), "BillboardQuestsDone")).toBe(1);
		// Completing it again does nothing
		expect(complete(advancement)).toEqual({
			removed: false,
			started: [],
			skippedFollowUps: [],
		});
	});

	it(
		"drops a completed quest without a reward, and starts its follow-up",
		slow,
		async () => {
			await load();
			const result = complete(quest("Introductions"));
			expect(result.removed).toBe(true);
			expect(result.skippedFollowUps).toEqual([]);
			expect(result.started.map((q) => q.title)).toEqual([
				"How To Win Friends",
			]);
			expect(rawTitles()).not.toContain("Introductions");
			expect(dialogueEvent("questComplete_9")).toBe(4);

			// Farmer.addQuest puts it at the end, so the journal shows it first
			const friends = quest("How To Win Friends");
			expect(log().journal[0]).toBe(friends);
			expect(friends.type).toBe("Quest");
			expect(friends.id).toBe("25");
			expect(friends.completed).toBe(false);
			expect(friends.goldReward).toBe(100);
			expect(friends.canBeCancelled).toBe(true);
			expect(friends.objective).toBe("Give someone a gift.");

			const deeper = quest("Deeper In The Mine");
			const gameMade = Object.keys(deeper[Raw]);
			expect(complete(deeper)).toEqual({
				removed: true,
				started: [quest("To The Bottom?")],
				skippedFollowUps: [],
			});

			// Saved as Quest.getQuestFromId makes them
			const out = (await exported()).SaveGame.player.questLog.Quest;
			expect(out.map((q: Parsed) => q.id)).toEqual([6, 7, 8, 25, 18]);
			const saved = out.find((q: Parsed) => q.id === 25);
			expect(saved).toEqual({
				_currentObjective: "Give someone a gift.",
				_questDescription:
					"Giving gifts is a great way to build friendships. Learn each person's individual tastes and you'll be popular in no time.",
				_questTitle: "How To Win Friends",
				rewardDescription: -1,
				accepted: false,
				completed: false,
				dailyQuest: false,
				showNew: true,
				canBeCancelled: true,
				destroy: false,
				id: 25,
				moneyReward: 100,
				questType: 1,
				daysLeft: 0,
				dayQuestAccepted: -1,
				nextQuests: { int: -1 },
				questTitle: "How To Win Friends",
			});
			// The same fields, in the same order, as a basic quest the game made
			expect(Object.keys(saved)).toEqual(gameMade);
			expect(Object.keys(out.find((q: Parsed) => q.id === 18))).toEqual(
				gameMade,
			);
		},
	);

	it("doesn't start a topic the player has already had", async () => {
		const xml = fixture.replace(
			"<string>firstVisit_Farm</string>",
			"<string>questComplete_8</string>",
		);
		await load(xml);
		complete(quest("Advancement"));
		expect(dialogueEvent("questComplete_8")).toBeUndefined();
	});

	it("counts Help Wanted quests, with a Prize Ticket every third", async () => {
		await load(insertQuests(setBillboardQuestsDone(fixture, 2), DELIVERY));
		const delivery = quest("Abigail's Request");
		expect(delivery.helpWanted).toBe(true);
		expect(delivery.timed).toBe(true);
		expect(delivery.id).toBeUndefined();
		expect(log().journal[0]).toBe(delivery);
		const topics = (
			typeof player().activeDialogueEvents === "object"
				? player().activeDialogueEvents
				: { item: [] }
		) as { item: unknown[] };
		const topicCount = topics.item.length;

		const result = complete(delivery);
		flushSync();
		expect(result).toEqual({
			removed: false,
			started: [],
			skippedFollowUps: [],
			prizeTicket: "added",
		});
		expect(getStatValue(player(), "BillboardQuestsDone")).toBe(3);
		expect(getStatValue(player(), "questsCompleted")).toBe(2);
		expect(delivery.goldReward).toBe(960);
		expect(rawTitles()).toContain("Abigail's Request");
		// No ID, so no topic for villagers
		expect(topics.item).toHaveLength(topicCount);
		const [ticket, ...others] = prizeTickets();
		expect(others).toEqual([]);
		expect(ticket?.[Raw].stack).toBe(1);
		expect(ticket?.name).toBe("Prize Ticket");
		expect(
			farmer().mailReceived.has(MailFlag.completedFirstBillboardQuest),
		).toBe(true);
		// That mail waits for the sixth
		expect(
			farmer().mailReceived.has(MailFlag.gotFirstBillboardPrizeTicket),
		).toBe(false);
	});

	it("stacks the sixth Prize Ticket onto one in the backpack", async () => {
		await load(insertQuests(setBillboardQuestsDone(fixture, 5), DELIVERY));
		const inventory = farmer().inventory;
		const empty = [...Array(inventory.slotCount).keys()].filter(
			(i) => !inventory.get(i),
		);
		const first = empty[0] as number;
		inventory.set(first, Item.fromName("Prize Ticket"));
		flushSync();

		const result = complete(quest("Abigail's Request"));
		flushSync();
		expect(result.prizeTicket).toBe("added");
		expect(prizeTickets()).toHaveLength(1);
		expect(inventory.get(first)?.[Raw].stack).toBe(2);
		expect(getStatValue(player(), "BillboardQuestsDone")).toBe(6);
		expect(
			farmer().mailReceived.has(MailFlag.gotFirstBillboardPrizeTicket),
		).toBe(true);
		flushSync();
		expect(player().mailReceived.string).toContain(
			"gotFirstBillboardPrizeTicket",
		);
	});

	it("says when there's no room for the Prize Ticket", async () => {
		await load(insertQuests(setBillboardQuestsDone(fixture, 2), DELIVERY));
		const inventory = farmer().inventory;
		const delivery = quest("Abigail's Request");
		expect(log().prizeTicketDue(delivery)).toBe("room");
		for (let i = 0; i < inventory.slotCount; i++)
			if (!inventory.get(i)) inventory.set(i, Item.fromName("Stone"));
		flushSync();
		// Known before it's completed, so the page can warn
		expect(log().prizeTicketDue(delivery)).toBe("noRoom");
		const result = complete(delivery);
		expect(result.prizeTicket).toBe("noRoom");
		expect(prizeTickets()).toEqual([]);
		// The rest of the completion still happens
		expect(getStatValue(player(), "BillboardQuestsDone")).toBe(3);
	});

	it("pays a slay quest's advertised reward when it's completed", async () => {
		await load(insertQuests(fixture, SLAY, STORY_SLAY));
		const slay = quest("Wanted: Slimes");
		expect(slay.goldReward).toBe(300);
		expect(slay[Raw].moneyReward).toBe(0);
		expect(complete(slay).removed).toBe(false);
		expect(slay[Raw].moneyReward).toBe(300);
		expect(slay.goldReward).toBe(300);

		// Without anyone to report to, it pays its moneyReward
		const story = quest("Initiation");
		expect(story.goldReward).toBe(400);
		complete(story);
		expect(story[Raw].moneyReward).toBe(400);
		expect(dialogueEvent("questComplete_15")).toBe(4);
	});

	it("edits days left and rewards", slow, async () => {
		await load(insertQuests(fixture, DELIVERY, SLAY, STORY_SLAY));
		const delivery = quest("Abigail's Request");
		delivery.daysLeft = 3;
		delivery.goldReward = 250;
		const slay = quest("Wanted: Slimes");
		slay.goldReward = 500;
		const story = quest("Initiation");
		story.goldReward = 450;
		// Cleared inputs are ignored; bad values are refused
		delivery.daysLeft = null as unknown as number;
		delivery.goldReward = Number.NaN;
		expect(() => {
			delivery.daysLeft = 0;
		}).toThrow("1 or more");
		expect(() => {
			delivery.goldReward = -5;
		}).toThrow("whole number");
		expect(delivery.daysLeft).toBe(3);
		expect(delivery.goldReward).toBe(250);

		const parsed = await exported();
		const quests = parsed.SaveGame.player.questLog.Quest;
		const find = (title: string) =>
			quests.find((q: Parsed) => q._questTitle === title);
		const out = find("Abigail's Request");
		expect(out.daysLeft).toBe(3);
		expect(out.moneyReward).toBe(250);
		// The game rebuilds the description from these
		expect(out.parts.DescriptionElement[1].param["#text"]).toBe(250);
		expect(out.parts.DescriptionElement[0].param).toBeUndefined();

		const outSlay = find("Wanted: Slimes");
		expect(outSlay.reward).toBe(500);
		expect(outSlay.moneyReward).toBe(0);
		expect(outSlay.parts.DescriptionElement[1].param["#text"]).toBe(500);
		// The number of monsters stays
		expect(outSlay.parts.DescriptionElement[0].param["#text"]).toBe(5);

		const outStory = find("Initiation");
		expect(outStory.moneyReward).toBe(450);
		// Its description comes from Data/Quests, so its parts are left alone
		expect(outStory.reward).toBe(180);
		expect(outStory.parts.DescriptionElement.param["#text"]).toBe(180);
	});

	it("handles an empty journal", slow, async () => {
		const quests = await load(
			fixture.replace(/<questLog>[\s\S]*<\/questLog>/, "<questLog />"),
		);
		expect(quests.journal).toEqual([]);
		const xml = await (await saveManager.export()).text();
		expect(xml).toContain("<questLog />");
	});

	it("completes a secret quest, ending the quest it replaces", async () => {
		await load(insertQuests(fixture, LOST_ITEM, SECRET));
		const secret = quest("Secret Item");
		expect(secret.secret).toBe(true);
		expect(secret.friendshipReward).toBe(250);
		expect(complete(secret)).toEqual({
			removed: true,
			started: [],
			skippedFollowUps: [],
		});
		expect(rawTitles()).not.toContain("Secret Item");
		expect(rawTitles()).not.toContain("Lost Item");
		expect(rawTitles()).toHaveLength(5);
		expect(getStatValue(player(), "questsCompleted")).toBe(1);
		expect(dialogueEvent("questComplete_900")).toBeUndefined();
	});

	it("gives Emily's Fiber quest its letter and topic", async () => {
		await load(fixture.replace("<id>8</id>", "<id>126</id>"));
		const fiber: Quest = quest("Advancement");
		expect(fiber.id).toBe("126");
		complete(fiber);
		flushSync();
		expect(player().mailReceived.string).toContain("emilyFiber");
		expect(dialogueEvent("emilyFiber")).toBe(2);
		expect(dialogueEvent("questComplete_126")).toBe(4);
	});

	it("keeps each farmer's journal separate", async () => {
		await load(withFarmhand(fixture));
		saveManager.save?.nextFarmer();
		expect(farmer().name).toBe("Hand");
		expect(log().journal).toEqual([]);
		saveManager.save?.prevFarmer();
		expect(log().journal).toHaveLength(5);
	});

	it(
		"starts the next story quests, finishing a building quest that's already built",
		slow,
		async () => {
			const original = new XMLManager().parse<Parsed>(fixture).SaveGame.player
				.questLog.Quest;
			await load(
				beforeGettingStarted(fixture).replace(
					"<constructedBuildings />",
					"<constructedBuildings><string>Coop</string></constructedBuildings>",
				),
			);
			expect(rawTitles()).toEqual([
				"Introductions",
				"Getting Started",
				"Deeper In The Mine",
			]);
			const result = complete(quest("Getting Started"));
			expect(result.removed).toBe(false);
			expect(result.started.map((q) => q.title)).toEqual([
				"Raising Animals",
				"Advancement",
			]);
			// A coop has been built, so Raising Animals is done already, with its reward to collect
			const coop = quest("Raising Animals");
			expect(coop.completed).toBe(true);
			expect(coop.goldReward).toBe(100);
			expect(dialogueEvent("questComplete_7")).toBe(4);
			expect(quest("Advancement").completed).toBe(false);
			expect(quest("Advancement").type).toBe("CraftingQuest");
			// Neither is a Help Wanted or fishing quest
			expect(getStatValue(player(), "questsCompleted")).toBe(1);

			// Just as the game saved them in the test save (whose text was wrapped onto several lines)
			const unwrap = (q: Parsed) => ({
				...q,
				_questDescription: q._questDescription.replace(/\s+/g, " "),
			});
			const out = (await exported()).SaveGame.player.questLog.Quest;
			const made = (id: number) => unwrap(out.find((q: Parsed) => q.id === id));
			const saved = (id: number) =>
				unwrap(original.find((q: Parsed) => q.id === id));
			expect(made(8)).toEqual(saved(8));
			expect(made(7)).toEqual({ ...saved(7), completed: true });
			expect(Object.keys(made(7))).toEqual(Object.keys(saved(7)));
			expect(Object.keys(made(8))).toEqual(Object.keys(saved(8)));
		},
	);

	it("doesn't start Raising Animals on the Meadowlands Farm", async () => {
		// A custom farm type is saved by its ID
		await load(
			beforeGettingStarted(fixture).replace(
				"<whichFarm>3</whichFarm>",
				"<whichFarm>MeadowlandsFarm</whichFarm>",
			),
		);
		const started = quest("Getting Started");
		expect(
			log()
				.followUps(started, save())
				.start.map((q) => q.id),
		).toEqual(["8"]);
		const result = complete(started);
		expect(result.started.map((q) => q.title)).toEqual(["Advancement"]);
		expect(result.skippedFollowUps).toEqual([]);
		expect(rawTitles()).not.toContain("Raising Animals");
	});

	it("starts location and harvest quests", slow, async () => {
		await load(
			insertQuests(
				fixture,
				FORGING,
				STORY_SLAY.replace(
					"<nextQuests />",
					"<nextQuests><int>16</int></nextQuests>",
				),
			),
		);
		expect(complete(byId("11")).started.map((q) => q.id)).toEqual(["12"]);
		const smelting = byId("12");
		expect(smelting.title).toBe("Smelting");
		expect(smelting.type).toBe("ItemHarvestQuest");
		expect(smelting.canBeCancelled).toBe(true);
		// Forging Ahead has no reward to collect
		expect(log().has("11")).toBe(false);

		expect(complete(byId("15")).started.map((q) => q.id)).toEqual(["16"]);
		const guild = byId("16");
		expect(guild.title).toBe("Initiation");
		expect(guild.type).toBe("GoSomewhereQuest");
		expect(guild.canBeCancelled).toBe(false);
		expect(guild.objective).toBe("Enter the Adventurer's Guild.");

		const out = (await exported()).SaveGame.player.questLog.Quest;
		const harvest = out.find((q: Parsed) => q.id === 12);
		expect(harvest["@_xsi:type"]).toBe("ItemHarvestQuest");
		expect(harvest.questType).toBe(9);
		expect(harvest.itemIndex).toBe("(O)334");
		expect(harvest.number).toBe(1);
		expect(harvest.moneyReward).toBe(0);
		expect(harvest.nextQuests).toEqual({ int: -1 });
		const location = out.find((q: Parsed) => q.id === 16);
		expect(location["@_xsi:type"]).toBe("GoSomewhereQuest");
		expect(location.questType).toBe(6);
		expect(location.whereToGo).toBe("AdventureGuild");
		expect(location.showNew).toBe(true);
	});

	it("only gives the host follow-ups marked for them", slow, async () => {
		// Getting Started starts h7 (the host only) and 8
		const xml = withFarmhand(
			insertQuests(dropQuest(fixture, "Getting Started"), leadingTo(990, "6")),
			leadingTo(990, "6"),
		);
		await load(xml);
		complete(byId("990"));
		expect(byId("6").followUps).toEqual(["7", "8"]);

		saveManager.save?.nextFarmer();
		expect(farmer().name).toBe("Hand");
		complete(byId("990"));
		expect(byId("6").followUps).toEqual(["8"]);

		const parsed = await exported();
		const nextOf = (quests: Parsed[]) =>
			quests.find((q: Parsed) => q.id === 6).nextQuests;
		expect(nextOf(parsed.SaveGame.player.questLog.Quest)).toEqual({
			int: [7, 8],
		});
		expect(nextOf(parsed.SaveGame.farmhands.Farmer[0].questLog.Quest)).toEqual({
			int: 8,
		});
	});

	it("reports follow-ups it can't start", async () => {
		// 9999 isn't in Data/Quests (a modded quest), and slay quests need the game's monster data
		await load(insertQuests(fixture, leadingTo(990, "9999", "15", "25")));
		const lead = byId("990");
		expect(log().followUps(lead, save())).toEqual({
			start: [expect.objectContaining({ id: "25" })],
			cantStart: ["9999", "15"],
		});
		expect(questLabel("9999")).toBe("Quest #9999");
		expect(questLabel("15")).toBe("Initiation");
		const result = complete(lead);
		expect(result.started.map((q) => q.id)).toEqual(["25"]);
		expect(result.skippedFollowUps).toEqual(["9999", "15"]);
	});

	it("edits and completes Willy's fishing quest", slow, async () => {
		await load(insertQuests(fixture, FISHING));
		const fishing = quest("Fishing");
		expect(fishing.helpWanted).toBe(true);
		expect(fishing.goldReward).toBe(240);
		fishing.goldReward = 300;
		expect(fishing[Raw].reward).toBe(300);
		expect(fishing[Raw].moneyReward).toBe(0);

		const parts = (await exported()).SaveGame.player.questLog.Quest.find(
			(q: Parsed) => q._questTitle === "Fishing",
		).parts.DescriptionElement;
		// 13248 states the reward first, then how many to catch, then the fish
		const [reward, number, fish] = parts[0].param;
		expect(reward["#text"]).toBe(300);
		expect(number["#text"]).toBe(3);
		expect(fish.name).toBe("Sardine");
		expect(parts[1].param["#text"]).toBe(300);
		expect(parts[2].param).toBeUndefined();

		// Handing it in to Willy pays the reward, and counts once toward each stat
		complete(fishing);
		expect(fishing[Raw].moneyReward).toBe(300);
		expect(fishing.goldReward).toBe(300);
		expect(getStatValue(player(), "BillboardQuestsDone")).toBe(2);
		expect(getStatValue(player(), "questsCompleted")).toBe(2);
		expect(rawTitles()).toContain("Fishing");
	});

	it("says beforehand when a Prize Ticket is due", async () => {
		await load(
			insertQuests(setBillboardQuestsDone(fixture, 1), DELIVERY, FISHING),
		);
		const delivery = quest("Abigail's Request");
		// It would be the second
		expect(log().prizeTicketDue(delivery)).toBeUndefined();
		complete(quest("Fishing"));
		expect(log().prizeTicketDue(delivery)).toBe("room");
		// Only Help Wanted quests count
		expect(log().prizeTicketDue(quest("Advancement"))).toBeUndefined();
		complete(delivery);
		expect(log().prizeTicketDue(delivery)).toBeUndefined();
	});
});
