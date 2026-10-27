import { Data, Effect } from "effect";
import type { Save } from "../../../codegen/save.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/** Editable farm controls. Profit uses percentage units (100 means multiplier 1). */
export interface FarmSettings {
	name: string;
	profitPercent: number;
	monsters: boolean;
	mineRewards: string;
}
/** A recorded creation setting and why the editor presents it as read-only. */
export interface FarmCreationSetting {
	label: string;
	value: string;
	reason: string;
}
/** Committed farm read model; creation details are explanatory, never edit targets. */
export interface FarmView extends FarmSettings {
	creation: FarmCreationSetting[];
}
/** An expected invalid farm request; unexpected implementation errors stay defects. */
export class FarmSettingsInvalid extends Data.TaggedError(
	"FarmSettingsInvalid",
)<{
	readonly message: string;
}> {}

/**
 * Project committed farm settings without modifying or normalizing the source.
 * Missing/custom values receive display defaults only; they remain preserved
 * unless the corresponding control is explicitly edited. Percentage rounding
 * removes floating-point display noise without changing the stored multiplier.
 */
export function readFarmSettings(document: SaveDocument): FarmView {
	const game = document.SaveGame as unknown as Save;
	const multiplier = game.player.difficultyModifier;
	const layouts = [
		"Standard",
		"Riverland",
		"Forest",
		"Hill-top",
		"Wilderness",
		"Four Corners",
		"Beach",
	];
	const layout =
		typeof game.whichFarm === "number"
			? (layouts[game.whichFarm] ?? `Unknown (${game.whichFarm})`)
			: game.whichFarm === "MeadowlandsFarm"
				? "Meadowlands"
				: `Custom (${game.whichFarm ?? "not recorded"})`;
	return {
		name: typeof game.player.farmName === "string" ? game.player.farmName : "",
		profitPercent:
			typeof multiplier === "number" && Number.isFinite(multiplier)
				? Number((multiplier * 100).toPrecision(12))
				: 100,
		monsters: game.shouldSpawnMonsters === true,
		mineRewards:
			typeof game.shuffleMineChests === "string" && game.shuffleMineChests
				? game.shuffleMineChests
				: "Default",
		creation: [
			{
				label: "Farm type",
				value: layout,
				reason:
					"The map layout is fixed. Changing it leaves buildings, crops and objects in invalid spots.",
			},
			{
				label: "Community Center bundles",
				value: "Not recorded",
				reason:
					"The save retains the selected bundles, not the original creation option.",
			},
			{
				label: "Guarantee Year 1 completable",
				value: game.visitsUntilY1Guarantee >= 0 ? "On" : "Off, or already used",
				reason:
					"The save keeps a Traveling Cart visit countdown; the game stops it after the guaranteed seed visit.",
			},
			{
				label: "Money",
				value: game.player.useSeparateWallets ? "Separate wallets" : "Shared",
				reason:
					"Change wallet mode with the ledger in the Mayor’s Manor so the game can split or merge the gold overnight.",
			},
			{
				label: "Random seed",
				value: String(game.uniqueIDForThisGame ?? "Not recorded"),
				reason:
					"The save’s folder and file use this number, and it seeds much of the game’s randomness.",
			},
			{
				label: "Legacy randomization",
				value: game.useLegacyRandom ? "On" : "Off",
				reason:
					"Changing this recalculates rolled items and other random outcomes.",
			},
		],
	};
}

/**
 * Stage requested farm controls through `model.commands.transact` as one reversible
 * step. Name and profit changes update every serialized farmer; monster spawning
 * and mine rewards update their global fields. Only changed fields are written.
 * Expected invalid requests fail with FarmSettingsInvalid before publication.
 */
export const setFarmSettings = Effect.fn("Farm.setSettings")(function* (
	change: Partial<FarmSettings>,
) {
	// Validate the complete request before staging writes. Unchanged imported mod
	// values are not constrained by controls which the user has not edited.
	const keys = Object.keys(change);
	if (
		keys.some(
			(key) =>
				!["name", "profitPercent", "monsters", "mineRewards"].includes(key),
		)
	)
		return yield* new FarmSettingsInvalid({
			message: "Choose a supported farm setting.",
		});
	if (
		Object.hasOwn(change, "name") &&
		(typeof change.name !== "string" || !change.name.trim())
	)
		return yield* new FarmSettingsInvalid({ message: "Enter a farm name." });
	if (
		Object.hasOwn(change, "profitPercent") &&
		(typeof change.profitPercent !== "number" ||
			!Number.isFinite(change.profitPercent) ||
			change.profitPercent < 1 ||
			change.profitPercent > 1000)
	)
		return yield* new FarmSettingsInvalid({
			message: "Enter a profit percentage from 1 to 1000.",
		});
	if (Object.hasOwn(change, "monsters") && typeof change.monsters !== "boolean")
		return yield* new FarmSettingsInvalid({
			message: "Choose whether monsters spawn on the farm.",
		});
	if (
		Object.hasOwn(change, "mineRewards") &&
		change.mineRewards !== "Default" &&
		change.mineRewards !== "Remixed"
	)
		return yield* new FarmSettingsInvalid({
			message: "Choose normal or remixed mine rewards.",
		});
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const game = snapshot.state.document.SaveGame as unknown as Save;
	let changed = false;
	// Name and sale-price multiplier are mirrored on each serialized farmer. Keep
	// unclaimed cabin records and their opaque fields rather than rebuilding them.
	for (const farmer of farmers(snapshot.state.document)) {
		if (change.name !== undefined && farmer.farmName !== change.name) {
			farmer.farmName = change.name;
			changed = true;
		}
		const player = farmer as unknown as Save["player"];
		if (
			change.profitPercent !== undefined &&
			player.difficultyModifier !== change.profitPercent / 100
		) {
			player.difficultyModifier = change.profitPercent / 100;
			changed = true;
		}
	}
	if (
		change.monsters !== undefined &&
		game.shouldSpawnMonsters !== change.monsters
	) {
		game.shouldSpawnMonsters = change.monsters;
		changed = true;
	}
	if (
		change.mineRewards !== undefined &&
		game.shuffleMineChests !== change.mineRewards
	) {
		game.shuffleMineChests = change.mineRewards;
		changed = true;
	}
	// A no-op contributes neither patches nor misleading review annotations.
	if (!changed) return;
	const labels = [
		change.name !== undefined ? "farm name" : "",
		change.profitPercent !== undefined ? "profit margin" : "",
		change.monsters !== undefined ? "monster spawning" : "",
		change.mineRewards !== undefined ? "mine rewards" : "",
	].filter(Boolean);
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${labels.join(", ")}`,
			emphasis: "standalone",
			tags: ["farm", ...keys.map((key) => `farm:${key}`)],
		}),
	);
});

/**
 * Parse an explicit settings-form submission. Drafts retain textual percentages
 * while empty/incomplete; range validation applies only to changed controls in
 * setFarmSettings, so an untouched custom percentage does not block other edits.
 * @throws Error when the submitted JSON does not contain usable control values.
 */
export function parseFarmDraft(text: string): FarmSettings {
	const value: unknown = JSON.parse(text);
	if (!value || typeof value !== "object")
		throw Error("Enter valid farm settings.");
	const fields = value as Record<string, unknown>;
	if (
		typeof fields.name !== "string" ||
		typeof fields.profitPercent !== "string" ||
		fields.profitPercent.trim() === "" ||
		!Number.isFinite(Number(fields.profitPercent)) ||
		typeof fields.monsters !== "boolean" ||
		typeof fields.mineRewards !== "string"
	)
		throw Error("Enter a farm name and a valid numeric profit percentage.");
	return {
		name: fields.name,
		profitPercent: Number(fields.profitPercent),
		monsters: fields.monsters,
		mineRewards: fields.mineRewards,
	};
}
/** Format committed controls as draft strings without including creation metadata. */
export const formatFarmDraft = (value: FarmSettings) =>
	JSON.stringify({
		name: value.name,
		profitPercent: String(value.profitPercent),
		monsters: value.monsters,
		mineRewards: value.mineRewards,
	});

/**
 * Compare a submitted form with its captured committed source. Display defaults
 * and imported custom values never become incidental writes to unrelated fields.
 */
export function changedFarmSettings(
	before: FarmSettings,
	after: FarmSettings,
): Partial<FarmSettings> {
	const change: Partial<FarmSettings> = {};
	if (before.name !== after.name) change.name = after.name;
	if (before.profitPercent !== after.profitPercent)
		change.profitPercent = after.profitPercent;
	if (before.monsters !== after.monsters) change.monsters = after.monsters;
	if (before.mineRewards !== after.mineRewards)
		change.mineRewards = after.mineRewards;
	return change;
}
