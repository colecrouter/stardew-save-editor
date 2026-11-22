import { Data, Effect, Result, Schema } from "effect";

import catalog from "../../../generated/progress.json";
import { type Farmer, farmers } from "./domain.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { TransactionDraft } from "./transaction-draft.ts";

export class FishingInvalid extends Data.TaggedError("FishingInvalid")<{
	readonly message: string;
}> {}

// Farmer.caughtFish stores [count, largest size] under a qualified object ID.
// Only this exact known representation is writable; extra array members might
// belong to a mod and must not be silently reinterpreted or discarded.
function supportedRecord(value: readonly number[]) {
	return value.length === 2 && (value[0] ?? -1) >= 0 && (value[1] ?? -1) >= 0;
}

export function readFishing(farmer: Farmer) {
	const caught = farmer.fishCaught;
	if (caught === undefined) return [];
	return catalog.fish.map((fish) => {
		const matches = caught.filter((entry) => entry.key === `(O)${fish.id}`);
		const saved = matches[0];
		return {
			...fish,
			count: saved?.value[0] ?? 0,
			recorded: saved !== undefined,
			size: saved?.value[1] ?? 0,
			// Keep absent records editable, but expose ambiguity as a read-only reason.
			reason:
				matches.length > 1
					? "This fish has duplicate catch records."
					: saved && !supportedRecord(saved.value)
						? "This fish has an unsupported catch record."
						: undefined,
		};
	});
}

const fishingSchema = Schema.Struct({
	farmerId: Schema.String,
	itemId: Schema.String,
	count: Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: 0, maximum: 2147483647 }),
	),
});
const decode = Schema.decodeUnknownResult(fishingSchema, {
	onExcessProperty: "error",
});

export const setFishCount = Effect.fn("Fishing.setCount")(function* (
	input: typeof fishingSchema.Type,
) {
	const decoded = decode({ ...input });
	if (Result.isFailure(decoded))
		return yield* new FishingInvalid({
			message: "Choose a whole catch count between 0 and 2147483647.",
		});
	const { farmerId, itemId, count } = decoded.success;
	const fish = catalog.fish.find((row) => row.id === itemId);
	if (!fish)
		return yield* new FishingInvalid({
			message: "Choose a supported collection fish.",
		});

	// Resolve the captured owner inside the transaction, never from current UI selection.
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const owners = farmers(snapshot.state.document).filter(
		(farmer) => farmer.UniqueMultiplayerID?.toString() === farmerId,
	);
	const owner = owners[0];
	if (owners.length !== 1 || (owner?.name?.trim() ?? "") === "")
		return yield* new FishingInvalid({
			message: "Choose a named farmer with an unambiguous saved identifier.",
		});
	const caught = owner?.fishCaught;
	if (caught === undefined)
		return yield* new FishingInvalid({
			message: "This farmer has no readable fishing collection.",
		});
	const key = `(O)${itemId}`;
	const matches = caught.filter((row) => row.key === key);
	const saved = matches[0];
	if (matches.length > 1 || (saved && !supportedRecord(saved.value)))
		return yield* new FishingInvalid({
			message: "This fish has duplicate or unsupported catch records.",
		});

	// Zero removes membership credit, including imported zero-count records.
	// Positive edits retain the record size and extension metadata. New records
	// use zero for an unrecorded size rather than inventing a historical catch size.
	if (count === 0) {
		if (!saved) return;
		caught.splice(caught.indexOf(saved), 1);
	} else if (saved) {
		if (saved.value[0] === count) return;
		saved.value[0] = count;
	} else caught.push({ key, value: [count, 0] });

	// This edits collection evidence only. Do not run caughtFish's dialogue,
	// quest/festival hooks or Stats.checkForFishingAchievements (awards and mail).
	// The separate fishCaught stat remains saved as imported, not synthesized.
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${fish.name} catch count`,
			emphasis: "standalone",
			tags: ["progress", "progress:fishing", `farmer:${farmerId}`],
		}),
	);
});
