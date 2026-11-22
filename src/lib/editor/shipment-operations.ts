import { Data, Effect, Result, Schema } from "effect";

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

// Collection credit follows key membership. Zero explicitly removes the key;
// writing a zero-valued entry would incorrectly retain completion credit.
const shipmentSchema = Schema.Struct({
	farmerId: Schema.String,
	itemId: Schema.String,
	count: Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: 0, maximum: 2147483647 }),
	),
});
const decode = Schema.decodeUnknownResult(shipmentSchema, {
	onExcessProperty: "error",
});

// Project the same vanilla collection items the command accepts. Missing keys are valid
// starting points, while duplicate entries cannot identify a single target.
export function readShipments(farmer: Farmer) {
	const shipments = farmer.basicShipped;
	if (shipments === undefined) return [];
	return catalog.shipping.map((item) => {
		const entries = shipments.filter((entry) => entry.key === item.id);
		return {
			...item,
			count: entries[0]?.value ?? 0,
			recorded: entries.length > 0,
			ambiguous: entries.length > 1,
		};
	});
}

/** Keep every non-collection record visible without widening the command's
 * supported catalog. Preserve order and duplicates: this is inspection only. */
export function readOtherShipments(farmer: Farmer) {
	const collectionIds = new Set(catalog.shipping.map((item) => item.id));
	return (farmer.basicShipped ?? [])
		.filter((entry) => !collectionIds.has(entry.key))
		.map((entry) => ({ id: entry.key, count: entry.value }));
}

export const setShipment = Effect.fn("Shipments.setCount")(function* (
	input: typeof shipmentSchema.Type,
) {
	const decoded = decode({ ...input });
	if (Result.isFailure(decoded))
		return yield* new ShipmentInvalid({
			message: "Choose a valid shipment count.",
		});
	const { farmerId, itemId, count } = decoded.success;
	const item = catalog.shipping.find((candidate) => candidate.id === itemId);
	if (!item)
		return yield* new ShipmentInvalid({
			message: "Choose a supported shipping item.",
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
			message: "This item has duplicate shipment records.",
		});

	// Preserve existing entry metadata and ordering by changing the count in
	// place. New item records go at the end of the same saved dictionary.
	const entry = entries[0];
	if (count === 0) {
		// Removal affects only this exact vanilla key, preserving unrelated entries.
		if (!entry) return;
		shipments.splice(shipments.indexOf(entry), 1);
	} else {
		if (entry?.value === count) return;
		if (entry) entry.value = count;
		else shipments.push({ key: itemId, value: count });
	}

	// Review and history receive one operation for the count. Awards and rewards
	// have their own save records and are outside this edit.
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${item.name} shipped count`,
			emphasis: "standalone",
			tags: ["progress", "progress:shipping", `farmer:${farmerId}`],
		}),
	);
});
