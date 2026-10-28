import { Effect, Result, Schema, SchemaIssue } from "effect";
import {
	emptySlot,
	MutationError,
	type Mutation,
	type SaveDocument,
} from "./domain.ts";
import {
	backpackFarmers,
	hasBackpackFarmerId,
} from "./inventory-operations.ts";

/** Both ends name session instances, including an empty destination's nil marker. */
export const BackpackMoveRequestSchema = Schema.Struct({
	type: Schema.Literal("backpack-move"),
	farmerId: Schema.String,
	entityId: Schema.String,
	toFarmerId: Schema.String,
	toEntityId: Schema.String,
});
export type BackpackMoveRequest = typeof BackpackMoveRequestSchema.Type;
const decode = Schema.decodeUnknownResult(BackpackMoveRequestSchema, {
	onExcessProperty: "error",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
const invalid = (message: string) => Effect.fail(new MutationError(message));

/** Resolve both current owners under history's lock; no view slot index is trusted. */
export const resolveBackpackMove = Effect.fn("Backpack.resolveMove")(function* (
	document: SaveDocument,
	identities: Record<string, string[]>,
	input: BackpackMoveRequest,
) {
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* invalid(
			formatter(decoded.failure.issue).issues[0]?.message ??
				"Choose a valid backpack destination.",
		);
	const request = decoded.success;
	const all = backpackFarmers(document);
	function endpoint(farmerId: string, entityId: string) {
		const owners = all.filter(
			(farmer) =>
				hasBackpackFarmerId(farmer) &&
				String(farmer.UniqueMultiplayerID) === farmerId,
		);
		const owner = owners.length === 1 ? owners[0] : undefined;
		const ids = Object.hasOwn(identities, farmerId)
			? identities[farmerId]
			: undefined;
		const items = owner?.items?.Item;
		const slot = ids?.indexOf(entityId) ?? -1;
		// Actual serialized slots define capacity. Unsupported arrays/owners cannot
		// gain handles, and neither a transfer nor a swap may grow either backpack.
		if (
			!Array.isArray(items) ||
			!ids ||
			ids.length !== items.length ||
			slot < 0
		)
			return undefined;
		return { slot, item: items[slot] };
	}
	const source = endpoint(request.farmerId, request.entityId);
	const destination = endpoint(request.toFarmerId, request.toEntityId);
	if (!source || !destination)
		return yield* invalid(
			"A selected slot is no longer available in its backpack. Choose the destination again.",
		);
	if (emptySlot(source.item))
		return yield* invalid("Choose an item to move; the source slot is empty.");
	// A swap also handles empty destinations: their exact nil representation moves
	// back to the source. Opaque item records need no metadata or normalization.
	return {
		type: "item-swap",
		farmerId: request.farmerId,
		slot: source.slot,
		toFarmerId: request.toFarmerId,
		toSlot: destination.slot,
	} satisfies Mutation;
});
