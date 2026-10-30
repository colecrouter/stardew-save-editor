import { Data, Effect, Schema, Result } from "effect";
import { farmers, type SaveDocument } from "./domain.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const numeric = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);
// This catalog owns both presentation and write limits. Raw keys never escape
// into the UI, and imported values outside these edit limits remain visible.
const numbers = [
	{ key: "health", raw: "maxHealth", label: "Maximum health", max: 99999 },
	{ key: "stamina", raw: "maxStamina", label: "Maximum stamina", max: 99999 },
	{ key: "qi-gems", raw: "qiGems", label: "Qi Gems", max: 99999 },
	{ key: "qi-coins", raw: "clubCoins", label: "Qi Coins", max: 99999 },
	{ key: "hay", raw: "piecesOfHay", label: "Hay (shared farm)", max: 99999 },
	{
		key: "walnuts",
		raw: "goldenWalnuts",
		label: "Golden Walnuts (shared)",
		max: 99999,
	},
	{
		key: "mine",
		raw: "deepestMineLevel",
		label: "Deepest mine (host)",
		max: 77376,
	},
	{
		key: "house-days",
		raw: "daysUntilHouseUpgrade",
		label: "House upgrade days",
		max: 3,
	},
	{
		key: "tool-days",
		raw: "daysLeftForToolUpgrade",
		label: "Tool upgrade days",
		max: 2,
	},
	{ key: "trash", raw: "trashCanLevel", label: "Trash can level", max: 4 },
] as const;
const unlocks = [
	["HasDwarvishTranslationGuide", "Dwarvish Translation Guide"],
	["HasRustyKey", "Rusty Key"],
	["HasClubCard", "Club Card"],
	["HasSpecialCharm", "Special Charm"],
	["HasSkullKey", "Skull Key"],
	["HasMagnifyingGlass", "Magnifying Glass"],
	["HasDarkTalisman", "Dark Talisman"],
	["HasMagicInk", "Magic Ink"],
	["HasTownKey", "Town Key"],
] as const;
export class CharacterDetailsInvalid extends Data.TaggedError(
	"CharacterDetailsInvalid",
)<{ readonly message: string }> {}
export interface CharacterDetailNumber {
	key: string;
	label: string;
	value?: number;
	available: boolean;
	reason?: string;
	min: number;
	max: number;
}
export interface CharacterDetailsView {
	numbers: CharacterDetailNumber[];
	wallet: {
		key: string;
		label: string;
		value: boolean;
		available: boolean;
		reason?: string;
	}[];
	backpackSize?: number;
	backpackAvailable: boolean;
	houseLevel?: number;
	houseUpgrading: boolean;
}
function owner(document: SaveDocument, farmerId: string) {
	const matches = farmers(document).filter(
		(farmer) => String(farmer.UniqueMultiplayerID) === farmerId,
	);
	return matches.length === 1 && record(matches[0]) ? matches[0] : undefined;
}
function numberTarget(
	document: SaveDocument,
	farmer: Record<string, unknown>,
	key: string,
) {
	const game: unknown = document.SaveGame;
	if (key === "walnuts") return record(game) ? game : undefined;
	if (key === "mine")
		return record(document.SaveGame.player)
			? document.SaveGame.player
			: undefined;
	if (key !== "hay") return farmer;
	// A unique named farm is required: choosing the first custom/duplicate location
	// could silently put shared hay into the wrong storage record.
	const locations = document.SaveGame.locations;
	const values = record(locations) ? locations.GameLocation : undefined;
	const list = Array.isArray(values)
		? values
		: values === undefined
			? []
			: [values];
	const matches = list.filter((item) => record(item) && item.name === "Farm");
	return matches.length === 1 && record(matches[0]) ? matches[0] : undefined;
}
function mailList(farmer: Record<string, unknown>) {
	const raw = farmer.mailReceived;
	const value = record(raw) ? raw.string : undefined;
	const list =
		value === undefined ? [] : Array.isArray(value) ? value : [value];
	return {
		raw,
		value,
		list,
		supported:
			(raw === "" || record(raw)) &&
			list.every((item) => typeof item === "string"),
	};
}
/** Read-only projection; no opening-time defaults are written into the save. */
export function readCharacterDetails(
	document: SaveDocument,
	farmerId: string,
): CharacterDetailsView {
	const farmer = owner(document, farmerId);
	const mail = farmer ? mailList(farmer) : undefined;
	const tool = farmer?.toolBeingUpgraded;
	const hasTool =
		record(tool) && tool["@_xsi:nil"] !== true && tool["@_xsi:nil"] !== "true";
	const houseLevel = numeric(farmer?.houseUpgradeLevel)
		? farmer.houseUpgradeLevel
		: undefined;
	const houseUpgrading =
		numeric(farmer?.daysUntilHouseUpgrade) && farmer.daysUntilHouseUpgrade > 0;
	return {
		backpackSize:
			record(farmer?.items) && Array.isArray(farmer.items.Item)
				? farmer.items.Item.length
				: undefined,
		backpackAvailable: Boolean(
			farmer &&
			record(farmer.items) &&
			Array.isArray(farmer.items.Item) &&
			[12, 24, 36].includes(farmer.items.Item.length) &&
			farmer.maxItems === farmer.items.Item.length,
		),
		houseLevel,
		houseUpgrading,
		numbers: numbers.map((definition) => {
			const target = farmer && numberTarget(document, farmer, definition.key);
			const raw = target?.[definition.raw];
			let available = Boolean(target) && numeric(raw);
			let reason = available
				? undefined
				: "This saved value is missing, malformed, or ambiguous.";
			// Timers edit the existing work order, never award a finished house or
			// collect a tool. The game owns those consequences after loading.
			if (
				definition.key === "house-days" &&
				(!numeric(houseLevel) ||
					!Number.isInteger(houseLevel) ||
					houseLevel < 0 ||
					houseLevel >= 3)
			) {
				available = false;
				reason =
					houseLevel === 3
						? "The house is fully upgraded."
						: "The house upgrade level is unsupported.";
			}
			if (definition.key === "tool-days" && !hasTool) {
				available = false;
				reason = "No supported tool is being upgraded by Clint.";
			}
			if (
				definition.key === "trash" &&
				((!record(tool) && tool !== undefined) ||
					(hasTool &&
						record(tool) &&
						/TrashCan$/.test(String(tool.itemId ?? ""))))
			) {
				available = false;
				reason = "Collect the trash can from Clint before changing its level.";
			}
			return {
				key: definition.key,
				label: definition.label,
				value: numeric(raw)
					? definition.key === "house-days"
						? Math.max(0, raw)
						: raw
					: undefined,
				available,
				reason,
				min: definition.key === "house-days" && houseUpgrading ? 1 : 0,
				max: definition.max,
			};
		}),
		wallet: unlocks.map(([key, label]) => ({
			key,
			label,
			value: mail?.list.includes(key) ?? false,
			available: mail?.supported ?? false,
			reason: mail?.supported
				? undefined
				: "This farmer's saved mail flags are unsupported.",
		})),
	};
}
export type CharacterDetailsChange = {
	farmerId: string;
	key: string;
	value: number | boolean | string;
};
const requestSchema = Schema.Struct({
	farmerId: Schema.String,
	key: Schema.String,
	value: Schema.Union([Schema.Finite, Schema.Boolean, Schema.String]),
});
const decodeRequest = Schema.decodeUnknownResult(requestSchema, {
	onExcessProperty: "error",
});
/** Revalidate against the queued document, then publish one deliberate field edit. */
export const setCharacterDetails = Effect.fn("CharacterDetails.set")(function* (
	request: CharacterDetailsChange,
) {
	// Copy only own fields before strict decoding so prototype state cannot
	// authorize a save mutation at this public operation boundary.
	const decoded = decodeRequest(record(request) ? { ...request } : request);
	if (Result.isFailure(decoded))
		return yield* new CharacterDetailsInvalid({
			message: "Choose a valid character edit.",
		});
	request = decoded.success;
	if (request.key === "backpack") {
		if (
			typeof request.value !== "string" ||
			!["12", "24", "36"].includes(request.value)
		)
			return yield* new CharacterDetailsInvalid({
				message: "Choose 12, 24 or 36 backpack slots.",
			});
		const edits = yield* InventoryEdits;
		yield* recordAnnotatedOperation(
			edits.resize(request.farmerId, Number(request.value)),
		).pipe(
			withReviewMetadata({
				label: "Resize backpack",
				emphasis: "standalone",
				tags: ["character", "backpack:resize"],
			}),
		);
		return;
	}
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const farmer = owner(snapshot.state.document, request.farmerId);
	if (!farmer)
		return yield* new CharacterDetailsInvalid({
			message: "Choose an unambiguous farmer.",
		});
	const view = readCharacterDetails(snapshot.state.document, request.farmerId);
	const number = view.numbers.find((field) => field.key === request.key);
	const wallet = view.wallet.find((field) => field.key === request.key);
	let label: string;
	if (number || request.key === "house-cancel") {
		const cancelling = request.key === "house-cancel";
		if (
			cancelling
				? !view.houseUpgrading || request.value !== true
				: !number?.available ||
					typeof request.value !== "number" ||
					!Number.isInteger(request.value) ||
					request.value < number.min ||
					request.value > number.max
		)
			return yield* new CharacterDetailsInvalid({
				message: number?.reason ?? "Choose a valid upgrade or stat value.",
			});
		const definition = numbers.find(
			(entry) => entry.key === (cancelling ? "house-days" : request.key),
		);
		const target =
			definition &&
			numberTarget(snapshot.state.document, farmer, definition.key);
		if (!definition || !target)
			return yield* new CharacterDetailsInvalid({
				message: "This saved value is unavailable.",
			});
		// Zero means no scheduled upgrade, represented by the game's -1 sentinel.
		const value =
			cancelling || (definition.key === "house-days" && request.value === 0)
				? -1
				: request.value;
		if (target[definition.raw] === value) return;
		target[definition.raw] = value;
		label = cancelling
			? "Cancel house upgrade"
			: `Update ${definition.label.toLowerCase()}`;
	} else if (wallet && wallet.available && typeof request.value === "boolean") {
		if (wallet.value === request.value) return;
		const mail = mailList(farmer);
		// Preserve unrelated flags, duplicates and opaque container members. Explicit
		// removal owns every copy of this one flag; additions append exactly once.
		const values = request.value
			? [...mail.list, request.key]
			: mail.list.filter((value) => value !== request.key);
		farmer.mailReceived = {
			...(record(mail.raw) ? mail.raw : {}),
			string:
				typeof mail.value === "string" && values.length === 1
					? values[0]
					: values,
		};
		label = `${request.value ? "Enable" : "Remove"} ${wallet.label}`;
	} else
		return yield* new CharacterDetailsInvalid({
			message: wallet?.reason ?? "Choose a supported character field.",
		});
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label,
			emphasis: "standalone",
			tags: ["character", "character:details", `farmer:${request.farmerId}`],
		}),
	);
});
