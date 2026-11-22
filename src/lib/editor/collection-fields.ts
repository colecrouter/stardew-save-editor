import { Effect } from "effect";

import { bindImmediateField, type ImmediateEditPort } from "./field-binding.ts";
import { setFishCount } from "./fishing-operations.ts";
import { setShipment } from "./shipment-operations.ts";

/** Shared display shape; each operation still owns its saved representation. */
export interface CollectionEntry {
	id: string;
	name: string;
	count: number;
	recorded: boolean;
	reason?: string | undefined;
	size?: number | undefined;
}

export function collectionFields(
	port: ImmediateEditPort,
	farmerId: string,
	kind: "shipping" | "fishing",
	row: CollectionEntry,
) {
	// Bind immutable row snapshots to explicit owner/item IDs. Late queued writes
	// must never follow a different farmer or card selected by the user afterward.
	const { id, name, count, recorded, reason } = row;
	const key = `${kind}:${JSON.stringify([farmerId, id])}`;
	const change = Effect.fn(function* (value: number) {
		if (kind === "shipping")
			return yield* setShipment({ farmerId, itemId: id, count: value });
		return yield* setFishCount({ farmerId, itemId: id, count: value });
	});
	return {
		count: bindImmediateField(
			port,
			{
				key: `${key}:count`,
				label: `${name} ${kind === "shipping" ? "shipped" : "catch"} count`,
				value: count,
				available: reason === undefined,
				reason,
				constraints: { min: 0, max: 2147483647, step: 1 },
			},
			change,
		),
		// Expose membership separately: imported zero-count records still count as
		// collected. Adding membership starts at one; clearing removes the record.
		recorded: bindImmediateField(
			port,
			{
				key: `${key}:recorded`,
				label: `${name} collection credit`,
				value: recorded,
				available: reason === undefined,
			},
			// Use the bound row's count snapshot. Enabling credit keeps a positive
			// count or writes one when the record is missing or has a saved zero.
			(value: boolean) => change(value ? Math.max(1, count) : 0),
		),
	};
}
