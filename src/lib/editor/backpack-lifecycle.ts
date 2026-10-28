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

/** UI requests name a session instance, never a position or an arbitrary item record. */
export const BackpackLifecycleRequestSchema = Schema.Union([
	Schema.Struct({
		type: Schema.Literal("backpack-add"),
		farmerId: Schema.String,
		entityId: Schema.String,
		catalogId: Schema.String,
	}),
	Schema.Struct({
		type: Schema.Literal("backpack-remove"),
		farmerId: Schema.String,
		entityId: Schema.String,
	}),
]);
export type BackpackLifecycleRequest =
	typeof BackpackLifecycleRequestSchema.Type;
const decode = Schema.decodeUnknownResult(BackpackLifecycleRequestSchema, {
	onExcessProperty: "error",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
const invalid = (message: string) => Effect.fail(new MutationError(message));

/** Resolve and validate while the history queue owns the current document/identities. */
export const resolveBackpackLifecycle = Effect.fn("Backpack.resolveLifecycle")(
	function* (
		document: SaveDocument,
		identities: Record<string, string[]>,
		input: BackpackLifecycleRequest,
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
		const matches = backpackFarmers(document).filter(
			(farmer) =>
				hasBackpackFarmerId(farmer) &&
				String(farmer.UniqueMultiplayerID) === request.farmerId,
		);
		const ids = Object.hasOwn(identities, request.farmerId)
			? identities[request.farmerId]
			: undefined;
		const farmer = matches.length === 1 ? matches[0] : undefined;
		const items = farmer?.items?.Item;
		const slot = ids?.indexOf(request.entityId) ?? -1;
		// Both existing items and empty destinations have handles. Replacements receive
		// new handles, so stale clicks can never remove a replacement or fill another slot.
		if (
			!Array.isArray(items) ||
			!ids ||
			ids.length !== items.length ||
			slot < 0
		)
			return yield* invalid(
				"This slot is no longer available in this backpack.",
			);
		if (request.type === "backpack-remove") {
			if (emptySlot(items[slot]))
				return yield* invalid("This slot is already empty.");
			return {
				type: "item-remove",
				farmerId: request.farmerId,
				slot,
				entityId: request.entityId,
			} satisfies Mutation;
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
			farmerId: request.farmerId,
			slot,
			item,
		} satisfies Mutation;
	},
);
