import { resolveInventoryContainer } from "./inventory-containers.ts";
import { Effect, Result, Schema, SchemaIssue } from "effect";
import {
	emptySlot,
	MutationError,
	type ResolvedMutation,
	type SaveDocument,
} from "./domain.ts";

/** UI requests name a session instance, never a position or an arbitrary item record.
 * ownerId is an opaque inventory owner key for a farmer or a placed chest.
 */
export const InventorySlotRequestSchema = Schema.Union([
	Schema.Struct({
		type: Schema.Literal("backpack-add"),
		ownerId: Schema.String,
		entityId: Schema.String,
		catalogId: Schema.String,
	}),
	Schema.Struct({
		type: Schema.Literal("backpack-remove"),
		ownerId: Schema.String,
		entityId: Schema.String,
	}),
]);
export type InventorySlotRequest = typeof InventorySlotRequestSchema.Type;
const decode = Schema.decodeUnknownResult(InventorySlotRequestSchema, {
	onExcessProperty: "error",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
const invalid = (message: string) => Effect.fail(new MutationError(message));

/** Resolve and validate while the history queue owns the current document/identities. */
export const resolveInventorySlotChange = Effect.fn(
	"Backpack.resolveLifecycle",
)(function* (
	document: SaveDocument,
	identities: Record<string, string[]>,
	input: InventorySlotRequest,
) {
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* invalid(
			formatter(decoded.failure.issue).issues[0]?.message ??
				"Choose a valid backpack action.",
		);
	const request = decoded.success;
	const owner = resolveInventoryContainer(document, request.ownerId);
	const ids = Object.hasOwn(identities, request.ownerId)
		? identities[request.ownerId]
		: undefined;
	const items = owner?.slots;
	const slot = ids?.indexOf(request.entityId) ?? -1;
	// Both existing items and empty destinations have handles. Replacements receive
	// new handles, so stale clicks can never remove a replacement or fill another slot.
	if (!Array.isArray(items) || !ids || ids.length !== items.length || slot < 0)
		return yield* invalid("This slot is no longer available in this backpack.");
	if (request.type === "backpack-remove") {
		if (emptySlot(items[slot]))
			return yield* invalid("This slot is already empty.");
		return {
			type: "item-remove",
			ownerId: request.ownerId,
			slot,
			entityId: request.entityId,
		} satisfies ResolvedMutation;
	}
	if (!emptySlot(items[slot]))
		return yield* invalid("This slot is occupied. Choose an empty slot.");
	// Lazy loading keeps catalog construction outside calendar/Farm startup. The
	// catalog ID selects trusted defaults; raw imported records never enter its factory.
	const catalog = yield* Effect.promise(() => import("./item-catalog.ts"));
	const item = catalog.createCatalogItem(request.catalogId);
	if (!item)
		return yield* invalid("This item is not available in the catalog.");
	return {
		type: "item-place",
		ownerId: request.ownerId,
		slot,
		item,
	} satisfies ResolvedMutation;
});
