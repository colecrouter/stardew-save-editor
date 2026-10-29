import { resolveInventoryContainer } from "./inventory-containers.ts";
import { equipmentSlots, type EquipmentIdentities } from "./equipment.ts";
import { Effect, Result, Schema, SchemaIssue } from "effect";
import {
	emptySlot,
	MutationError,
	type Mutation,
	type SaveDocument,
} from "./domain.ts";

/** Both ends name session instances, including virtual chest empties.
 * farmerId/toFarmerId are opaque inventory owner keys for farmers or placed chests.
 */
export const BackpackMoveRequestSchema = Schema.Struct({
	type: Schema.Literal("backpack-move"),
	farmerId: Schema.String,
	entityId: Schema.String,
	toFarmerId: Schema.String,
	toEntityId: Schema.String,
	fromLocation: Schema.optionalKey(
		Schema.Literals(["backpack", ...equipmentSlots]),
	),
	toLocation: Schema.optionalKey(
		Schema.Literals(["backpack", ...equipmentSlots]),
	),
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
	equipmentIdentities: EquipmentIdentities = {},
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
	function endpoint(farmerId: string, entityId: string) {
		const owner = resolveInventoryContainer(document, farmerId);
		const ids = Object.hasOwn(identities, farmerId)
			? identities[farmerId]
			: undefined;
		const items = owner?.slots;
		const backpackSlot = ids?.indexOf(entityId) ?? -1;
		const equipment = Object.hasOwn(equipmentIdentities, farmerId)
			? equipmentIdentities[farmerId]
			: undefined;
		const equipmentKey = equipmentSlots.find(
			(key) => equipment?.[key] === entityId,
		);
		if (!owner || !Array.isArray(items) || !ids || ids.length !== items.length)
			return undefined;
		const slot = backpackSlot >= 0 ? backpackSlot : equipmentKey;
		if (slot === undefined) return undefined;
		return {
			slot,
			item:
				typeof slot === "number"
					? items[slot]
					: owner.farmer
						? owner.farmer[slot]
						: undefined,
		};
	}
	const source = endpoint(request.farmerId, request.entityId);
	const destination = endpoint(request.toFarmerId, request.toEntityId);
	if (!source || !destination)
		return yield* invalid(
			"A selected slot is no longer available in its backpack. Choose the destination again.",
		);
	// UI drops capture the role of each endpoint as well as the moving identity.
	// A handle moved out of a hat slot must not silently retarget that drop into
	// its new backpack location. Numerical backpack reorders remain valid.
	const location = (slot: typeof source.slot) =>
		typeof slot === "number" ? "backpack" : slot;
	if (
		(request.fromLocation !== undefined &&
			request.fromLocation !== location(source.slot)) ||
		(request.toLocation !== undefined &&
			request.toLocation !== location(destination.slot))
	)
		return yield* invalid(
			"A selected equipment location changed. Choose the destination again.",
		);
	if (emptySlot(source.item))
		return yield* invalid("Choose an item to move; the source slot is empty.");
	// A swap also handles empty destinations: their exact nil representation moves
	// back to the source. Opaque item records need no metadata or normalization.
	if (typeof source.slot === "number" && typeof destination.slot === "number")
		return {
			type: "item-swap",
			farmerId: request.farmerId,
			slot: source.slot,
			toFarmerId: request.toFarmerId,
			toSlot: destination.slot,
		} satisfies Mutation;
	return {
		type: "equipment-swap",
		farmerId: request.farmerId,
		slot: source.slot,
		toFarmerId: request.toFarmerId,
		toSlot: destination.slot,
	} satisfies Mutation;
});
