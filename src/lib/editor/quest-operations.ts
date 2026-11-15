import { Data, Effect, Result, Schema } from "effect";

import { type T_StardewValley_Quests_Quest as Quest } from "../../../generated/save-format/save.ts";
import { type Farmer, farmers, type SaveDocument } from "./domain.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import { nonemptyText } from "./plain-data.ts";
import { questDefinitions, questFromData, questLabel } from "./quest-data.ts";
import { prizeTicketDestination } from "./quest-ticket.ts";
import { stringifySavedData } from "./saved-data.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { TransactionDraft } from "./transaction-draft.ts";

/** A rejected journal action leaves its entire quest/reward transaction unpublished. */
export class QuestInvalid extends Data.TaggedError("QuestInvalid")<{
	readonly message: string;
}> {}
const target = { farmerId: Schema.String, questKey: Schema.String };
const schema = Schema.Union([
	Schema.Struct({
		...target,
		kind: Schema.Literals(["reward", "days"]),
		value: Schema.Number.check(
			Schema.isInt(),
			Schema.isBetween({ minimum: 0, maximum: 99999 }),
		),
	}),
	Schema.Struct({ ...target, kind: Schema.Literal("complete") }),
	Schema.Struct({ ...target, kind: Schema.Literal("remove") }),
]);
export type QuestChange = typeof schema.Type;
const decode = Schema.decodeUnknownResult(schema, {
	onExcessProperty: "error",
});
// Unknown subclasses remain visible, but only generated vanilla variants can
// enter the mutation path; their discriminant establishes writable saved fields.
type KnownQuest = Exclude<Quest, { readonly $type: "$unknown" }>;
function journal(owner: Farmer) {
	const raw = owner.questLog;
	// An omitted journal stays unavailable; decoding already establishes list shapes.
	return {
		raw,
		entries: raw ?? [],
		supported: raw !== undefined,
	};
}
function writeJournal(owner: Farmer, entries: (Quest | null)[]) {
	owner.questLog = entries;
}
function keyOf(raw: Quest) {
	const id = raw.$type === "$unknown" ? undefined : raw.id;
	if (id !== undefined) return `id:${id}`;
	// Help Wanted quests have no story ID. Capture their immutable generated identity,
	// excluding fields edited by this screen so a valid input never retargets itself.
	const {
		moneyReward: _moneyReward,
		reward: _reward,
		daysLeft: _daysLeft,
		completed: _completed,
		destroy: _destroy,
		showNew: _showNew,
		parts: _parts,
		...identity
	} = raw;
	// Generated quest fields can contain exact Int64 values (including nested
	// objective data). Use the saved-data representation so projection cannot
	// prevent an otherwise valid save from opening or round those values.
	return `generated:${stringifySavedData(identity)}`;
}
type RewardQuest = Extract<
	KnownQuest,
	{
		readonly $type:
			| "StardewValley.Quests.FishingQuest"
			| "StardewValley.Quests.ResourceCollectionQuest"
			| "StardewValley.Quests.SlayMonsterQuest";
	}
>;
function paysReward(raw: KnownQuest): raw is RewardQuest & { reward: number } {
	// Only these classes serialize a pending reward separately from moneyReward.
	// A similarly named extension on another class is never an editable mirror.
	return (
		(raw.$type === "StardewValley.Quests.FishingQuest" ||
			raw.$type === "StardewValley.Quests.ResourceCollectionQuest" ||
			(raw.$type === "StardewValley.Quests.SlayMonsterQuest" &&
				raw.target !== undefined &&
				raw.target !== "null")) &&
		raw.reward !== undefined
	);
}
function reward(quest: KnownQuest) {
	const value =
		paysReward(quest) && quest.completed !== true
			? quest.reward
			: quest.moneyReward;
	return Math.max(0, value ?? 0);
}
function followIds(quest: KnownQuest): string[] | undefined {
	// Nil entries cannot identify a follow-up. Keep that gameplay precondition
	// while trusting decoded arrays and preserving the exact spelling/order of IDs.
	const ids: string[] = [];
	for (const id of quest.nextQuests ?? []) {
		if (id === null) return undefined;
		if (id !== "" && id !== "0" && id !== "-1") ids.push(id);
	}
	return ids;
}
function rewardText(quest: KnownQuest) {
	return quest.rewardDescription !== undefined &&
		quest.rewardDescription.length > 2
		? quest.rewardDescription
		: undefined;
}
export interface QuestView {
	key: string;
	renderKey: string;
	title: string;
	description: string;
	objective: string;
	supported: boolean;
	reason?: string | undefined;
	completed: boolean;
	secret: boolean;
	helpWanted: boolean;
	canBeCancelled: boolean;
	reward?: number | undefined;
	rewardSupported: boolean;
	rewardText?: string | undefined;
	friendshipReward?: number | undefined;
	timed: boolean;
	daysLeft?: number | undefined;
	daysSupported: boolean;
	followUps: string[];
	skippedFollowUps: string[];
	ticketDue: boolean;
	ticketRoom?: boolean | undefined;
}
export interface QuestFarmerView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string | undefined;
	quests: QuestView[];
	unsupportedCount: number;
}
function project(
	document: SaveDocument,
	owner: Farmer,
	unique: boolean,
): QuestFarmerView {
	const data = journal(owner);
	const supported = unique && data.supported;
	const all = data.entries.filter((entry) => entry !== null);
	const keys = all.map(keyOf);
	const knownIds = new Set(
		all.flatMap((raw) =>
			raw.$type === "$unknown" || raw.id === undefined ? [] : [raw.id],
		),
	);
	const game = document.SaveGame;
	const occurrences = new Map<string, number>();
	return {
		farmerId: owner.UniqueMultiplayerID?.toString() ?? "",
		name: owner.name ?? "Unnamed farmer",
		supported,
		reason: !unique
			? "Choose a farmer with an unambiguous saved identifier."
			: !data.supported
				? "This farmer's journal is unsupported."
				: undefined,
		unsupportedCount: data.entries.length - all.length,
		quests: all
			.filter((raw) => raw.destroy !== true)
			.toReversed()
			.map((quest) => {
				const key = keyOf(quest);
				// Duplicate imported identities still need distinct render keys, but they
				// never acquire separate command authority: both remain read-only.
				const occurrence = occurrences.get(key) ?? 0;
				occurrences.set(key, occurrence + 1);
				if (quest.$type === "$unknown")
					return {
						key,
						renderKey: `${key}:${occurrence}`,
						title:
							typeof quest["questTitle"] === "string"
								? quest["questTitle"]
								: "Unknown quest",
						description: "",
						objective: "",
						supported: false,
						reason: "This quest uses an unsupported saved class.",
						completed: false,
						secret: false,
						helpWanted: false,
						canBeCancelled: false,
						rewardSupported: false,
						timed: false,
						daysSupported: false,
						followUps: [],
						skippedFollowUps: [],
						ticketDue: false,
					};
				const valid =
					supported &&
					keys.filter((candidate) => candidate === key).length === 1;
				const secret =
					quest.$type === "StardewValley.Quests.SecretLostItemQuest";
				const helpWanted = quest.dailyQuest === true;
				const completed = quest.completed === true;
				const ids = followIds(quest);
				const starts: string[] = [];
				const skipped: string[] = [];
				for (const id of ids ?? []) {
					if (
						knownIds.has(id) ||
						(id === "7" && String(game.whichFarm) === "MeadowlandsFarm")
					)
						continue;
					const definition = questDefinitions.get(id);
					if (definition && questFromData(definition, true))
						starts.push(definition.title);
					else skipped.push(questLabel(id));
				}
				// Projection must stay synchronous and read-only. A checked Result
				// describes unsupported stats without executing a mutation Effect.
				const billboard =
					helpWanted && !completed && !secret
						? readStatResult(owner, "BillboardQuestsDone")
						: undefined;
				const ticketDue =
					billboard !== undefined &&
					Result.isSuccess(billboard) &&
					(billboard.success + 1) % 3 === 0;
				const gold = reward(quest);
				const days = quest.daysLeft ?? 0;
				return {
					key,
					renderKey: `${key}:${occurrence}`,
					title:
						quest._questTitle != null && quest._questTitle !== ""
							? quest._questTitle
							: (quest.questTitle ?? "Untitled quest"),
					description: quest._questDescription ?? "",
					objective: quest._currentObjective ?? "",
					supported: valid,
					reason: valid
						? undefined
						: "This quest has an ambiguous or unsupported saved identity.",
					completed,
					secret,
					helpWanted,
					canBeCancelled: quest.canBeCancelled === true,
					reward: gold,
					rewardSupported: valid && !secret,
					rewardText: rewardText(quest),
					friendshipReward:
						quest.$type === "StardewValley.Quests.SecretLostItemQuest"
							? quest.friendshipReward
							: undefined,
					timed: helpWanted || days > 0,
					daysLeft: days,
					daysSupported: valid && !completed,
					followUps: starts,
					skippedFollowUps: skipped,
					ticketDue,
					ticketRoom:
						ticketDue && owner.items !== undefined
							? prizeTicketDestination(owner.items) !== undefined
							: undefined,
				};
			}),
	};
}
/** Read detached journal views without constructors, normalization or saved writes. */
export function readQuestJournals(document: SaveDocument): QuestFarmerView[] {
	const all = farmers(document);
	return all.map((owner) => {
		const id = owner.UniqueMultiplayerID?.toString();
		return project(
			document,
			owner,
			id !== undefined &&
				all.filter(
					(candidate) => candidate.UniqueMultiplayerID?.toString() === id,
				).length === 1,
		);
	});
}
// Shared checked reading keeps projection and command rejection in agreement.
// Unsupported imported values remain untouched; mutation helpers lift this Result
// into the typed Effect error channel instead of throwing during preparation.
function statDataResult(owner: Farmer) {
	if (owner.stats === undefined)
		return Result.fail(
			new QuestInvalid({
				message: "This farmer's completion stats are unsupported.",
			}),
		);
	return Result.succeed({
		root: owner.stats,
		entries: owner.stats.Values ?? [],
	});
}
// Stat keys are case-insensitive in-game. Preserve existing spelling and
// opaque members, rejecting duplicate relevant keys rather than choosing one.
function readStatResult(
	owner: Farmer,
	name: string,
): Result.Result<number, QuestInvalid> {
	const checked = statDataResult(owner);
	if (Result.isFailure(checked)) return Result.fail(checked.failure);
	const matches = checked.success.entries.filter(
		(entry) => entry.key.toLowerCase() === name.toLowerCase(),
	);
	if (matches.length > 1)
		return Result.fail(
			new QuestInvalid({ message: `The saved ${name} stat is ambiguous.` }),
		);
	const first = matches[0];
	if (first === undefined) return Result.succeed(0);
	const value = first.value;
	if (value >= 4294967295)
		return Result.fail(
			new QuestInvalid({
				message: `The saved ${name} stat cannot be incremented safely.`,
			}),
		);
	return Result.succeed(value);
}
const stats = Effect.fn("Quest.completionStats")((owner: Farmer) =>
	Effect.fromResult(statDataResult(owner)),
);
const readStat = Effect.fn("Quest.readCompletionStat")(
	(owner: Farmer, name: string) =>
		Effect.fromResult(readStatResult(owner, name)),
);
const incrementStat = Effect.fn("Quest.incrementStat")(function* (
	owner: Farmer,
	name: string,
) {
	const value = (yield* readStat(owner, name)) + 1;
	const data = yield* stats(owner);
	const existing = data.entries.find(
		(entry) => entry.key.toLowerCase() === name.toLowerCase(),
	);
	if (existing !== undefined) existing.value = value;
	else data.root.Values = [...data.entries, { key: name, value }];
	return value;
});
// Completion adds only its own flags, leaving unrelated mail and metadata intact.
const mail = Effect.fn("Quest.mail")(function* (owner: Farmer, flag: string) {
	const message = owner.mailReceived;
	if (message === undefined)
		return yield* new QuestInvalid({
			message: "This farmer's mail flags are unsupported.",
		});
	const values = message;
	if (values.some((value) => value === null))
		return yield* new QuestInvalid({
			message: "This farmer's mail flags are unsupported.",
		});
	if (values.includes(flag)) return;
	owner.mailReceived = [...values, flag];
});
// Villagers should not repeat an already seen conversation topic. Inspect both
// active and historical dictionaries before deliberately adding a new topic.
function addTopic(owner: Farmer, id: string, duration = 4): void {
	// Decoded dictionaries already have text keys. Only this explicit completion
	// initializes an omitted active list; prior topics and entry payloads stay intact.
	const active = owner.activeDialogueEvents ?? [];
	const previous = owner.previousActiveDialogueEvents ?? [];
	if ([...active, ...previous].some((entry) => entry.key === id)) return;
	owner.activeDialogueEvents = [...active, { key: id, value: duration }];
}
const setRewardText = Effect.fn("Quest.setRewardText")(function* (
	quest: KnownQuest,
	gold: number,
) {
	// Only these generated quest variants own serialized reward-description parts.
	// Extension fields on other variants must remain untouched by reward edits.
	if (
		quest.$type !== "StardewValley.Quests.FishingQuest" &&
		quest.$type !== "StardewValley.Quests.ItemDeliveryQuest" &&
		quest.$type !== "StardewValley.Quests.ResourceCollectionQuest" &&
		quest.$type !== "StardewValley.Quests.SlayMonsterQuest"
	)
		return;
	if (quest.parts === undefined) return;
	for (const part of quest.parts) {
		if (part === null) continue;
		const xmlKey = part.xmlKey;
		if (
			xmlKey === undefined ||
			![
				":ItemDeliveryQuest.cs.13607",
				":FishingQuest.cs.13274",
				":FishingQuest.cs.13248",
			].some((key) => xmlKey.endsWith(key))
		)
			continue;
		const params = part.param;
		const first = params?.[0];
		if (!params || first == null || first.$type !== "System.Int32")
			return yield* new QuestInvalid({
				message: "This quest's advertised reward cannot be updated safely.",
			});
		// Boxed scalar values are immutable; replace only the reward parameter
		// while retaining its discriminator and any imported extension fields.
		params[0] = { ...first, value: gold };
	}
});
export interface QuestCompletionResult {
	removed: boolean;
	started: string[];
	skippedFollowUps: string[];
	prizeTickets: ("added" | "noRoom")[];
}
const complete = Effect.fn("Quest.complete")(function* (
	document: SaveDocument,
	owner: Farmer,
	initial: KnownQuest,
) {
	const result: QuestCompletionResult = {
		removed: false,
		started: [],
		skippedFollowUps: [],
		prizeTickets: [],
	};
	let tickets = 0;
	const processed = new Set<KnownQuest>();
	const completedIds = new Set<string>();
	const game = document.SaveGame;
	const finish = (
		quest: KnownQuest,
		depth = 0,
	): Effect.Effect<void, QuestInvalid> =>
		Effect.gen(function* () {
			if (depth > 50)
				return yield* new QuestInvalid({
					message: "The follow-up chain is too deep to complete safely.",
				});
			if (quest.completed === true || processed.has(quest)) return;
			processed.add(quest);
			const id = quest.id;
			if (id != null && id !== "") completedIds.add(id);
			// Secret retrieval quests bypass ordinary quest stats and replace another
			// journal entry; completing them here does not grant friendship or take items.
			if (quest.$type === "StardewValley.Quests.SecretLostItemQuest") {
				const replaced =
					quest.$type === "StardewValley.Quests.SecretLostItemQuest"
						? quest.exclusiveQuestId
						: undefined;
				writeJournal(
					owner,
					journal(owner).entries.filter(
						(candidate) =>
							candidate !== quest &&
							(nonemptyText(replaced) === undefined ||
								candidate === null ||
								candidate.$type === "$unknown" ||
								candidate.id !== replaced),
					),
				);
				if (quest === initial) result.removed = true;
				return;
			}
			// These counters and mail flags belong to completion, not reward collection.
			if (quest.dailyQuest === true) {
				const done = yield* incrementStat(owner, "BillboardQuestsDone");
				yield* mail(owner, "completedFirstBillboardQuest");
				if (done % 3 === 0) {
					tickets++;
					if (done >= 6) yield* mail(owner, "gotFirstBillboardPrizeTicket");
				}
			}
			if (quest.dailyQuest === true || quest.questType === 7)
				yield* incrementStat(owner, "questsCompleted");
			if (paysReward(quest)) {
				quest.moneyReward = quest.reward;
			}
			quest.completed = true;
			const ids = followIds(quest);
			if (!ids)
				return yield* new QuestInvalid({
					message: "This quest's follow-up list is unsupported.",
				});
			// Follow-ups append like Farmer.addQuest. Already built buildings may finish
			// immediately, recursively starting their own supported follow-ups.
			for (const nextId of ids) {
				if (nextId === "7" && String(game.whichFarm) === "MeadowlandsFarm")
					continue;
				if (
					completedIds.has(nextId) ||
					journal(owner).entries.some(
						(candidate) =>
							candidate !== null &&
							candidate.$type !== "$unknown" &&
							candidate.id === nextId,
					)
				)
					continue;
				const definition = questDefinitions.get(nextId);
				const next = definition
					? questFromData(definition, document.SaveGame.player === owner)
					: undefined;
				if (!next || next.$type === "$unknown") {
					result.skippedFollowUps.push(questLabel(nextId));
					continue;
				}
				writeJournal(owner, [...journal(owner).entries, next]);
				result.started.push(next.questTitle ?? questLabel(nextId));
				if (next.completionString !== undefined) {
					const values = game.constructedBuildings ?? [];
					if (values.some((value) => value === null))
						return yield* new QuestInvalid({
							message:
								"The team's constructed-building history is unsupported.",
						});
					if (values.includes(next.completionString))
						yield* finish(next, depth + 1);
				}
			}
			const gold = reward(quest);
			// Reward-bearing quests remain in the journal for in-game collection;
			// rewardless quests leave immediately, without paying money into the wallet.
			if (gold <= 0 && !(nonemptyText(rewardText(quest)) !== undefined)) {
				writeJournal(
					owner,
					journal(owner).entries.filter((candidate) => candidate !== quest),
				);
				if (quest === initial) result.removed = true;
			}
			if (id === "126") {
				yield* mail(owner, "emilyFiber");
				addTopic(owner, "emilyFiber", 2);
			}
			if (id !== undefined) addTopic(owner, `questComplete_${id}`);
		});
	yield* finish(initial);
	return { result, tickets };
});
/** Queue one deliberate quest edit; completion consequences publish as one Undo step. */
export const setQuest = Effect.fn("Quest.set")(function* (input: QuestChange) {
	const parsed = decode({ ...input });
	if (Result.isFailure(parsed))
		return yield* new QuestInvalid({
			message: "Choose a valid journal action.",
		});
	const request = parsed.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = farmers(snapshot.state.document).filter(
		(owner) => owner.UniqueMultiplayerID?.toString() === request.farmerId,
	);
	const owner = matches[0];
	if (matches.length !== 1 || !owner)
		return yield* new QuestInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	const view = project(snapshot.state.document, owner, true);
	const row = view.quests.find((quest) => quest.key === request.questKey);
	if (!view.supported || !(row?.supported === true))
		return yield* new QuestInvalid({
			message:
				row?.reason ?? view.reason ?? "This quest is no longer available.",
		});
	const quest = journal(owner).entries.find(
		(candidate) => candidate !== null && keyOf(candidate) === request.questKey,
	);
	if (quest == null || quest.$type === "$unknown")
		return yield* new QuestInvalid({
			message: "This quest is no longer available.",
		});
	const prepared = yield* Effect.gen(function* () {
		if (request.kind === "remove") {
			writeJournal(
				owner,
				journal(owner).entries.filter((candidate) => candidate !== quest),
			);
			return undefined;
		}
		if (request.kind === "complete") {
			if (row.completed) return undefined;
			return yield* complete(snapshot.state.document, owner, quest);
		}
		if (request.kind === "reward") {
			if (!row.rewardSupported)
				return yield* new QuestInvalid({
					message: "This quest's reward cannot be edited safely.",
				});
			if (request.value === row.reward) return undefined;
			if (paysReward(quest) && !row.completed) quest.reward = request.value;
			else quest.moneyReward = request.value;
			if (row.helpWanted) yield* setRewardText(quest, request.value);
		} else {
			if (
				!row.daysSupported ||
				!row.timed ||
				request.value < 1 ||
				request.value > 99
			)
				return yield* new QuestInvalid({
					message:
						"Days left must be between 1 and 99 for an unfinished timed quest.",
				});
			quest.daysLeft = request.value;
		}
		return undefined;
	});
	// Publish all journal/stat/mail/topic staging before inventory staging reads
	// it. History commits both capabilities together or rolls the whole action back.
	yield* transaction.replace(snapshot);
	if (prepared) {
		const inventory = yield* InventoryEdits;
		for (let index = 0; index < prepared.tickets; index++)
			prepared.result.prizeTickets.push(
				yield* inventory.grantPrizeTicket(request.farmerId),
			);
	}
	yield* recordAnnotatedOperation(Effect.void).pipe(
		withReviewMetadata({
			label: `${request.kind === "complete" ? "Complete" : request.kind === "remove" ? "Remove" : "Update"} ${row.title}`,
			emphasis: "standalone",
			tags: ["quests", `quests:${request.kind}`, `farmer:${request.farmerId}`],
		}),
	);
	return prepared?.result;
});
