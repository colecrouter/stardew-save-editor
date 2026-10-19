import questList from "$generated/quests.json";
import {
	type Farmer,
	getStatValue,
	setStatValue,
} from "$lib/proxies/Farmer.svelte";
import { Item } from "$lib/proxies/Item.svelte";
import type { ItemProxy } from "$lib/proxies/items";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import type { QuestData } from "$types/quests";
import type {
	DescriptionElement,
	QuestLog as QuestLogModel,
	Quest as QuestModel,
	QuestType,
} from "$types/save";
import { type DataProxy, Raw } from ".";
import type { SaveProxy } from "./SaveFile.svelte";

/*
    Mirrors StardewValley.Quests.Quest and its subclasses (1.6), and the
    journal (Menus.QuestLog). The save shapes were confirmed against
    tests/TestSave.
*/

/** Data/Quests, by ID */
const questData = new Map(
	(questList as QuestData[]).map((quest) => [quest.id, quest]),
);

/** A quest ID's title in Data/Quests, or the ID if it isn't there (a modded quest) */
export const questLabel = (id: string) =>
	questData.get(id)?.title ?? `Quest #${id}`;

/** The descriptions that state the gold reward, as their first value */
const REWARD_TEXT_KEYS = [
	// Delivery and resource quests
	":ItemDeliveryQuest.cs.13607",
	// Fishing and slay quests
	":FishingQuest.cs.13274",
	// Willy's fishing quests
	":FishingQuest.cs.13248",
];

const PRIZE_TICKET = "Prize Ticket";
const PRIZE_TICKET_ID = "PrizeTicket";
/** The most a backpack slot holds (Item.maximumStackSize) */
const MAX_STACK = 999;

/**
    How many are in a stack. Items track this as both `amount` (what the item
    editor edits) and `stack`, and both write the saved stack size, so change
    them together.
*/
const count = (item: ItemProxy) => item.amount ?? item.stack;
const setCount = (item: ItemProxy, n: number) => {
	item.stack = n;
	if (item.amount !== undefined) item.amount = n;
};

/** The save's whichFarm for the Meadowlands Farm (a custom farm type, saved by its ID) */
const MEADOWLANDS_FARM = "MeadowlandsFarm";

/** One parses as a value, several as an array */
const asArray = <T>(value: T | T[] | undefined): T[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Change the gold a Help Wanted quest's description states (the game rebuilds it from `parts` on load) */
function setRewardText(raw: QuestModel, gold: number) {
	if (typeof raw.parts !== "object") return;
	const parts: DescriptionElement[] = asArray(raw.parts.DescriptionElement);
	for (const part of parts) {
		if (!REWARD_TEXT_KEYS.some((key) => part.xmlKey?.endsWith(key))) continue;
		// Saved with its type: <param xsi:type="xsd:int">
		const [first] = asArray(part.param);
		if (typeof first === "object") first["#text"] = gold;
	}
}

/**
    ItemRegistry.QualifyItemId, for the IDs it leaves as they are: qualified
    ones, and categories like `-5`. Telling an object from a big craftable
    needs the item registry, so other IDs aren't supported.
*/
const qualified = (id: string | undefined) =>
	id?.startsWith("(") || id?.startsWith("-") ? id : undefined;

/**
    Make a quest from Data/Quests as Quest.getQuestFromId does, in the shape
    the game saves it. Story quests only start Basic, Building, Crafting,
    ItemHarvest and Location quests as follow-ups, so those are the types
    supported; the others need the game's villager and monster data.

    @param host Whether the host gets it: only they get follow-ups marked `h`
*/
function questFromData(data: QuestData, host: boolean): QuestModel | undefined {
	const [first, second] = data.conditions ?? [];
	let subclass: QuestType | undefined;
	let questType: number;
	let completionString: string | undefined;
	// The subclass's own fields, which the game saves after the base ones
	let fields: Pick<
		QuestModel,
		"indexToCraft" | "isBigCraftable" | "itemIndex" | "number" | "whereToGo"
	> = {};
	switch (data.type) {
		case "Basic":
			questType = 1;
			break;
		case "Building":
			if (!first) return;
			questType = 8;
			completionString = first;
			break;
		case "Crafting": {
			// The second condition says whether an unqualified ID is a big craftable; without it, the registry decides
			const bigCraftable = second?.toLowerCase();
			if (
				bigCraftable !== undefined &&
				!["true", "false"].includes(bigCraftable)
			)
				return;
			const itemId =
				first && bigCraftable !== undefined && !first.startsWith("(")
					? `${bigCraftable === "true" ? "(BC)" : "(O)"}${first}`
					: qualified(first);
			if (!itemId) return;
			subclass = "CraftingQuest";
			questType = 2;
			fields = {
				isBigCraftable: { "@_xsi:nil": "true" },
				indexToCraft: itemId,
			};
			break;
		}
		case "ItemHarvest": {
			const itemId = qualified(first);
			const number = second === undefined ? 1 : Number(second);
			if (!itemId || !Number.isInteger(number)) return;
			subclass = "ItemHarvestQuest";
			questType = 9;
			fields = { itemIndex: itemId, number };
			break;
		}
		case "Location":
			if (!first) return;
			subclass = "GoSomewhereQuest";
			questType = 6;
			fields = { whereToGo: first };
			break;
		default:
			return;
	}
	const nextQuests = data.nextQuests.flatMap((id) =>
		id.startsWith("h") ? (host ? [id.slice(1)] : []) : [id],
	);
	return {
		...(subclass ? { "@_xsi:type": subclass } : {}),
		_currentObjective: data.objective ?? "",
		_questDescription: data.description,
		_questTitle: data.title,
		...(data.rewardDescription === undefined
			? {}
			: { rewardDescription: data.rewardDescription }),
		...(completionString ? { completionString } : {}),
		accepted: false,
		completed: false,
		dailyQuest: false,
		showNew: true,
		canBeCancelled: data.canBeCancelled,
		destroy: false,
		id: data.id,
		moneyReward: data.moneyReward,
		questType,
		daysLeft: 0,
		dayQuestAccepted: -1,
		nextQuests: nextQuests.length > 0 ? { int: nextQuests } : "",
		questTitle: data.title,
		...fields,
	};
}

/** A quest in the player's journal */
export class Quest implements DataProxy<QuestModel> {
	public [Raw]: QuestModel;

	/** The subclass, such as `ItemDeliveryQuest` */
	public readonly type: QuestType | "Quest";
	/** The Data/Quests key; Help Wanted quests have none */
	public readonly id: string | undefined;
	/** Taken from the billboard */
	public readonly helpWanted: boolean;
	/** A SecretLostItemQuest, which the in-game journal doesn't show */
	public readonly secret: boolean;

	#completed = $state(false);
	#daysLeft = $state(0);
	#moneyReward = $state(0);
	#reward = $state<number>();
	/**
	    Help Wanted slay, fishing and resource quests advertise `reward`, and
	    copy it to `moneyReward` when they're handed in (`checkIfComplete`).
	    A slay quest without anyone to report to completes as soon as the
	    monsters are dead, paying `moneyReward` instead.
	*/
	readonly #paysReward: boolean;

	constructor(raw: QuestModel) {
		this[Raw] = raw;
		this.type = raw["@_xsi:type"] ?? "Quest";
		this.id = raw.id === undefined ? undefined : String(raw.id);
		this.helpWanted = raw.dailyQuest === true;
		this.secret = this.type === "SecretLostItemQuest";

		this.#completed = raw.completed === true;
		this.#daysLeft = Number(raw.daysLeft ?? 0);
		this.#moneyReward = Number(raw.moneyReward ?? 0);
		this.#reward = raw.reward === undefined ? undefined : Number(raw.reward);
		const reportsTo = raw.target !== undefined && raw.target !== "null";
		this.#paysReward =
			this.#reward !== undefined &&
			(this.type === "FishingQuest" ||
				this.type === "ResourceCollectionQuest" ||
				(this.type === "SlayMonsterQuest" && reportsTo));
	}

	/** The cached title: the game reloads it from Data/Quests */
	get title() {
		return String(this[Raw]._questTitle || this[Raw].questTitle || "Untitled");
	}

	/** The cached description; the game reloads it from Data/Quests, or `parts` */
	get description() {
		return String(this[Raw]._questDescription ?? "");
	}

	/** The cached objective, like "14/28 people greeted" */
	get objective() {
		return String(this[Raw]._currentObjective ?? "");
	}

	/** A reward other than gold, if it has one (Quest.hasReward) */
	get rewardText() {
		const text = this[Raw].rewardDescription;
		return text !== undefined && String(text).length > 2
			? String(text)
			: undefined;
	}

	/** Friendship points a secret quest gives the NPC who wanted the item back */
	get friendshipReward() {
		return this[Raw].friendshipReward;
	}

	/** The building type that finishes a building quest, like "Coop" */
	get completionString() {
		const value = this[Raw].completionString;
		return value === undefined ? undefined : String(value);
	}

	get completed() {
		return this.#completed;
	}

	get canBeCancelled() {
		return this[Raw].canBeCancelled === true;
	}

	/** About to be dropped from the journal */
	get destroyed() {
		return this[Raw].destroy === true;
	}

	/** Has a time limit (Quest.IsTimedQuest) */
	get timed() {
		return this.helpWanted || this.#daysLeft > 0;
	}

	/** Counts down each night; when it runs out, an unfinished quest is gone */
	get daysLeft() {
		return this.#daysLeft;
	}

	set daysLeft(value: number) {
		// A cleared input: wait for a number
		if (!Number.isFinite(value)) return;
		if (!Number.isInteger(value) || value < 1)
			throw new Error("Days left must be a whole number, 1 or more");
		this.#daysLeft = value;
		this[Raw].daysLeft = value;
	}

	/** Has something to collect from the journal once it's complete (Quest.hasReward) */
	get hasReward() {
		return this.#moneyReward > 0 || this.rewardText !== undefined;
	}

	/** The gold it pays: what it advertises until it's handed in, then what waits in the journal */
	get goldReward() {
		const gold =
			this.#paysReward && !this.#completed
				? (this.#reward ?? 0)
				: this.#moneyReward;
		// Quests without gold have -1
		return Math.max(0, gold);
	}

	set goldReward(value: number) {
		if (!Number.isFinite(value)) return;
		if (!Number.isInteger(value) || value < 0)
			throw new Error("The reward must be a whole number of gold");
		if (this.#paysReward && !this.#completed) {
			this.#reward = value;
			this[Raw].reward = value;
		} else {
			this.#moneyReward = value;
			this[Raw].moneyReward = value;
		}
		if (this.helpWanted) setRewardText(this[Raw], value);
	}

	/** Quest IDs to start once it's complete */
	get followUps() {
		const next = this[Raw].nextQuests;
		if (typeof next !== "object") return [];
		// Quest.IsValidId (QuestLog.followUps also skips quest 7 on the Meadowlands Farm)
		return asArray(next.int)
			.map(String)
			.filter((id) => !["", "-1", "0"].includes(id));
	}

	/** Mark it complete, paying out an advertised reward as handing it in does */
	markComplete() {
		if (this.#paysReward) {
			this.#moneyReward = this.#reward ?? 0;
			this[Raw].moneyReward = this.#moneyReward;
		}
		this.#completed = true;
		this[Raw].completed = true;
	}
}

/** What completing a quest does with its follow-ups */
export interface FollowUps {
	/** Started in the journal (Farmer.addQuest) */
	start: QuestData[];
	/** Not in the editor's copy of Data/Quests (a modded quest), or a type it can't make */
	cantStart: string[];
}

export interface QuestCompletion {
	/** Taken out of the journal, having no reward to collect */
	removed: boolean;
	/** Follow-up quests added to the journal */
	started: Quest[];
	/** Follow-up quests the game would have started, but the editor can't */
	skippedFollowUps: string[];
	/** Every third Help Wanted quest gives a Prize Ticket */
	prizeTicket?: "added" | "noRoom";
}

/** A farmer's journal (Farmer.questLog) */
export class QuestLog implements DataProxy<QuestLogModel> {
	public [Raw]: QuestLogModel;
	#farmer: Farmer;
	/** Counts completions, so what reads the stats they change updates (the stats aren't reactive) */
	#completions = $state(0);

	/** In the order they were added */
	public quests: Quest[];

	constructor(farmer: Farmer) {
		const player = farmer[Raw];
		// An empty journal parses as ""
		if (typeof player.questLog !== "object" || !player.questLog)
			player.questLog = { Quest: [] };
		player.questLog.Quest ??= [];
		this[Raw] = player.questLog;
		this.#farmer = farmer;
		this.quests = $state(this[Raw].Quest.map((quest) => new Quest(quest)));
	}

	/** As the journal lists them: newest first, leaving out ones it's dropping */
	get journal() {
		return [...this.quests].reverse().filter((quest) => !quest.destroyed);
	}

	has(id: string) {
		return this.quests.some((quest) => quest.id === id);
	}

	/** The follow-ups completing a quest would start, as Quest.questComplete and Farmer.addQuest do */
	followUps(quest: Quest, save: SaveProxy): FollowUps {
		const result: FollowUps = { start: [], cantStart: [] };
		const farmType = String(save[Raw].SaveGame.whichFarm);
		for (const id of quest.followUps) {
			// Quest.IsValidId: the Meadowlands Farm starts with a coop, so it skips building one
			if (id === "7" && farmType === MEADOWLANDS_FARM) continue;
			// Farmer.addQuest skips ones already in the journal
			if (this.has(id) || result.start.some((q) => q.id === id)) continue;
			const data = questData.get(id);
			if (data && questFromData(data, true)) result.start.push(data);
			else result.cantStart.push(id);
		}
		return result;
	}

	/** Add a quest at the end, as Farmer.addQuest does, so the journal lists it first */
	add(raw: QuestModel) {
		const quest = new Quest(raw);
		this[Raw].Quest.push(raw);
		this.quests.push(quest);
		return quest;
	}

	remove(quest: Quest) {
		const index = this.quests.indexOf(quest);
		if (index === -1) return;
		this.quests.splice(index, 1);
		const rawIndex = this[Raw].Quest.indexOf(quest[Raw]);
		if (rawIndex !== -1) this[Raw].Quest.splice(rawIndex, 1);
	}

	/**
	    Whether completing a quest earns a Prize Ticket (every third Help
	    Wanted quest), and if so, whether the backpack has room for it. The
	    game drops it at the player's feet when there isn't; the editor can't.
	*/
	prizeTicketDue(quest: Quest): "room" | "noRoom" | undefined {
		if (!quest.helpWanted || quest.completed || quest.secret) return;
		// Read so this updates after a completion
		void this.#completions;
		const done = getStatValue(this.#farmer[Raw], "BillboardQuestsDone") + 1;
		if (done % 3 !== 0) return;
		return this.#prizeTicketSlot() === undefined ? "noRoom" : "room";
	}

	/**
	    Complete a quest as Quest.questComplete does, starting its follow-ups.
	    The friendship and the items it asked for are part of handing it in,
	    so they're left out.
	*/
	complete(quest: Quest, save: SaveProxy): QuestCompletion {
		const result: QuestCompletion = {
			removed: false,
			started: [],
			skippedFollowUps: [],
		};
		if (quest.completed) return result;
		const farmer = this.#farmer;
		const player = farmer[Raw];
		this.#completions++;

		// SecretLostItemQuest.questComplete: no stats, and it ends the quest it replaces
		if (quest.secret) {
			quest.markComplete();
			this.remove(quest);
			const replaced = quest[Raw].exclusiveQuestId;
			if (replaced !== undefined)
				for (const other of this.quests.filter(
					(q) => q.id === String(replaced),
				))
					this.remove(other);
			return { ...result, removed: true };
		}

		if (quest.helpWanted) {
			const done = getStatValue(player, "BillboardQuestsDone") + 1;
			setStatValue(player, "BillboardQuestsDone", done);
			farmer.mailReceived.add(MailFlag.completedFirstBillboardQuest);
			if (done % 3 === 0) {
				result.prizeTicket = this.#givePrizeTicket() ? "added" : "noRoom";
				if (done >= 6)
					farmer.mailReceived.add(MailFlag.gotFirstBillboardPrizeTicket);
			}
		}
		// Fishing quests count too
		if (quest.helpWanted || Number(quest[Raw].questType) === 7)
			setStatValue(
				player,
				"questsCompleted",
				getStatValue(player, "questsCompleted") + 1,
			);
		quest.markComplete();

		// Farmer.addQuest, for each follow-up
		const { start, cantStart } = this.followUps(quest, save);
		result.skippedFollowUps.push(...cantStart);
		const host = save[Raw].SaveGame.player === player;
		for (const data of start) {
			const raw = questFromData(data, host);
			if (!raw) continue;
			const next = this.add(raw);
			result.started.push(next);
			// A building quest is done already if that building has been built
			const building = next.completionString;
			if (building && save.constructedBuildings.includes(building)) {
				const done = this.complete(next, save);
				result.started.push(...done.started);
				result.skippedFollowUps.push(...done.skippedFollowUps);
			}
		}

		// It stays until its reward is collected in-game
		if (!quest.hasReward) {
			this.remove(quest);
			result.removed = true;
		}
		// Emily's "Fiber" quest; it only runs once, so the topic is new
		if (quest.id === "126") {
			farmer.mailReceived.add(MailFlag.emilyFiber);
			farmer.autoGenerateActiveDialogueEvent("emilyFiber", 2);
		}
		// Help Wanted quests have no ID to name a topic after
		if (quest.id !== undefined)
			farmer.autoGenerateActiveDialogueEvent(`questComplete_${quest.id}`);
		return result;
	}

	/** Farmer.addItemToInventory: onto a stack first, then into an empty slot */
	#prizeTicketSlot() {
		const { inventory } = this.#farmer;
		for (let index = 0; index < inventory.slotCount; index++) {
			const item = inventory.get(index);
			if (
				item &&
				String(item[Raw].itemId) === PRIZE_TICKET_ID &&
				count(item) < MAX_STACK
			)
				return index;
		}
		for (let index = 0; index < inventory.slotCount; index++)
			if (inventory.isEmpty(index)) return index;
	}

	#givePrizeTicket() {
		const index = this.#prizeTicketSlot();
		if (index === undefined) return false;
		const { inventory } = this.#farmer;
		const item = inventory.get(index);
		if (item) setCount(item, count(item) + 1);
		else inventory.set(index, Item.fromName(PRIZE_TICKET));
		return true;
	}
}
