import { Data, Effect, Result, Schema } from "effect";

import requirements from "../../../generated/achievement-requirements.json";
import catalog from "../../../generated/progress.json";
import { type Farmer, farmers } from "./domain.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { TransactionDraft } from "./transaction-draft.ts";

export class ShipmentInvalid extends Data.TaggedError("ShipmentInvalid")<{
	readonly message: string;
}> {}

// A positive count can add collection credit. Clearing credit requires removing
// the saved key, so zero is outside this operation's contract.
const shipmentSchema = Schema.Struct({
	farmerId: Schema.String,
	itemId: Schema.String,
	count: Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: 1, maximum: 2147483647 }),
	),
});
const decode = Schema.decodeUnknownResult(shipmentSchema, {
	onExcessProperty: "error",
});

// Limit edits to the vanilla crop shipment achievement lists. Other shipping
// collection entries can still be shown by the existing progress diagnostics.
const cropIds = new Set([
	...requirements.polyculture,
	...requirements.monoculture,
]);

// Project the same eligible crops the command accepts. Missing keys are valid
// starting points, while duplicate entries cannot identify a single target.
export function readCropShipments(farmer: Farmer) {
	const shipments = farmer.basicShipped;
	if (shipments === undefined) return [];
	return catalog.shipping
		.filter((crop) => cropIds.has(crop.id))
		.map((crop) => {
			const entries = shipments.filter((entry) => entry.key === crop.id);
			return {
				...crop,
				count: entries[0]?.value ?? 0,
				ambiguous: entries.length > 1,
			};
		});
}

export const setCropShipment = Effect.fn("Shipments.setCropCount")(function* (
	input: typeof shipmentSchema.Type,
) {
	const decoded = decode({ ...input });
	if (Result.isFailure(decoded))
		return yield* new ShipmentInvalid({
			message: "Choose a valid crop shipment count.",
		});
	const { farmerId, itemId, count } = decoded.success;
	const crop = catalog.shipping.find((item) => item.id === itemId);
	if (!crop || !cropIds.has(itemId))
		return yield* new ShipmentInvalid({
			message: "Choose a supported crop.",
		});

	// Resolve the captured farmer against the queued document so a different
	// selected farmer or duplicated save ID cannot redirect the edit.
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = farmers(snapshot.state.document).filter(
		(farmer) => farmer.UniqueMultiplayerID?.toString() === farmerId,
	);
	const owner = matches[0];
	const shipments = owner?.basicShipped;
	if (matches.length !== 1 || (owner?.name?.trim() ?? "") === "")
		return yield* new ShipmentInvalid({
			message: "Choose a named farmer with an unambiguous saved identifier.",
		});
	if (shipments === undefined)
		return yield* new ShipmentInvalid({
			message: "This farmer has no readable shipment collection.",
		});
	const entries = shipments.filter((entry) => entry.key === itemId);
	if (entries.length > 1)
		return yield* new ShipmentInvalid({
			message: "This crop has duplicate shipment records.",
		});

	// Preserve existing entry metadata and ordering by changing the count in
	// place. New crop records go at the end of the same saved dictionary.
	const entry = entries[0];
	if (entry?.value === count) return;
	if (entry) entry.value = count;
	else shipments.push({ key: itemId, value: count });

	// Review and history receive one operation for the count. Awards and rewards
	// have their own save records and are outside this edit.
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${crop.name} shipped count`,
			emphasis: "standalone",
			tags: ["progress", "progress:shipping", `farmer:${farmerId}`],
		}),
	);
});
