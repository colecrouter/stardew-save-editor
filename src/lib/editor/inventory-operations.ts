import {
	resolveInventoryContainer,
	inventoryContainers,
} from "./inventory-containers.ts";
import { discoverPlacedChests } from "./chest-storage.ts";
import {
	decodeItemPropertyChange,
	getItemPropertyFields,
	itemColorPatch,
	readItemPropertyContext,
	ItemPropertyInvalid,
	type ItemPropertyChange,
} from "./item-properties.ts";
import {
	prepareTrinketPropertyChange,
	TrinketPropertyChangeSchema,
} from "./trinket-properties.ts";
import type { TrinketRollContext } from "../TrinketStats.ts";
import {
	equipmentSlots,
	equipmentLabels,
	trinketAvailable,
	type EquipmentSlotView,
	type EquipmentIdentities,
	type InventoryLocation,
} from "./equipment.ts";
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
/** Farmer backpacks and placed chests share slots; unsupported owners remain visible without handles. */
export interface BackpackView {
	/** Opaque session owner key: a scalar farmer ID or a namespaced placed-chest path. */
	farmerId: string;
	name: string;
	/** Chest IDs share the request owner namespace; they never denote a farmer. */
	kind?: "chest";
	location?: string;
	capacity?: number;
	supported: boolean;
	reason?: string;
	slots: BackpackSlotView[];
	equipment: EquipmentSlotView[];
	itemContext?: TrinketRollContext;
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
		(item["@_xsi:type"] === "Object" ||
			item["@_xsi:type"] === "ColoredObject") &&
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
	state: Pick<HistoryState, "document" | "identities"> & {
		equipmentIdentities?: EquipmentIdentities;
	},
): BackpackView[] {
	const all = backpackFarmers(state.document);
	const containers = new Map(
		inventoryContainers(state.document).map((owner) => [owner.id, owner]),
	);
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
			unique &&
			containers.get(farmerId)?.kind === "farmer" &&
			Array.isArray(items) &&
			ids?.length === items.length;
		return {
			farmerId,
			itemContext: readItemPropertyContext(state.document, farmer),
			equipment: equipmentSlots.flatMap((key) => {
				const entityId = state.equipmentIdentities?.[farmerId]?.[key];
				if (!entityId) return [];
				const value = farmer[key];
				const raw = record(value) ? structuredClone(value) : undefined;
				return [
					{
						entityId,
						key,
						label: equipmentLabels[key],
						empty: emptySlot(value),
						locked: key === "trinketItem" && !trinketAvailable(farmer),
						name:
							typeof raw?.name === "string" ? raw.name : equipmentLabels[key],
						itemId:
							typeof raw?.itemId === "string" || typeof raw?.itemId === "number"
								? String(raw.itemId)
								: "",
						...(raw ? { raw } : {}),
						...(numeric(raw?.stack) ? { stack: raw.stack } : {}),
						...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
					},
				];
			}),
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
								// Opaque identifiers may contain non-callable conversion members.
								// Only serialized scalar IDs are displayable; preserve others raw.
								itemId:
									typeof raw?.itemId === "string" ||
									typeof raw?.itemId === "number"
										? String(raw.itemId)
										: "",
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

/** Project placed world storage separately so farmer navigation retains its existing meaning. */
export function readChests(
	state: Pick<HistoryState, "document" | "identities">,
): BackpackView[] {
	const containers = new Map(
		inventoryContainers(state.document).map((owner) => [owner.id, owner]),
	);
	return discoverPlacedChests(state.document).map((chest) => {
		const owner = containers.get(chest.id);
		const ids = Object.hasOwn(state.identities, chest.id)
			? state.identities[chest.id]
			: undefined;
		const supported =
			chest.supported &&
			owner?.kind === "chest" &&
			ids?.length === chest.slots.length;
		return {
			farmerId: chest.id,
			name: chest.label,
			kind: "chest",
			location: chest.location,
			capacity: chest.capacity,
			supported,
			equipment: [],
			...(!supported
				? {
						reason:
							chest.reason ?? "This chest's inventory identity is ambiguous.",
					}
				: {}),
			slots:
				supported && ids
					? chest.slots.map((item, slot) => {
							const raw = record(item) ? structuredClone(item) : undefined;
							const empty = emptySlot(item),
								canEdit = editable(item);
							return {
								entityId: ids[slot] ?? "",
								slot,
								empty,
								name: empty
									? "Empty slot"
									: typeof raw?.name === "string"
										? raw.name
										: "Unknown item",
								itemId:
									typeof raw?.itemId === "string" ||
									typeof raw?.itemId === "number"
										? String(raw.itemId)
										: "",
								canStack: canEdit && numeric(raw?.stack),
								canQuality: canEdit && numeric(raw?.quality),
								...(raw ? { raw } : {}),
								...(numeric(raw?.stack) ? { stack: raw.stack } : {}),
								...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
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
		setProperty: (
			change: ItemPropertyChange,
		) => Effect.Effect<
			{ changed: boolean; label: string; tags: readonly string[] },
			ItemPropertyInvalid | import("./domain.ts").MutationError
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

/** Change one supported saved property through the history-owned inventory capability. */
export const setInventoryItemProperty = Effect.fn("Inventory.setProperty")(
	function* (change: ItemPropertyChange) {
		const edits = yield* BackpackItemEdits;
		const result = yield* edits.setProperty(change);
		if (result.changed)
			yield* recordAnnotatedOperation(Effect.void).pipe(
				withReviewMetadata({
					label: result.label,
					emphasis: "standalone",
					tags: result.tags,
				}),
			);
	},
);

/** Inventory authority includes opaque farmer entries and complete item records. */
export function backpackInventorySnapshot(document: SaveDocument) {
	return [
		...farmers(document).map((farmer) =>
			record(farmer)
				? {
						id: farmer.UniqueMultiplayerID,
						items: farmer.items,
						// Field presence matters too: a raw draft cannot eagerly add empty
						// equipment to a save whose corresponding field was absent.
						equipment: Object.fromEntries(
							equipmentSlots
								.filter((key) => Object.hasOwn(farmer, key))
								.map((key) => [key, farmer[key]]),
						),
					}
				: farmer,
		),
		...discoverPlacedChests(document).map((chest) => ({
			chest: chest.id,
			location: chest.location,
			label: chest.label,
			raw: chest.raw,
		})),
	];
}

/** Create per-attempt authorization; history compares its replay with final drafts. */
export function makeBackpackItemEdits(
	draft: typeof TransactionDraft.Service,
	identities: Record<string, string[]>,
	originalDocument: SaveDocument,
	equipmentIdentities: EquipmentIdentities = {},
) {
	// Approved top-level patches are the sole inventory write authority. Retain the
	// baseline only while this draft is open; replay retains no published save object.
	let authority: SaveDocument | undefined = originalDocument;
	const writes: {
		farmerId: string;
		location: InventoryLocation;
		patch: Record<string, unknown>;
	}[] = [];
	const contexts = new Map<string, string>();
	const ownerIn = resolveInventoryContainer;
	const replay = (document: SaveDocument) => {
		const expected = structuredClone(document);
		for (const write of writes) {
			const farmer = ownerIn(expected, write.farmerId);
			const item =
				typeof write.location === "number"
					? farmer?.slots[write.location]
					: farmer?.farmer?.[write.location];
			if (record(item)) Object.assign(item, structuredClone(write.patch));
		}
		return expected;
	};
	// Trinket seeds depend on owner income and the root RNG mode. Record those
	// authoritative reads so later raw draft edits cannot change their meaning.
	const contextMatches = (document: SaveDocument) => {
		for (const [farmerId, context] of contexts) {
			const farmer = ownerIn(document, farmerId);
			if (
				!farmer?.farmer ||
				JSON.stringify(readItemPropertyContext(document, farmer.farmer)) !==
					context
			)
				return false;
		}
		return true;
	};
	const target = Effect.fn("Inventory.authorizedTarget")(function* (
		farmerId: string,
		entityId: string,
	) {
		const snapshot = yield* draft.read;
		// Compare before checking eligibility: temporary raw type/category edits
		// must not authorize a property that the imported item did not support.
		if (
			!authority ||
			JSON.stringify(backpackInventorySnapshot(snapshot.state.document)) !==
				JSON.stringify(backpackInventorySnapshot(replay(authority))) ||
			!contextMatches(snapshot.state.document)
		)
			return yield* new ItemPropertyInvalid({
				message: "Inventory changed outside the supported item operation.",
			});
		const farmer = ownerIn(snapshot.state.document, farmerId);
		const ids = Object.hasOwn(identities, farmerId)
			? identities[farmerId]
			: undefined;
		const items = farmer?.slots;
		if (!farmer || !ids || !Array.isArray(items) || ids.length !== items.length)
			return yield* new ItemPropertyInvalid({
				message: "This item is no longer editable in this inventory.",
			});
		const backpackSlot = ids.indexOf(entityId);
		const equipment = Object.hasOwn(equipmentIdentities, farmerId)
			? equipmentIdentities[farmerId]
			: undefined;
		const location =
			backpackSlot >= 0
				? backpackSlot
				: equipmentSlots.find((key) => equipment?.[key] === entityId);
		const item =
			location === undefined
				? undefined
				: typeof location === "number"
					? items[location]
					: farmer.farmer?.[location];
		if (location === undefined || !record(item) || emptySlot(item))
			return yield* new ItemPropertyInvalid({
				message: "This item is no longer editable in this inventory.",
			});
		return { snapshot, farmer, location, item };
	});
	const metadataFor = Effect.fn("Inventory.metadata")(function* (
		item: Record<string, unknown>,
	) {
		// Catalog data remains lazy; calendar/Farm startup only projects raw records.
		const catalog = yield* Effect.promise(() => import("../ItemData.ts"));
		const info = yield* Effect.try({
			try: () => catalog.ResolveItemData(item as never),
			catch: () =>
				new ItemPropertyInvalid({ message: "Item metadata is unavailable." }),
		}).pipe(Effect.orElseSucceed(() => undefined));
		return { catalog, info };
	});
	const reviewFor = (
		farmerId: string,
		entityId: string,
		farmerName: unknown,
		item: Record<string, unknown>,
		label: string,
		property: string,
	) => ({
		label: `${typeof farmerName === "string" && farmerName ? farmerName : farmerId}: ${typeof item.name === "string" && item.name ? item.name : "Item"} ${label}`,
		tags: [
			"inventory",
			`inventory:${property}`,
			`farmer:${farmerId}`,
			`entity:${entityId}`,
		],
	});
	const apply = Effect.fn("Inventory.authorizePatch")(function* (
		resolved: Effect.Success<ReturnType<typeof target>>,
		farmerId: string,
		patch: Record<string, unknown>,
	) {
		// Skip identical patches before replacing the draft, preserving the redo branch.
		const changed = Object.entries(patch).some(
			([key, value]) =>
				JSON.stringify(resolved.item[key]) !== JSON.stringify(value),
		);
		if (!changed) return false;
		Object.assign(resolved.item, structuredClone(patch));
		yield* draft.replace(resolved.snapshot);
		writes.push({
			farmerId,
			location: resolved.location,
			patch: structuredClone(patch),
		});
		return true;
	});
	const service: typeof BackpackItemEdits.Service = {
		set: Effect.fn("Backpack.stageField")(function* (
			input: BackpackItemChange,
		) {
			const decoded = decodeBackpackItemChange(input);
			if (Result.isFailure(decoded)) return yield* decoded.failure;
			const change = decoded.success;
			const resolved = yield* target(change.farmerId, change.entityId).pipe(
				Effect.mapError((error) =>
					error._tag === "ItemPropertyInvalid"
						? new BackpackItemInvalid({ message: error.message })
						: error,
				),
			);
			const { item, farmer } = resolved;
			// Quantity/quality keep their existing ordinary-object policy and must not
			// become generic fields merely because equipment now shares the resolver.
			if (
				typeof resolved.location !== "number" ||
				!editable(item) ||
				!numeric(item[change.property])
			)
				return yield* new BackpackItemInvalid({
					message: "This item is no longer editable in this backpack.",
				});
			const { catalog, info } = yield* metadataFor(item);
			const capabilities = getBackpackItemCapabilities(
				item,
				info?._type === "Object",
				catalog.CategoriesWithQuality.has(item.category as never),
			);
			if (
				change.property === "stack"
					? !capabilities.canStack
					: !capabilities.canQuality
			)
				return yield* new BackpackItemInvalid({
					message: "This item does not support that edit.",
				});
			const review = reviewFor(
				change.farmerId,
				change.entityId,
				farmer.name,
				item,
				change.property === "stack" ? "quantity" : "quality",
				change.property,
			);
			return {
				changed: yield* apply(resolved, change.farmerId, {
					[change.property]: change.value,
				}),
				...review,
			};
		}),
		setProperty: Effect.fn("Inventory.stageProperty")(function* (
			input: ItemPropertyChange,
		) {
			const decoded = decodeItemPropertyChange(input);
			if (Result.isFailure(decoded)) return yield* decoded.failure;
			const change = decoded.success;
			const resolved = yield* target(change.farmerId, change.entityId);
			const { item, farmer, snapshot } = resolved;
			const { info } = yield* metadataFor(item);
			const context = farmer.farmer
				? readItemPropertyContext(snapshot.state.document, farmer.farmer)
				: undefined;
			const field = getItemPropertyFields(item, info, context).find(
				(field) => field.property === change.property,
			);
			if (!field)
				return yield* new ItemPropertyInvalid({
					message: "This item does not support that property edit.",
				});
			let patch: Record<string, unknown>;
			if (Schema.is(TrinketPropertyChangeSchema)(change)) {
				const originalOwner = authority && ownerIn(authority, change.farmerId);
				const originalContext =
					authority && originalOwner?.farmer
						? readItemPropertyContext(authority, originalOwner.farmer)
						: undefined;
				if (
					!context ||
					!originalContext ||
					JSON.stringify(context) !== JSON.stringify(originalContext)
				)
					return yield* new ItemPropertyInvalid({
						message:
							"Trinket game context changed outside the supported operation.",
					});
				contexts.set(change.farmerId, JSON.stringify(originalContext));
				patch = yield* prepareTrinketPropertyChange(
					item,
					change,
					originalContext,
				).pipe(
					Effect.mapError(
						(error) => new ItemPropertyInvalid({ message: error.message }),
					),
				);
			} else if (
				change.property === "color" ||
				change.property === "clothesColor"
			) {
				const color = itemColorPatch(item[change.property], change.value);
				if (!color)
					return yield* new ItemPropertyInvalid({
						message: "This saved color cannot be edited safely.",
					});
				patch = { [change.property]: color };
			} else if (change.property === "isBottomless") {
				patch = {
					...(Object.hasOwn(item, "isBottomless")
						? { isBottomless: change.value }
						: {}),
					...(Object.hasOwn(item, "IsBottomless")
						? { IsBottomless: change.value }
						: {}),
				};
			} else {
				patch = { [change.property]: change.value };
			}
			const review = reviewFor(
				change.farmerId,
				change.entityId,
				farmer.name,
				item,
				field.label.toLowerCase(),
				change.property,
			);
			return {
				changed: yield* apply(resolved, change.farmerId, patch),
				...review,
			};
		}),
	};
	return {
		service,
		validate: (document: SaveDocument, baseline: SaveDocument) =>
			contextMatches(document) &&
			JSON.stringify(backpackInventorySnapshot(replay(baseline))) ===
				JSON.stringify(backpackInventorySnapshot(document)),
		close: Effect.sync(() => {
			authority = undefined;
			writes.length = 0;
			contexts.clear();
		}),
	};
}
