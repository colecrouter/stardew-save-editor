import type { T_StardewValley_Quests_Quest as Quest } from "../../../generated/save-format/save.ts";
import { savedType } from "./saved-types.ts";
import { Data, Effect, Result, Schema } from "effect";
import { farmers, type Farmer, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import { prizeTicketDestination } from "./quest-ticket.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { questDefinitions, questFromData, questLabel } from "./quest-data.ts";

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
// Predicates validate only the values inspected by the adapter. They never decode
// an imported save record or strip opaque members from its representation.
const record = Schema.is(
	Schema.Record(Schema.String, Schema.mutableKey(Schema.Unknown)),
);
const integer = Schema.is(
	Schema.Finite.check(
		Schema.isInt(),
		Schema.isBetween({
			minimum: Number.MIN_SAFE_INTEGER,
			maximum: Number.MAX_SAFE_INTEGER,
		}),
	),
);
const isScalar = Schema.is(
	Schema.Union([Schema.String, Schema.Finite, Schema.BigInt]),
);
// Collections are arrays; omitted fields may be initialized only where explicitly allowed.
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const scalar = (v: unknown) => (isScalar(v) ? String(v) : undefined);
const owners = farmers;
// Unknown subclasses remain visible, but only generated vanilla variants can
// enter the mutation path; their discriminant establishes writable saved fields.
type KnownQuest = Exclude<Quest, { readonly $type: "$unknown" }>;
function dictionary<T>(raw: T[] | undefined, omitted = false) {
	return {
		raw,
		entries: Array.isArray(raw) ? raw : [],
		supported: Array.isArray(raw) || (omitted && raw === undefined),
	};
}
function journal(owner: Farmer) {
	const raw = owner.questLog;
	// Malformed injected journals stay read-only without making projection iterate
	// a non-array value; decoded journals keep their generated quest types.
	return {
		raw,
		entries: Array.isArray(raw) ? raw : [],
		supported: Array.isArray(raw),
	};
}
function writeJournal(owner: Farmer, entries: (Quest | null)[]) {
	owner.questLog = entries;
}
function keyOf(raw: Quest) {
	const id = scalar(raw.id);
	if (id !== undefined) return `id:${id}`;
	// Help Wanted quests have no story ID. Capture their immutable generated identity,
	// excluding fields edited by this screen so a valid input never retargets itself.
	const {
		moneyReward,
		reward,
		daysLeft,
		completed,
		destroy,
		showNew,
		parts,
		...identity
	} = raw;
	return `generated:${JSON.stringify(identity)}`;
}
const questType = (raw: Quest) =>
	typeof savedType(raw) === "string" ? savedType(raw) : "Quest";
function paysReward(raw: Quest) {
	const type = questType(raw);
	return (
		raw.reward !== undefined &&
		(type === "FishingQuest" ||
			type === "ResourceCollectionQuest" ||
			(type === "SlayMonsterQuest" &&
				raw.target !== undefined &&
				raw.target !== "null"))
	);
}
function reward(raw: Quest) {
	const value =
		paysReward(raw) && raw.completed !== true ? raw.reward : raw.moneyReward;
	return value === undefined
		? 0
		: integer(value)
			? Math.max(0, value)
			: undefined;
}
function followIds(raw: Quest) {
	if (raw.nextQuests === "" || raw.nextQuests === undefined) return [];
	if (!Array.isArray(raw.nextQuests)) return undefined;
	const values = list(raw.nextQuests);
	if (values.some((value) => scalar(value) === undefined)) return undefined;
	return values.flatMap((value) => {
		const id = scalar(value);
		return id && !["0", "-1"].includes(id) ? [id] : [];
	});
}
function rewardText(raw: Quest) {
	return typeof raw.rewardDescription === "string" &&
		raw.rewardDescription.length > 2
		? raw.rewardDescription
		: undefined;
}
export interface QuestView {
	key: string;
	renderKey: string;
	title: string;
	description: string;
	objective: string;
	supported: boolean;
	reason?: string;
	completed: boolean;
	secret: boolean;
	helpWanted: boolean;
	canBeCancelled: boolean;
	reward?: number;
	rewardSupported: boolean;
	rewardText?: string;
	friendshipReward?: number;
	timed: boolean;
	daysLeft?: number;
	daysSupported: boolean;
	followUps: string[];
	skippedFollowUps: string[];
	ticketDue: boolean;
	ticketRoom?: boolean;
}
export interface QuestFarmerView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
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
	const all = data.entries.filter(record);
	const keys = all.map(keyOf);
	const knownIds = new Set(all.map((raw) => scalar(raw.id)));
	const game = document.SaveGame;
	const occurrences = new Map<string, number>();
	return {
		farmerId: scalar(owner.UniqueMultiplayerID) ?? "",
		name: typeof owner.name === "string" ? owner.name : "Unnamed farmer",
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
			.map((raw) => {
				const key = keyOf(raw);
				// Duplicate imported identities still need distinct render keys, but they
				// never acquire separate command authority: both remain read-only.
				const occurrence = occurrences.get(key) ?? 0;
				occurrences.set(key, occurrence + 1);
				const valid =
					supported &&
					keys.filter((candidate) => candidate === key).length === 1 &&
					(raw.id === undefined || scalar(raw.id) !== undefined) &&
					(raw.completed === undefined || typeof raw.completed === "boolean");
				const secret = questType(raw) === "SecretLostItemQuest";
				const helpWanted = raw.dailyQuest === true;
				const completed = raw.completed === true;
				const ids = followIds(raw);
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
				const gold = reward(raw);
				const days =
					raw.daysLeft === undefined
						? 0
						: integer(raw.daysLeft)
							? raw.daysLeft
							: undefined;
				return {
					key,
					renderKey: `${key}:${occurrence}`,
					title:
						typeof raw._questTitle === "string" && raw._questTitle
							? raw._questTitle
							: typeof raw.questTitle === "string"
								? raw.questTitle
								: "Untitled quest",
					description:
						typeof raw._questDescription === "string"
							? raw._questDescription
							: "",
					objective:
						typeof raw._currentObjective === "string"
							? raw._currentObjective
							: "",
					supported: valid,
					reason: valid
						? undefined
						: "This quest has an ambiguous or unsupported saved identity.",
					completed,
					secret,
					helpWanted,
					canBeCancelled: raw.canBeCancelled === true,
					reward: gold,
					rewardSupported: valid && gold !== undefined && !secret,
					rewardText: rewardText(raw),
					friendshipReward: integer(raw.friendshipReward)
						? raw.friendshipReward
						: undefined,
					timed: helpWanted || (days !== undefined && days > 0),
					daysLeft: days,
					daysSupported: valid && days !== undefined && !completed,
					followUps: starts,
					skippedFollowUps: skipped,
					ticketDue,
					ticketRoom:
						ticketDue && Array.isArray(owner.items)
							? prizeTicketDestination(owner.items) !== undefined
							: undefined,
				};
			}),
	};
}
/** Read detached journal views without constructors, normalization or saved writes. */
export function readQuestJournals(document: SaveDocument): QuestFarmerView[] {
	const all = owners(document);
	return all.map((owner) => {
		const id = scalar(owner.UniqueMultiplayerID);
		return project(
			document,
			owner,
			id !== undefined &&
				all.filter((candidate) => scalar(candidate.UniqueMultiplayerID) === id)
					.length === 1,
		);
	});
}
// Shared checked reading keeps projection and command rejection in agreement.
// Unsupported imported values remain untouched; mutation helpers lift this Result
// into the typed Effect error channel instead of throwing during preparation.
function statDataResult(owner: Farmer) {
	if (!record(owner.stats))
		return Result.fail(
			new QuestInvalid({
				message: "This farmer's completion stats are unsupported.",
			}),
		);
	const values = dictionary(owner.stats.Values, true);
	if (!values.supported)
		return Result.fail(
			new QuestInvalid({
				message: "This farmer's completion stats are unsupported.",
			}),
		);
	return Result.succeed({ root: owner.stats, ...values });
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
		(entry) =>
			record(entry) &&
			typeof entry.key === "string" &&
			entry.key.toLowerCase() === name.toLowerCase(),
	);
	if (matches.length > 1)
		return Result.fail(
			new QuestInvalid({ message: `The saved ${name} stat is ambiguous.` }),
		);
	const first = matches[0];
	if (first === undefined) return Result.succeed(0);
	const value = record(first) ? first.value : undefined;
	if (!integer(value) || value < 0 || value >= 4294967295)
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
		(entry) =>
			record(entry) &&
			typeof entry.key === "string" &&
			entry.key.toLowerCase() === name.toLowerCase(),
	);
	if (record(existing)) existing.value = value;
	else data.root.Values = [...data.entries, { key: name, value }];
	return value;
});
// Completion adds only its own flags, leaving unrelated mail and metadata intact.
const mail = Effect.fn("Quest.mail")(function* (owner: Farmer, flag: string) {
	const raw = owner.mailReceived;
	if (!Array.isArray(raw))
		return yield* new QuestInvalid({
			message: "This farmer's mail flags are unsupported.",
		});
	const values = raw;
	if (values.some((value) => typeof value !== "string"))
		return yield* new QuestInvalid({
			message: "This farmer's mail flags are unsupported.",
		});
	if (values.includes(flag)) return;
	owner.mailReceived = [...values, flag];
});
// Villagers should not repeat an already seen conversation topic. Inspect both
// active and historical dictionaries before deliberately adding a new topic.
const topic = Effect.fn("Quest.topic")(function* (
	owner: Farmer,
	id: string,
	duration = 4,
) {
	const active = dictionary(owner.activeDialogueEvents, true);
	const previous = dictionary(owner.previousActiveDialogueEvents, true);
	if (!active.supported || !previous.supported)
		return yield* new QuestInvalid({
			message: "This farmer's dialogue topics are unsupported.",
		});
	const values = [...active.entries, ...previous.entries];
	if (values.some((entry) => !record(entry) || typeof entry.key !== "string"))
		return yield* new QuestInvalid({
			message: "This farmer's dialogue topic keys are unsupported.",
		});
	if (values.some((entry) => record(entry) && entry.key === id)) return;
	owner.activeDialogueEvents = [
		...active.entries,
		{ key: id, value: duration },
	];
});
const setRewardText = Effect.fn("Quest.setRewardText")(function* (
	raw: KnownQuest,
	gold: number,
) {
	// Only these generated quest variants own serialized reward-description parts.
	// Extension fields on other variants must remain untouched by reward edits.
	if (
		raw.$type !== "StardewValley.Quests.FishingQuest" &&
		raw.$type !== "StardewValley.Quests.ItemDeliveryQuest" &&
		raw.$type !== "StardewValley.Quests.ResourceCollectionQuest" &&
		raw.$type !== "StardewValley.Quests.SlayMonsterQuest"
	)
		return;
	if (raw.parts === undefined) return;
	if (!Array.isArray(raw.parts))
		return yield* new QuestInvalid({
			message: "This quest's reward description is unsupported.",
		});
	for (const part of raw.parts) {
		if (!record(part)) continue;
		const xmlKey = part.xmlKey;
		if (
			typeof xmlKey !== "string" ||
			![
				":ItemDeliveryQuest.cs.13607",
				":FishingQuest.cs.13274",
				":FishingQuest.cs.13248",
			].some((key) => xmlKey.endsWith(key))
		)
			continue;
		const params = part.param;
		const first = params?.[0];
		if (!params || !record(first) || first.$type !== "System.Int32")
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
		raw: KnownQuest,
		depth = 0,
	): Effect.Effect<void, QuestInvalid> =>
		Effect.gen(function* () {
			if (depth > 50)
				return yield* new QuestInvalid({
					message: "The follow-up chain is too deep to complete safely.",
				});
			if (raw.completed === true || processed.has(raw)) return;
			for (const field of ["completed", "dailyQuest", "destroy"] as const) {
				if (raw[field] !== undefined && typeof raw[field] !== "boolean")
					return yield* new QuestInvalid({
						message: "This quest has unsupported completion flags.",
					});
			}
			if (raw.questType !== undefined && !integer(raw.questType))
				return yield* new QuestInvalid({
					message: "This quest has an unsupported saved type.",
				});
			processed.add(raw);
			const id = scalar(raw.id);
			if (id) completedIds.add(id);
			// Secret retrieval quests bypass ordinary quest stats and replace another
			// journal entry; completing them here does not grant friendship or take items.
			if (questType(raw) === "SecretLostItemQuest") {
				const replaced = scalar(raw.exclusiveQuestId);
				writeJournal(
					owner,
					journal(owner).entries.filter(
						(candidate) =>
							candidate !== raw &&
							(!replaced ||
								!record(candidate) ||
								scalar(candidate.id) !== replaced),
					),
				);
				if (raw === initial) result.removed = true;
				return;
			}
			// These counters and mail flags belong to completion, not reward collection.
			if (raw.dailyQuest === true) {
				const done = yield* incrementStat(owner, "BillboardQuestsDone");
				yield* mail(owner, "completedFirstBillboardQuest");
				if (done % 3 === 0) {
					tickets++;
					if (done >= 6) yield* mail(owner, "gotFirstBillboardPrizeTicket");
				}
			}
			if (raw.dailyQuest === true || raw.questType === 7)
				yield* incrementStat(owner, "questsCompleted");
			if (paysReward(raw)) {
				if (!integer(raw.reward))
					return yield* new QuestInvalid({
						message: "This quest's advertised reward is unsupported.",
					});
				raw.moneyReward = raw.reward;
			}
			raw.completed = true;
			const ids = followIds(raw);
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
						(candidate) => record(candidate) && scalar(candidate.id) === nextId,
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
				result.started.push(
					typeof next.questTitle === "string"
						? next.questTitle
						: questLabel(nextId),
				);
				if (typeof next.completionString === "string") {
					const built = game.constructedBuildings;
					const values =
						built === undefined ? [] : Array.isArray(built) ? built : undefined;
					if (!values || values.some((value) => typeof value !== "string"))
						return yield* new QuestInvalid({
							message:
								"The team's constructed-building history is unsupported.",
						});
					if (values.includes(next.completionString))
						yield* finish(next, depth + 1);
				}
			}
			const gold = reward(raw);
			if (gold === undefined)
				return yield* new QuestInvalid({
					message: "This quest's reward is unsupported.",
				});
			// Reward-bearing quests remain in the journal for in-game collection;
			// rewardless quests leave immediately, without paying money into the wallet.
			if (gold <= 0 && !rewardText(raw)) {
				writeJournal(
					owner,
					journal(owner).entries.filter((candidate) => candidate !== raw),
				);
				if (raw === initial) result.removed = true;
			}
			if (id === "126") {
				yield* mail(owner, "emilyFiber");
				yield* topic(owner, "emilyFiber", 2);
			}
			if (id !== undefined) yield* topic(owner, `questComplete_${id}`);
		});
	yield* finish(initial);
	return { result, tickets };
});
/** Queue one deliberate quest edit; completion consequences publish as one Undo step. */
export const setQuest = Effect.fn("Quest.set")(function* (input: QuestChange) {
	const parsed = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(parsed))
		return yield* new QuestInvalid({
			message: "Choose a valid journal action.",
		});
	const request = parsed.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = owners(snapshot.state.document).filter(
		(owner) => scalar(owner.UniqueMultiplayerID) === request.farmerId,
	);
	const owner = matches[0];
	if (matches.length !== 1 || !owner)
		return yield* new QuestInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	const view = project(snapshot.state.document, owner, true);
	const row = view.quests.find((quest) => quest.key === request.questKey);
	if (!view.supported || !row?.supported)
		return yield* new QuestInvalid({
			message:
				row?.reason ?? view.reason ?? "This quest is no longer available.",
		});
	const raw = journal(owner).entries.find(
		(candidate) => record(candidate) && keyOf(candidate) === request.questKey,
	);
	if (!record(raw) || raw.$type === "$unknown")
		return yield* new QuestInvalid({
			message: "This quest is no longer available.",
		});
	const prepared = yield* Effect.gen(function* () {
		if (request.kind === "remove") {
			writeJournal(
				owner,
				journal(owner).entries.filter((candidate) => candidate !== raw),
			);
			return undefined;
		}
		if (request.kind === "complete") {
			if (row.completed) return undefined;
			return yield* complete(snapshot.state.document, owner, raw);
		}
		if (request.kind === "reward") {
			if (!row.rewardSupported)
				return yield* new QuestInvalid({
					message: "This quest's reward cannot be edited safely.",
				});
			if (request.value === row.reward) return undefined;
			raw[paysReward(raw) && !row.completed ? "reward" : "moneyReward"] =
				request.value;
			if (row.helpWanted) yield* setRewardText(raw, request.value);
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
			raw.daysLeft = request.value;
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
