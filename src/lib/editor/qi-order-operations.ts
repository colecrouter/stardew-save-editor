import { Data, Effect, Random, Result, Schema } from "effect";
import templates from "../../../generated/qiquests.json";
import { MAX_YEAR, SEASONS, totalDays } from "../calendar.ts";
import type { SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export const MAX_QI_OFFERS = 2;
export class QiOrderInvalid extends Data.TaggedError("QiOrderInvalid")<{
	readonly message: string;
}> {}
const requestSchema = Schema.Union([
	Schema.Struct({
		kind: Schema.Literal("offer"),
		key: Schema.String,
		value: Schema.Boolean,
	}),
	Schema.Struct({
		kind: Schema.Literals(["accept", "cancel"]),
		key: Schema.String,
	}),
]);
export type QiOrderChange = typeof requestSchema.Type;
const decode = Schema.decodeUnknownResult(requestSchema, {
	onExcessProperty: "error",
});
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value);
const definitions = new Map(
	templates.map((template) => [template.questKey, template]),
);
function list(raw: unknown) {
	// An empty XML container is a deliberate insertion target; omitted or nil
	// containers are unavailable rather than silently repaired while viewing.
	if (raw === "")
		return { supported: true, raw, entries: [] as unknown[], array: false };
	if (!record(raw) || raw["@_xsi:nil"] === true || raw["@_xsi:nil"] === "true")
		return { supported: false, raw, entries: [] as unknown[], array: false };
	const values = raw.SpecialOrder;
	return {
		supported: values === undefined || Array.isArray(values) || record(values),
		raw,
		entries:
			values === undefined ? [] : Array.isArray(values) ? values : [values],
		array: Array.isArray(values),
	};
}
function replace(
	game: Record<string, unknown>,
	property: string,
	data: ReturnType<typeof list>,
	entries: unknown[],
) {
	// Preserve dictionary metadata and singleton representation unless insertion
	// requires multiple records. Undo restores the original container exactly.
	const next = record(data.raw) ? { ...data.raw } : {};
	if (!data.array && entries.length === 0) delete next.SpecialOrder;
	else
		next.SpecialOrder =
			!data.array && entries.length === 1 ? entries[0] : entries;
	game[property] = next;
}
const keyOf = (entry: unknown) =>
	record(entry) && typeof entry.questKey === "string"
		? entry.questKey
		: undefined;
const rules = (entry: Record<string, unknown>) =>
	typeof entry.specialRule === "string"
		? entry.specialRule.split(",").map((rule) => rule.trim())
		: [];
function date(document: SaveDocument) {
	const game: unknown = document.SaveGame;
	if (!record(game)) return undefined;
	const { year, currentSeason, dayOfMonth } = game;
	const season = SEASONS.find((candidate) => candidate === currentSeason);
	if (
		!integer(year) ||
		year < 1 ||
		year > MAX_YEAR ||
		!integer(dayOfMonth) ||
		dayOfMonth < 1 ||
		dayOfMonth > 28 ||
		season === undefined
	)
		return undefined;
	return {
		today: totalDays({ year, season, day: dayOfMonth }),
		day: dayOfMonth,
	};
}
function deadline(today: number, day: number, duration: string, days: number) {
	// SpecialOrder.SetDuration anchors weekly/monthly orders to the current board
	// period; accepting on Friday does not create a fresh seven-day week.
	if (duration === "Week" || duration === "TwoWeeks")
		return today - ((day - 1) % 7) + days;
	if (duration === "Month") return today - (day - 1) + 28;
	return today + days;
}
// Eviction is a coordinated deletion of a different board record. Only a
// uniquely identified Qi offer may be removed; a matching key alone never
// authorizes deleting duplicate/modded records or an already-active challenge.
function evictionCandidate(
	board: ReturnType<typeof list>,
	active: ReturnType<typeof list>,
) {
	return templates.find((template) => {
		const offered = board.entries.filter(
			(entry) => keyOf(entry) === template.questKey,
		);
		return (
			offered.length === 1 &&
			record(offered[0]) &&
			offered[0].orderType === "Qi" &&
			!active.entries.some((entry) => keyOf(entry) === template.questKey)
		);
	});
}
function cancellationSafe(
	current: unknown,
	active: ReturnType<typeof list>,
	game: Record<string, unknown>,
) {
	if (
		!record(current) ||
		typeof current.appliedSpecialRules !== "boolean" ||
		typeof current.specialRule !== "string"
	)
		return false;
	// Without applied rules, removing the target cannot require world-rule cleanup.
	if (!current.appliedSpecialRules) return true;
	// Every retained order must declare its applied state before we can prove that
	// a rule is no longer shared and safely decrement its persistent contribution.
	if (
		!active.entries.every(
			(entry) =>
				record(entry) &&
				typeof entry.questState === "string" &&
				typeof entry.appliedSpecialRules === "boolean" &&
				typeof entry.specialRule === "string",
		)
	)
		return false;
	return rules(current).every((rule) => {
		if (rule !== "MINE_HARD" && rule !== "SC_HARD") return true;
		const value =
			game[rule === "MINE_HARD" ? "minesDifficulty" : "skullCavesDifficulty"];
		return integer(value) && value >= 0;
	});
}
function deadlineLabel(value: unknown) {
	if (!integer(value) || value < 0) return undefined;
	const season = SEASONS[Math.floor(value / 28) % 4];
	return `${season ? season.charAt(0).toUpperCase() + season.slice(1) : "Unknown season"} ${(value % 28) + 1}, Year ${Math.floor(value / 112) + 1}`;
}
export interface QiOrderRow {
	key: string;
	name: string;
	description: string;
	rewardGems?: number;
	duration?: string;
	offered: boolean;
	state?: string;
	dueDate?: number;
	deadline?: string;
	known: boolean;
	offerAvailable: boolean;
	acceptAvailable: boolean;
	cancelAvailable: boolean;
	reason?: string;
	acceptDescription: string;
	cancelDescription: string;
}
export interface QiOrdersView {
	supported: boolean;
	reason?: string;
	offeredCount: number;
	rows: QiOrderRow[];
}
/** Read shared board/active state without synthesizing records or normalizing XML. */
export function readQiOrders(document: SaveDocument): QiOrdersView {
	const game: unknown = document.SaveGame;
	if (!record(game))
		return {
			supported: false,
			reason: "This save has no supported world state.",
			offeredCount: 0,
			rows: [],
		};
	const board = list(game.availableSpecialOrders),
		active = list(game.specialOrders);
	// Unknown Qi offers count toward the board cap. A malformed unclassified entry
	// prevents additions because we cannot prove a free slot, but targeted removal
	// of an unambiguous known offer remains safe.
	const unknownBoard = board.entries.some(
		(entry) => !record(entry) || typeof entry.orderType !== "string",
	);
	const offeredCount = board.entries.filter(
		(entry) =>
			record(entry) &&
			(entry.orderType === "Qi" || definitions.has(String(entry.questKey))),
	).length;
	const keys = [
		...definitions.keys(),
		...new Set(
			[...board.entries, ...active.entries]
				.map(keyOf)
				.filter(
					(key): key is string => key !== undefined && !definitions.has(key),
				),
		),
	];
	const supported = board.supported && active.supported;
	const rows = keys.map((key) => {
		const template = definitions.get(key);
		const offered = board.entries.filter((entry) => keyOf(entry) === key);
		const accepted = active.entries.filter((entry) => keyOf(entry) === key);
		const current = accepted[0];
		const state =
			record(current) && typeof current.questState === "string"
				? current.questState
				: accepted.length
					? "Unsupported"
					: undefined;
		const known = template !== undefined;
		const unique =
			offered.length <= 1 &&
			accepted.length <= 1 &&
			!(offered.length && accepted.length);
		const qiShape = [...offered, ...accepted].every(
			(entry) => record(entry) && entry.orderType === "Qi",
		);
		const target = supported && known && unique && qiShape;
		const canCreate =
			target &&
			state === undefined &&
			date(document) !== undefined &&
			!unknownBoard;
		const evict =
			offeredCount >= MAX_QI_OFFERS && !offered.length
				? evictionCandidate(board, active)
				: undefined;
		const canEvict =
			offeredCount < MAX_QI_OFFERS ||
			offered.length > 0 ||
			(offeredCount === MAX_QI_OFFERS && evict !== undefined);
		const difficultySafe = cancellationSafe(current, active, game);
		const reason = !known
			? "Imported orders without a supported template remain unchanged."
			: !supported
				? "The shared order containers are unsupported."
				: !unique || !qiShape
					? "This order has ambiguous or unsupported saved records."
					: state && state !== "InProgress"
						? "Claim or dismiss this order in the in-game journal."
						: state === "InProgress" && !difficultySafe
							? "This order's rule state cannot be cancelled safely."
							: !date(document)
								? "A valid world date is required to create an order."
								: !offered.length &&
									  (unknownBoard || offeredCount >= MAX_QI_OFFERS)
									? "The board has no safely available offer slot."
									: undefined;
		return {
			key,
			name: template?.name ?? key,
			description: template?.description ?? "Imported special order",
			rewardGems: template?.rewardGems,
			duration: template?.duration,
			offered: offered.length > 0,
			state,
			known,
			dueDate:
				record(current) && integer(current.dueDate)
					? current.dueDate
					: undefined,
			deadline: record(current) ? deadlineLabel(current.dueDate) : undefined,
			offerAvailable:
				target &&
				state === undefined &&
				(offered.length > 0 || (canCreate && offeredCount < MAX_QI_OFFERS)),
			acceptAvailable: canCreate && canEvict,
			cancelAvailable: target && state === "InProgress" && difficultySafe,
			reason,
			acceptDescription: `Start this challenge immediately, bypassing the weekly board acceptance limit. ${evict ? `${evict.name} will be removed from the board. ` : ""}Rewards must be earned in-game.`,
			cancelDescription:
				"Remove this active order and its progress. Existing items remain; no spent items are refunded. Applied mine difficulty is removed only when no other active order uses that rule. Undo restores the order and saved difficulty.",
		};
	});
	return {
		supported,
		reason: supported
			? undefined
			: "The shared order containers are unsupported.",
		offeredCount,
		rows,
	};
}
// Generated templates are trusted build inputs. An invalid tile is a defect in
// that catalog, not a recoverable save problem or a reason to insert NaN values.
function templateTile(raw: unknown) {
	if (typeof raw !== "string")
		throw new Error("Missing generated Qi dropbox tile");
	const [X, Y, extra] = raw.trim().split(/\s+/).map(Number);
	if (!integer(X) || !integer(Y) || extra !== undefined)
		throw new Error("Invalid generated Qi dropbox tile");
	return { X, Y };
}
function buildEntry(
	template: (typeof templates)[number],
	today: number,
	day: number,
	seed: number,
) {
	return {
		preSelectedItems: "",
		selectedRandomElements: "",
		objectives: template.objectives.map((objective) => ({
			"@_xsi:type": `${objective.type}Objective`,
			currentCount: 0,
			maxCount: objective.maxCount,
			description: objective.description,
			failOnCompletion: false,
			acceptableContextTagSets: objective.acceptableContextTagSets,
			...("dropBox" in objective
				? {
						dropBox: objective.dropBox,
						dropBoxGameLocation: objective.dropBoxGameLocation,
						dropBoxTileLocation: templateTile(objective.dropBoxTileLocation),
						confirmed: false,
					}
				: {}),
			...("minimumCapacity" in objective
				? { minimumCapacity: objective.minimumCapacity }
				: {}),
			...("useShipmentValue" in objective
				? { useShipmentValue: objective.useShipmentValue }
				: {}),
			...("skullCave" in objective ? { skullCave: objective.skullCave } : {}),
		})),
		generationSeed: seed,
		seenParticipantsIDs: "",
		participantsIDs: "",
		unclaimedRewardsIDs: "",
		appliedSpecialRules: false,
		rewards: [
			{ "@_xsi:type": "GemsReward", amount: { int: template.rewardGems } },
		],
		questKey: template.questKey,
		questName: template.nameToken,
		questDescription: template.descriptionToken,
		requester: "Qi",
		orderType: "Qi",
		specialRule: template.specialRule,
		readyForRemoval: false,
		itemToRemoveOnEnd: -1,
		dueDate: deadline(today, day, template.duration, template.durationDays),
		duration: template.duration,
		questState: "InProgress",
	};
}
/** Apply one board/accept/cancel transaction against the queued authoritative state. */
export const setQiOrder = Effect.fn("QiOrders.set")(function* (
	input: QiOrderChange,
) {
	const decoded = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(decoded))
		return yield* new QiOrderInvalid({
			message: "Choose a valid Qi order action.",
		});
	const request = decoded.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const game: unknown = snapshot.state.document.SaveGame;
	if (!record(game))
		return yield* new QiOrderInvalid({
			message: "This save has no supported world state.",
		});
	const row = readQiOrders(snapshot.state.document).rows.find(
		(row) => row.key === request.key,
	);
	if (!row)
		return yield* new QiOrderInvalid({
			message: "This Qi challenge is unsupported.",
		});
	const board = list(game.availableSpecialOrders),
		active = list(game.specialOrders);
	let label: string;
	if (request.kind === "offer") {
		if (!row.offerAvailable)
			return yield* new QiOrderInvalid({
				message: row.reason ?? "This order cannot be offered safely.",
			});
		if (row.offered === request.value) return;
		if (!request.value)
			replace(
				game,
				"availableSpecialOrders",
				board,
				board.entries.filter((entry) => keyOf(entry) !== request.key),
			);
		else {
			const template = definitions.get(request.key),
				currentDate = date(snapshot.state.document);
			if (!template || !currentDate)
				return yield* new QiOrderInvalid({
					message: "A valid world date and template are required.",
				});
			const entry = buildEntry(
				template,
				currentDate.today,
				currentDate.day,
				yield* Random.nextIntBetween(0, 2147483647),
			);
			replace(game, "availableSpecialOrders", board, [...board.entries, entry]);
		}
		label = `${request.value ? "Offer" : "Remove offer"} ${row.name}`;
	} else if (request.kind === "accept") {
		if (!row.acceptAvailable)
			return yield* new QiOrderInvalid({
				message: row.reason ?? "This order cannot be made active safely.",
			});
		const template = definitions.get(request.key),
			currentDate = date(snapshot.state.document);
		if (!template || !currentDate)
			return yield* new QiOrderInvalid({
				message: "A valid world date and template are required.",
			});
		const evict =
			!row.offered &&
			readQiOrders(snapshot.state.document).offeredCount >= MAX_QI_OFFERS
				? evictionCandidate(board, active)?.questKey
				: undefined;
		replace(
			game,
			"availableSpecialOrders",
			board,
			board.entries.filter(
				(entry) => keyOf(entry) !== request.key && keyOf(entry) !== evict,
			),
		);
		replace(game, "specialOrders", active, [
			...active.entries,
			buildEntry(
				template,
				currentDate.today,
				currentDate.day,
				yield* Random.nextIntBetween(0, 2147483647),
			),
		]);
		label = `Start ${row.name}`;
	} else {
		if (!row.cancelAvailable)
			return yield* new QiOrderInvalid({
				message: row.reason ?? "This order cannot be cancelled safely.",
			});
		const current = active.entries.find(
			(entry) => keyOf(entry) === request.key,
		);
		if (!record(current))
			return yield* new QiOrderInvalid({
				message: "This active order is unavailable.",
			});
		const retained = active.entries.filter((entry) => entry !== current);
		const retainedRules = new Set(
			retained.flatMap((entry) =>
				record(entry) &&
				entry.questState === "InProgress" &&
				entry.appliedSpecialRules === true
					? rules(entry)
					: [],
			),
		);
		// The pending runtime cleanup queue is not serialized. Apply the persistent
		// difficulty decrement once, retaining shrine and other-order contributions.
		if (current.appliedSpecialRules === true) {
			const removed = new Set(rules(current));
			if (removed.has("MINE_HARD") && !retainedRules.has("MINE_HARD")) {
				game.minesDifficulty = Math.max(0, Number(game.minesDifficulty) - 1);
				game.mine_lowestLevelReachedForOrder = -1;
			}
			if (removed.has("SC_HARD") && !retainedRules.has("SC_HARD"))
				game.skullCavesDifficulty = Math.max(
					0,
					Number(game.skullCavesDifficulty) - 1,
				);
		}
		replace(game, "specialOrders", active, retained);
		label = `Cancel ${row.name}`;
	}
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label,
			emphasis: "standalone",
			tags: ["qi-orders", `qi-orders:${request.kind}`],
		}),
	);
});
