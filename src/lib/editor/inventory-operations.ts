import { Context, Data, Effect, Result, Schema, SchemaIssue } from "effect";
import { emptySlot, farmers, type SaveDocument } from "./domain.ts";
import type { HistoryState } from "./history.ts";
import type { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/** A detached backpack slot, identified independently of its current position. */
export interface BackpackSlotView {
	entityId: string;
	slot: number;
	name: string;
	itemId: string;
	empty: boolean;
	stack?: number;
	quality?: number;
	canStack: boolean;
	canQuality: boolean;
	raw?: Record<string, unknown>;
}
/** Unsupported or ambiguous backpacks remain visible without editable handles. */
export interface BackpackView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	slots: BackpackSlotView[];
}
/** Expected unsupported, invalid or stale backpack request. */
export class BackpackItemInvalid extends Data.TaggedError(
	"BackpackItemInvalid",
)<{ readonly message: string }> {}
// Each branch owns its value rules, so UI feedback and command enforcement
// cannot disagree about integer quantities or the game's sparse quality values.
export const BackpackItemChangeSchema = Schema.Union([
	Schema.Struct({
		farmerId: Schema.String,
		entityId: Schema.String,
		property: Schema.Literal("stack"),
		value: Schema.Number.check(
			Schema.isInt(),
			Schema.isBetween({ minimum: 1, maximum: 9999 }),
		).annotate({ message: "Enter a quantity from 1 to 9999." }),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		entityId: Schema.String,
		property: Schema.Literal("quality"),
		value: Schema.Literals([0, 1, 2, 4]).annotate({
			message: "Choose a supported item quality.",
		}),
	}),
]);
/** One validated field edit; the schema owns both the shape and sparse value rules. */
export type BackpackItemChange = typeof BackpackItemChangeSchema.Type;
const decodeChange = Schema.decodeUnknownResult(BackpackItemChangeSchema, {
	onExcessProperty: "error",
});
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();
/** Decode own request fields; inherited values never authorize an item write. */
export function decodeBackpackItemChange(
	input: unknown,
): Result.Result<BackpackItemChange, BackpackItemInvalid> {
	const result = decodeChange(
		input !== null && typeof input === "object" && !Array.isArray(input)
			? { ...input }
			: input,
	);
	return Result.isFailure(result)
		? Result.fail(
				new BackpackItemInvalid({
					message:
						formatIssues(result.failure.issue).issues[0]?.message ??
						"Choose valid backpack item settings.",
				}),
			)
		: Result.succeed(result.success);
}

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
// Field presence and serialized type determine editability; catalog guesses must
// never turn opaque modded records, tools or big craftables into ordinary objects.
function editable(item: unknown) {
	return (
		record(item) &&
		!emptySlot(item) &&
		item["@_xsi:type"] === "Object" &&
		item.bigCraftable === false
	);
}
const numeric = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

/** Refine structural eligibility with lazy catalog resolution and category policy.
 * Pass whether ordinary-object metadata resolves and whether the serialized category belongs to
 * CategoriesWithQuality; this keeps the shared policy free of eager catalog data.
 */
export function getBackpackItemCapabilities(
	raw: unknown,
	metadataResolved: boolean,
	qualityCategory: boolean,
) {
	const supported = metadataResolved && editable(raw);
	const item = record(raw) ? raw : undefined;
	return {
		canStack: supported && numeric(item?.stack),
		canQuality: supported && qualityCategory && numeric(item?.quality),
	};
}

/** Inspect only record-shaped farmers; malformed opaque entries stay in the save. */
export function backpackFarmers(document: SaveDocument) {
	return farmers(document).filter(record);
}
/** A session handle requires a real serialized farmer identifier, not 'undefined'. */
export function hasBackpackFarmerId(farmer: unknown): boolean {
	if (!record(farmer)) return false;
	const id = farmer.UniqueMultiplayerID;
	return typeof id === "string"
		? id.length > 0
		: typeof id === "number" && Number.isFinite(id);
}

/** Project supported arrays without normalizing any imported item representation. */
export function readBackpacks(
	state: Pick<HistoryState, "document" | "identities">,
): BackpackView[] {
	const all = backpackFarmers(state.document);
	return all.map((farmer) => {
		const farmerId = hasBackpackFarmerId(farmer)
			? String(farmer.UniqueMultiplayerID)
			: "";
		const unique =
			hasBackpackFarmerId(farmer) &&
			all.filter(
				(other) =>
					hasBackpackFarmerId(other) &&
					String(other.UniqueMultiplayerID) === farmerId,
			).length === 1;
		const items = record(farmer.items) ? farmer.items.Item : undefined;
		const ids = Object.hasOwn(state.identities, farmerId)
			? state.identities[farmerId]
			: undefined;
		const supported =
			unique && Array.isArray(items) && ids?.length === items.length;
		return {
			farmerId,
			name:
				typeof farmer.name === "string" && farmer.name
					? farmer.name
					: "Unnamed farmer",
			supported,
			...(!supported
				? {
						reason: unique
							? "This backpack format is not supported."
							: "Farmer IDs are ambiguous.",
					}
				: {}),
			slots:
				supported && Array.isArray(items) && ids
					? items.map((item, slot) => {
							const raw = record(item) ? structuredClone(item) : undefined;
							const empty = emptySlot(item);
							const canEdit = editable(item);
							return {
								entityId: ids[slot] ?? "",
								slot,
								empty,
								name: empty
									? "Empty slot"
									: typeof raw?.name === "string"
										? raw.name
										: "Unknown item",
								itemId: raw?.itemId === undefined ? "" : String(raw.itemId),
								...(numeric(raw?.stack) ? { stack: raw.stack } : {}),
								...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
								canStack: canEdit && numeric(raw?.stack),
								canQuality: canEdit && numeric(raw?.quality),
								...(raw ? { raw } : {}),
							};
						})
					: [],
		};
	});
}

/** History-owned bounded capability: validates and stages only existing item fields. */
export class BackpackItemEdits extends Context.Service<
	BackpackItemEdits,
	{
		set: (
			change: BackpackItemChange,
		) => Effect.Effect<
			{ changed: boolean; label: string; tags: readonly string[] },
			BackpackItemInvalid | import("./domain.ts").MutationError
		>;
	}
>()("v2/BackpackItemEdits") {}

/** Record an ordinary object quantity/quality edit as one typed, undoable action. */
export const setBackpackItem = Effect.fn("Backpack.setItem")(function* (
	change: BackpackItemChange,
) {
	const edits = yield* BackpackItemEdits;
	// Only an actual change deserves a review annotation; invalid and no-op inputs
	// must neither erase redo nor pretend that the save changed.
	const result = yield* edits.set(change);
	if (result.changed)
		yield* recordAnnotatedOperation(Effect.void).pipe(
			withReviewMetadata({
				label: result.label,
				emphasis: "standalone",
				tags: result.tags,
			}),
		);
});

/** Inventory authority includes opaque farmer entries and complete item records. */
export function backpackInventorySnapshot(document: SaveDocument) {
	return farmers(document).map((farmer) =>
		record(farmer)
			? { id: farmer.UniqueMultiplayerID, items: farmer.items }
			: farmer,
	);
}

/** Create per-attempt authorization; history compares its replay with final drafts. */
export function makeBackpackItemEdits(
	draft: typeof TransactionDraft.Service,
	identities: Record<string, string[]>,
	originalDocument: SaveDocument,
) {
	// Only approved field writes may affect subsequent eligibility checks. Retain
	// authority for this attempt, then clear it when the owning draft closes.
	let authority: SaveDocument | undefined = originalDocument;
	const writes: {
		farmerId: string;
		slot: number;
		property: "stack" | "quality";
		value: number;
	}[] = [];
	const replay = (document: SaveDocument) => {
		const expected = structuredClone(document);
		for (const write of writes) {
			const farmer = backpackFarmers(expected).find(
				(farmer) =>
					hasBackpackFarmerId(farmer) &&
					String(farmer.UniqueMultiplayerID) === write.farmerId,
			);
			const item = farmer?.items.Item[write.slot];
			if (record(item)) item[write.property] = write.value;
		}
		return expected;
	};
	const service: typeof BackpackItemEdits.Service = {
		set: Effect.fn("Backpack.stageField")(function* (
			change: BackpackItemChange,
		) {
			const invalid = (message: string) => new BackpackItemInvalid({ message });
			// Decode before acquiring a snapshot; only validated own fields may drive
			// target resolution, catalog policy, or the eventual authorized write.
			const decoded = decodeBackpackItemChange(change);
			if (Result.isFailure(decoded)) return yield* decoded.failure;
			change = decoded.success;
			const snapshot = yield* draft.read;
			// Eligibility must come from authoritative inventory, not raw draft edits
			// that temporarily manufacture a supported type, ID or quality category.
			// Noninventory changes remain free to compose in the same transaction.
			if (
				!authority ||
				JSON.stringify(backpackInventorySnapshot(snapshot.state.document)) !==
					JSON.stringify(backpackInventorySnapshot(replay(authority)))
			)
				return yield* invalid(
					"Inventory changed outside the supported item operation.",
				);
			const matches = backpackFarmers(snapshot.state.document).filter(
				(farmer) =>
					hasBackpackFarmerId(farmer) &&
					String(farmer.UniqueMultiplayerID) === change.farmerId,
			);
			const ids = Object.hasOwn(identities, change.farmerId)
				? identities[change.farmerId]
				: undefined;
			const slot = ids?.indexOf(change.entityId) ?? -1;
			const farmer = matches.length === 1 ? matches[0] : undefined;
			const items =
				farmer && record(farmer.items) ? farmer.items.Item : undefined;
			const item =
				Array.isArray(items) && ids?.length === items.length && slot >= 0
					? items[slot]
					: undefined;
			if (!editable(item) || !record(item) || !numeric(item[change.property]))
				return yield* invalid(
					"This item is no longer editable in this backpack.",
				);
			// Metadata is loaded only when editing a backpack; calendar/Farm startup
			// never pays for the catalog. Unknown records remain fully preserved.
			const catalog = yield* Effect.promise(() => import("../ItemData.ts"));
			const capabilities = getBackpackItemCapabilities(
				item,
				catalog.ResolveItemData(item as never)?._type === "Object",
				catalog.CategoriesWithQuality.has(item.category as never),
			);
			if (
				change.property === "stack"
					? !capabilities.canStack
					: !capabilities.canQuality
			)
				return yield* invalid("This item does not support that edit.");
			// Describe the resolved owner and instance, so review remains intelligible
			// when a group edits similarly named items across multiple farmers.
			const owner =
				typeof farmer?.name === "string" && farmer.name
					? farmer.name
					: change.farmerId;
			const itemName =
				typeof item.name === "string" && item.name
					? item.name
					: `Slot ${slot + 1}`;
			const review = {
				label: `${owner}: ${itemName} ${change.property === "stack" ? "quantity" : "quality"}`,
				tags: [
					"inventory",
					`inventory:${change.property}`,
					`farmer:${change.farmerId}`,
					`entity:${change.entityId}`,
				],
			};
			if (item[change.property] === change.value)
				return { changed: false, ...review };
			item[change.property] = change.value;
			yield* draft.replace(snapshot);
			writes.push({
				farmerId: change.farmerId,
				slot,
				property: change.property,
				value: change.value,
			});
			return { changed: true, ...review };
		}),
	};
	return {
		service,
		replay,
		close: Effect.sync(() => {
			authority = undefined;
		}),
	};
}
