import { Effect, Result } from "effect";
import {
	decodeFarmSettingsChange,
	type FarmSettingsChange,
} from "./farm-settings.ts";
export { FarmSettingsInvalid } from "./farm-settings.ts";
import type { Save } from "../../../codegen/save.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/**
 * Committed display values use the schema's field types, except mine rewards:
 * imported modded modes must remain visible even though new edits use known modes.
 */
export interface FarmSettings extends Omit<
	Required<FarmSettingsChange>,
	"mineRewards"
> {
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
	request: Partial<FarmSettings>,
) {
	// Enforce the same rules used for control feedback at the write boundary.
	// Decode only requested changes so untouched imported custom values survive.
	const decoded = decodeFarmSettingsChange(request);
	if (Result.isFailure(decoded)) return yield* decoded.failure;
	const change = decoded.success;
	const keys = Object.keys(change);
	const transaction = yield* TransactionDraft;
	let changed = false;
	yield* transaction.mutate((state) => {
		const game = state.document.SaveGame as unknown as Save;
		// Name and sale-price multiplier are mirrored on each serialized farmer. Keep
		// unclaimed cabin records and their opaque fields rather than rebuilding them.
		for (const farmer of farmers(state.document)) {
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
	});
	// A no-op contributes neither patches nor misleading review annotations.
	if (!changed) return;
	const labels = [
		change.name !== undefined ? "farm name" : "",
		change.profitPercent !== undefined ? "profit margin" : "",
		change.monsters !== undefined ? "monster spawning" : "",
		change.mineRewards !== undefined ? "mine rewards" : "",
	].filter(Boolean);
	yield* recordAnnotatedOperation(Effect.void).pipe(
		withReviewMetadata({
			label: `Update ${labels.join(", ")}`,
			emphasis: "standalone",
			tags: ["farm", ...keys.map((key) => `farm:${key}`)],
		}),
	);
});
