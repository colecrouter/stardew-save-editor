import { Effect } from "effect";
import {
	InventoryEdits,
	decodeInventoryQualityBatch,
	type InventoryQualityBatch,
} from "./inventory-operations.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export type StorageItemHandle = InventoryQualityBatch["items"][number];
/** One checked capability owns the batch; no item-by-item history/authority replay. */
export const setStorageQuality = Effect.fn("Storage.setQuality")(function* (
	items: readonly StorageItemHandle[],
	quality: number,
) {
	const request = yield* Effect.fromResult(
		decodeInventoryQualityBatch({ items, quality }),
	);
	const edits = yield* InventoryEdits;
	const result = yield* edits.setQualityBatch(request);
	if (result.changed)
		yield* recordAnnotatedOperation(Effect.void).pipe(
			withReviewMetadata({
				label: `Set quality on ${result.changed} stored items`,
				tags: ["storage", "inventory:quality"],
			}),
		);
});
