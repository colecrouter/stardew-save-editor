import { inventoryQuantity, inventoryQualities } from "./inventory-policy.ts";
import type { Item } from "$types/save";
import {
	replaceInventorySlot,
	resizeInventorySlots,
	type InventoryIdentityState,
} from "./inventory-transition.ts";
import { prizeTicketDestination } from "./quest-ticket.ts";
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
import type { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

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
			Schema.isBetween({
				minimum: inventoryQuantity.min,
				maximum: inventoryQuantity.max,
			}),
		).annotate({ message: "Enter a quantity from 1 to 9999." }),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		entityId: Schema.String,
		property: Schema.Literal("quality"),
		value: Schema.Literals(
			inventoryQualities.map((quality) => quality.value),
		).annotate({
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

/** Domain-owned cache dependencies. Compare committed immutable branches before
 * history detaches snapshots. Farmer identifiers matter because a modded farmer
 * may collide with a chest handle; names and unrelated farmer fields do not.
 * Identity comparison is deliberately conservative across all inventory owners. */
export function sameChestProjectionInputs(
	before: { document: SaveDocument; identities: Record<string, string[]> },
	after: { document: SaveDocument; identities: Record<string, string[]> },
): boolean {
	return (
		before.document.SaveGame.locations === after.document.SaveGame.locations &&
		JSON.stringify(
			backpackFarmers(before.document).map(
				(farmer) => farmer.UniqueMultiplayerID,
			),
		) ===
			JSON.stringify(
				backpackFarmers(after.document).map(
					(farmer) => farmer.UniqueMultiplayerID,
				),
			) &&
		// Ordinary domain edits retain the authoritative identity map. Only an
		// adapter supplying another map needs a structural equality check.
		(before.identities === after.identities ||
			JSON.stringify(before.identities) === JSON.stringify(after.identities))
	);
}

/** History-owned bounded inventory operations; raw draft writes remain untrusted. */
export class BackpackItemEdits extends Context.Service<
	BackpackItemEdits,
	{
		/** Award the fixed quest reward without accepting caller-supplied item data. */
		grantPrizeTicket: (
			farmerId: string,
		) => Effect.Effect<
			"added" | "noRoom",
			BackpackItemInvalid | import("./domain.ts").MutationError
		>;
		resize: (
			farmerId: string,
			size: number,
		) => Effect.Effect<
			boolean,
			BackpackItemInvalid | import("./domain.ts").MutationError
		>;
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
						maxItems: farmer.maxItems,
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
	nextIdentity = 0,
) {
	// Approved field patches, reward replacements and capacity changes authorize
	// inventory writes. Retain the
	// baseline only while this draft is open; replay retains no published save object.
	let authority: SaveDocument | undefined = originalDocument;
	let preparedInventory: InventoryIdentityState = {
		identities,
		equipmentIdentities,
		nextIdentity,
	};
	const writes: {
		farmerId: string;
		location: InventoryLocation;
		patch: Record<string, unknown>;
		replacement?: Record<string, unknown>;
	}[] = [];
	const contexts = new Map<string, string>();
	const resizes: { farmerId: string; size: number }[] = [];
	const ownerIn = resolveInventoryContainer;
	const replay = (document: SaveDocument) => {
		// With no approved writes, compare the original inventory directly. The
		// comparison below still rejects raw unauthorized edits; only replay needs
		// a mutable document, so ordinary field edits need no replay clone.
		if (writes.length === 0 && resizes.length === 0) return document;
		const expected = structuredClone(document);
		for (const write of writes) {
			const farmer = ownerIn(expected, write.farmerId);
			const item =
				typeof write.location === "number"
					? farmer?.slots[write.location]
					: farmer?.farmer?.[write.location];
			if (write.replacement && farmer && typeof write.location === "number")
				farmer.slots[write.location] = structuredClone(write.replacement);
			else if (record(item)) Object.assign(item, structuredClone(write.patch));
		}
		// Capacity changes append canonical empty slots or remove only validated nils.
		// Replay after retained-item patches because shrinking can never remove an item.
		for (const resize of resizes) {
			const owner = ownerIn(expected, resize.farmerId);
			if (owner?.farmer && record(owner.farmer)) {
				owner.slots.length = Math.min(owner.slots.length, resize.size);
				while (owner.slots.length < resize.size)
					owner.slots.push({ "@_xsi:nil": "true" });
				owner.farmer.maxItems = resize.size;
			}
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
		// New slot handles are published only with the enclosing history commit.
		if (
			resizes.length ||
			writes.some(
				(write) =>
					write.replacement &&
					write.farmerId === farmerId &&
					identities[farmerId]?.[Number(write.location)] === entityId,
			)
		)
			return yield* new ItemPropertyInvalid({
				message: "Finish the inventory change before editing this item.",
			});
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
		// Imported XML may contain non-scalar identifiers or a non-text name.
		// Those records have no safe catalog lookup; unexpected catalog exceptions
		// remain defects instead of masquerading as missing metadata.
		const scalarKey = (value: unknown) =>
			value == null || typeof value === "string" || typeof value === "number";
		const supported =
			scalarKey(item.itemId) &&
			scalarKey(item.preservedParentSheetIndex) &&
			(item.name == null || typeof item.name === "string");
		const info = supported
			? catalog.ResolveItemData(item as unknown as Item)
			: undefined;
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
		grantPrizeTicket: Effect.fn("Backpack.grantPrizeTicket")(function* (
			farmerId: string,
		) {
			const snapshot = yield* draft.read;
			const owner = ownerIn(snapshot.state.document, farmerId);
			// This bounded capability authorizes only the fixed reward. Earlier raw
			// draft edits cannot manufacture a stack/slot eligible for replacement.
			if (
				!authority ||
				resizes.length ||
				!owner?.farmer ||
				!identities[farmerId] ||
				identities[farmerId].length !== owner.slots.length ||
				JSON.stringify(backpackInventorySnapshot(snapshot.state.document)) !==
					JSON.stringify(backpackInventorySnapshot(replay(authority)))
			)
				return yield* new BackpackItemInvalid({
					message: "This backpack cannot receive a Prize Ticket safely.",
				});
			const destination = prizeTicketDestination(owner.slots);
			if (!destination) return "noRoom" as const;
			const stackSlot = destination.slot;
			if (destination.kind === "stack") {
				const item = owner.slots[stackSlot];
				if (!record(item) || typeof item.stack !== "number")
					throw new Error("Validated ticket stack disappeared");
				const patch = { stack: item.stack + 1 };
				Object.assign(item, patch);
				yield* draft.replace(snapshot);
				writes.push({ farmerId, location: stackSlot, patch });
				return "added" as const;
			}
			// Even an empty marker can carry opaque mod data. Never discard it to
			// make room for a reward; the journal reports no room explicitly instead.
			const slot = destination.slot;
			const catalog = yield* Effect.promise(() => import("./item-catalog.ts"));
			const item = catalog.createCatalogItem("Prize Ticket");
			if (!item)
				throw new Error("Prize Ticket is missing from the item catalog");
			const paired = yield* Effect.fromResult(
				replaceInventorySlot(owner, slot, item, preparedInventory),
			);
			yield* draft.replace(snapshot);
			preparedInventory = paired;
			writes.push({
				farmerId,
				location: slot,
				patch: {},
				replacement: structuredClone(item),
			});
			return "added" as const;
		}),
		resize: Effect.fn("Backpack.resize")(function* (
			farmerId: string,
			size: number,
		) {
			const snapshot = yield* draft.read;
			const owner = ownerIn(snapshot.state.document, farmerId);
			const valid = [12, 24, 36];
			if (
				!authority ||
				writes.some((write) => write.replacement) ||
				!owner?.farmer ||
				!record(owner.farmer) ||
				!valid.includes(size) ||
				!valid.includes(owner.slots.length) ||
				owner.farmer.maxItems !== owner.slots.length ||
				JSON.stringify(backpackInventorySnapshot(snapshot.state.document)) !==
					JSON.stringify(backpackInventorySnapshot(replay(authority)))
			)
				return yield* new BackpackItemInvalid({
					message:
						"Choose a supported backpack with matching saved capacity and slots.",
				});
			// Even a nil marker can carry mod data. Shrinking discards only the exact
			// canonical empty record, never a broadly 'empty' item with opaque members.
			if (
				owner.slots
					.slice(size)
					.some(
						(slot) =>
							!record(slot) ||
							Object.keys(slot).length !== 1 ||
							String(slot["@_xsi:nil"]) !== "true",
					)
			)
				return yield* new BackpackItemInvalid({
					message:
						"Empty the backpack's last slots before shrinking it; slots with extra saved data must be preserved.",
				});
			if (size === owner.slots.length) return false;
			const paired = yield* Effect.fromResult(
				resizeInventorySlots(owner, size, preparedInventory),
			);
			yield* draft.replace(snapshot);
			preparedInventory = paired;
			resizes.push({ farmerId, size });
			return true;
		}),
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
				[...catalog.CategoriesWithQuality].some(
					(category) => category === item.category,
				),
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
		inventory: () => preparedInventory,
		validate: (document: SaveDocument, baseline: SaveDocument) =>
			contextMatches(document) &&
			JSON.stringify(backpackInventorySnapshot(replay(baseline))) ===
				JSON.stringify(backpackInventorySnapshot(document)),
		close: Effect.sync(() => {
			authority = undefined;
			writes.length = 0;
			resizes.length = 0;
			contexts.clear();
		}),
	};
}
