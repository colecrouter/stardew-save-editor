import { Context, Data, Effect, Result, Schema, SchemaIssue } from "effect";
import { create as createCopyOnWrite } from "mutative";

import type * as ItemCatalog from "../ItemData.ts";
import { type UnplacedItem } from "./animal-buildings.ts";
import {
	type BuildingInvalid,
	type replayBuildingUpgrade,
} from "./building-operations.ts";
import { discoverPlacedChests } from "./chest-storage.ts";
import {
	emptySlot,
	type Farmer,
	farmers,
	type Item,
	type MutationError,
	type SaveDocument,
} from "./domain.ts";
import { freezeDraftState } from "./draft-state.ts";
import {
	type EquipmentIdentities,
	equipmentSlots,
	type InventoryLocation,
	readEquipmentSlot,
} from "./equipment.ts";
import {
	type FarmerRosterInvalid,
	type replayFarmerSwap,
} from "./farmer-roster-operations.ts";
import {
	inventoryContainers,
	resolveInventoryContainer,
} from "./inventory-containers.ts";
import { inventoryQualities, inventoryQuantity } from "./inventory-policy.ts";
import {
	type InventoryIdentityState,
	replaceInventorySlot,
	resizeInventorySlots,
} from "./inventory-transition.ts";
import {
	type InventoryValue,
	isKnownItem,
	type KnownItem,
} from "./inventory-values.ts";
import {
	decodeItemPropertyChange,
	getItemPropertyFields,
	itemColorPatch,
	type ItemPatch,
	type ItemPropertyChange,
	ItemPropertyInvalid,
	readItemPropertyContext,
} from "./item-properties.ts";
import { samePlainData } from "./plain-data.ts";
import { prizeTicketDestination } from "./quest-ticket.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { type makeTransactionDraftFromCommitted } from "./transaction-draft.ts";
import {
	prepareTrinketPropertyChange,
	TrinketPropertyChangeSchema,
} from "./trinket-properties.ts";

/** Expected unsupported, invalid or stale backpack request. */
export class BackpackItemInvalid extends Data.TaggedError(
	"BackpackItemInvalid",
)<{ readonly message: string }> {}
// Each branch owns its value rules, so UI feedback and command enforcement
// cannot disagree about integer quantities or the game's sparse quality values.
export const InventoryItemChangeSchema = Schema.Union([
	Schema.Struct({
		ownerId: Schema.String,
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
		ownerId: Schema.String,
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
export type InventoryItemChange = typeof InventoryItemChangeSchema.Type;
const decodeChange = Schema.decodeUnknownResult(InventoryItemChangeSchema, {
	onExcessProperty: "error",
});
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();
/** Decode own request fields; inherited values never authorize an item write. */
export function decodeInventoryItemChange(
	input: unknown,
): Result.Result<InventoryItemChange, BackpackItemInvalid> {
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

/** Captured instance handles for one checked batch; sparse quality rules share the single-item policy. */
export const InventoryQualityBatchSchema = Schema.Struct({
	items: Schema.Array(
		Schema.Struct({ ownerId: Schema.String, entityId: Schema.String }),
	),
	quality: Schema.Literals(inventoryQualities.map((quality) => quality.value)),
});
export type InventoryQualityBatch = typeof InventoryQualityBatchSchema.Type;
const decodeQualityBatch = Schema.decodeUnknownResult(
	InventoryQualityBatchSchema,
	{ onExcessProperty: "error" },
);
/** Every nested handle must provide its own fields, just like a single-item request. */
export function decodeInventoryQualityBatch(
	input: unknown,
): Result.Result<InventoryQualityBatch, BackpackItemInvalid> {
	const own =
		input !== null && typeof input === "object" && !Array.isArray(input)
			? { ...input }
			: input;
	if (record(own) && Array.isArray(own["items"]))
		own["items"] = own["items"].map((item) =>
			record(item) ? { ...item } : item,
		);
	const result = decodeQualityBatch(own);
	return Result.isFailure(result)
		? Result.fail(
				new BackpackItemInvalid({
					message: "Choose supported items and a valid quality.",
				}),
			)
		: Result.succeed(result.success);
}

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
// Field presence and serialized type determine editability; catalog guesses must
// never turn opaque modded records, tools or big craftables into ordinary objects.
function editable(item: InventoryValue): item is Extract<
	KnownItem,
	{
		readonly $type:
			| "StardewValley.Object"
			| "StardewValley.Objects.ColoredObject";
	}
> {
	return (
		isKnownItem(item) &&
		(item.$type === "StardewValley.Object" ||
			item.$type === "StardewValley.Objects.ColoredObject") &&
		item.bigCraftable === false
	);
}
const numeric = (value: number | undefined): value is number =>
	value !== undefined && Number.isFinite(value);

/** Whether catalog metadata permits ordinary-object edits. A catalog entry must say Object, but an
 * item the catalog has never heard of (modded content) stays editable as long as its saved
 * identity is readable; malformed identities remain unavailable.
 * Tools, big craftables and other non-Object records stay read-only because `editable` checks the
 * saved type and `bigCraftable` separately. A mod that saves something tool-like as a plain
 * Object is indistinguishable from any other unknown Object; only its `stack` number changes.
 */
export function objectMetadataAllowsEdits(
	raw: unknown,
	info: { _type?: string } | undefined,
): boolean {
	if (info) return info._type === "Object";
	const scalarKey = (value: unknown) =>
		value == null || typeof value === "string" || typeof value === "number";
	return (
		record(raw) &&
		scalarKey(raw["itemId"]) &&
		scalarKey(raw["preservedParentSheetIndex"]) &&
		(raw["name"] == null || typeof raw["name"] === "string")
	);
}

/** Refine structural eligibility with lazy catalog resolution and category policy.
 * Pass whether ordinary-object metadata resolves and whether the serialized category belongs to
 * CategoriesWithQuality; this keeps the shared policy free of eager catalog data.
 */
export function getInventoryItemCapabilities(
	item: InventoryValue,
	metadataResolved: boolean,
	qualityCategory: boolean,
) {
	const supported = metadataResolved && editable(item);
	const newItem = editable(item) ? item : undefined;
	return {
		canStack: supported && numeric(newItem?.stack),
		canQuality: supported && qualityCategory && numeric(newItem?.quality),
	};
}

/** The generated farmer collection already excludes nil slots. */
export function backpackFarmers(document: SaveDocument) {
	return farmers(document);
}
/** A session handle requires a real serialized farmer identifier, not 'undefined'. */
export function hasBackpackFarmerId(farmer: Farmer): boolean {
	return farmer.UniqueMultiplayerID !== undefined;
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
		samePlainData(
			backpackFarmers(before.document).map(
				(farmer) => farmer.UniqueMultiplayerID,
			),
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
export class InventoryEdits extends Context.Service<
	InventoryEdits,
	{
		/** Reassign whole farmers while their inventory/equipment handles keep the same owner IDs. */
		swapFarmers: (
			sourceId: string,
			targetId: string,
		) => Effect.Effect<void, FarmerRosterInvalid | MutationError>;

		/** Building transitions can relocate placed storage; this capability owns those paired handles. */
		upgradeBuilding: (
			buildingId: string,
			target: string,
		) => Effect.Effect<UnplacedItem[], BuildingInvalid | MutationError>;

		/** Award the fixed quest reward without accepting caller-supplied item data. */
		grantPrizeTicket: (
			farmerId: string,
		) => Effect.Effect<"added" | "noRoom", BackpackItemInvalid | MutationError>;
		resize: (
			farmerId: string,
			size: number,
		) => Effect.Effect<boolean, BackpackItemInvalid | MutationError>;
		/** Resolve and authorize one captured quality batch before a single staging write. */
		setQualityBatch: (
			request: InventoryQualityBatch,
		) => Effect.Effect<
			{ readonly changed: number },
			BackpackItemInvalid | MutationError
		>;

		set: (
			change: InventoryItemChange,
		) => Effect.Effect<
			{ changed: boolean; label: string; tags: readonly string[] },
			BackpackItemInvalid | MutationError
		>;
		setProperty: (
			change: ItemPropertyChange,
		) => Effect.Effect<
			{ changed: boolean; label: string; tags: readonly string[] },
			ItemPropertyInvalid | MutationError
		>;
	}
>()("v2/InventoryEdits") {}

/** Record an ordinary object quantity/quality edit as one typed, undoable action. */
export const setInventoryItem = Effect.fn("Backpack.setItem")(function* (
	change: InventoryItemChange,
) {
	const edits = yield* InventoryEdits;
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
		const edits = yield* InventoryEdits;
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

/** Inventory authority retains complete farmer equipment and item records, including opaque item subclasses. */
export function inventorySnapshot(document: SaveDocument) {
	return [
		...farmers(document).map((farmer) => ({
			id: farmer.UniqueMultiplayerID,
			items: farmer.items,
			maxItems: farmer.maxItems,
			// Field presence matters: unauthorized drafts cannot materialize equipment.
			equipment: Object.fromEntries(
				equipmentSlots
					.filter((key) => Object.hasOwn(farmer, key))
					.map((key) => [key, farmer[key]]),
			),
		})),
		...discoverPlacedChests(document).map((chest) => ({
			chest: chest.id,
			location: chest.location,
			label: chest.label,
			container: chest.container,
		})),
	];
}

/** Create per-attempt authorization; history compares its replay with final drafts.
 * History supplies a stable, privately owned originalDocument: replay may deeply
 * freeze that baseline. Public/caller-owned documents must be detached first. */
export function makeInventoryEdits(
	draftOwner: Pick<
		ReturnType<typeof makeTransactionDraftFromCommitted>,
		"service" | "inspect"
	>,
	identities: Record<string, string[]>,
	originalDocument: SaveDocument,
	equipmentIdentities: EquipmentIdentities = {},
	nextIdentity = 0,
) {
	const draft = draftOwner.service;
	// Approved field patches, reward replacements and capacity changes authorize
	// inventory writes. Retain the
	// baseline only while this draft is open; replay retains no published save object.
	let authority: SaveDocument | undefined = originalDocument;
	let preparedInventory = {
		identities,
		equipmentIdentities,
		nextIdentity,
	} satisfies InventoryIdentityState;
	const writes: {
		ownerId: string;
		location: InventoryLocation;
		patch: ItemPatch;
		replacement?: Item;
	}[] = [];
	const contexts = new Map<string, string>();
	const resizes: { farmerId: string; size: number }[] = [];
	// Replay in operation order: an upgrade can change a chest path before a later
	// item edit. Grouping writes by kind would silently replay against the old owner.
	const replaySteps: (
		| {
				kind: "farmer-swap";
				sourceId: string;
				targetId: string;
				apply: typeof replayFarmerSwap;
		  }
		| { kind: "write"; write: (typeof writes)[number] }
		| { kind: "quality-batch"; writes: readonly (typeof writes)[number][] }
		| { kind: "resize"; resize: (typeof resizes)[number] }
		| {
				kind: "upgrade";
				buildingId: string;
				target: string;
				apply: typeof replayBuildingUpgrade;
		  }
	)[] = [];
	const recordWrite = (write: (typeof writes)[number]) => {
		writes.push(write);
		replaySteps.push({ kind: "write", write });
	};
	const recordResize = (resize: (typeof resizes)[number]) => {
		resizes.push(resize);
		replaySteps.push({ kind: "resize", resize });
	};

	const ownerIn = resolveInventoryContainer;
	const replay = (document: SaveDocument) => {
		// With no approved writes, compare the original inventory directly. The
		// comparison below still rejects raw unauthorized edits; only replay needs
		// a mutable document, so ordinary field edits need no replay clone.
		if (replaySteps.length === 0) return document;
		// Replay only approved mutations, preserving baseline branches that the
		// operation never touched. Global inventory comparisons remain authoritative.
		const applyApproved = (expected: SaveDocument) => {
			for (const step of replaySteps) {
				if (step.kind === "farmer-swap") {
					step.apply(expected, step.sourceId, step.targetId);
				} else if (step.kind === "upgrade") {
					step.apply(expected, step.buildingId, step.target);
				} else if (step.kind === "quality-batch") {
					const owners = new Map(
						inventoryContainers(expected).map((owner) => [owner.id, owner]),
					);
					for (const write of step.writes) {
						const owner = owners.get(write.ownerId);
						const item =
							typeof write.location === "number"
								? owner?.slots[write.location]
								: readEquipmentSlot(owner?.farmer, write.location);
						if (!isKnownItem(item))
							throw new Error(
								"Approved quality batch item disappeared during replay",
							);
						Object.assign(item, write.patch);
					}
				} else if (step.kind === "write") {
					const write = step.write,
						owner = ownerIn(expected, write.ownerId);
					const item =
						typeof write.location === "number"
							? owner?.slots[write.location]
							: readEquipmentSlot(owner?.farmer, write.location);
					if (write.replacement && owner && typeof write.location === "number")
						owner.slots[write.location] = structuredClone(write.replacement);
					else if (isKnownItem(item))
						Object.assign(item, structuredClone(write.patch));
				} else {
					const resize = step.resize,
						owner = ownerIn(expected, resize.farmerId);
					// Capacity replay follows its original place in the transaction journal.
					if (owner?.farmer) {
						owner.slots.length = Math.min(owner.slots.length, resize.size);
						while (owner.slots.length < resize.size) owner.slots.push(null);
						owner.farmer.maxItems = resize.size;
					}
				}
			}
		};
		// Producers assume a tree. Classify the complete owned save so aliases
		// crossing inventory and unrelated fields keep detached replay semantics.
		if (freezeDraftState({ document, history: [] })) {
			// Avoid expanding the raw DTO's recursive unions in Mutative's mapped
			// types. The producer preserves this SaveDocument root representation.
			const base: object = document;
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This producer changes approved inventory fields on a SaveDocument root and never replaces its envelope.
			return createCopyOnWrite(
				base,
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Mutative exposes an object writer for the supplied SaveDocument; the recipe preserves that root shape.
				(writer) => applyApproved(writer as SaveDocument),
				{
					enableAutoFreeze: false,
				},
			) as SaveDocument;
		}
		const expected = structuredClone(document);
		applyApproved(expected);
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
	const authorityMatches = (document: SaveDocument) =>
		authority !== undefined &&
		samePlainData(
			inventorySnapshot(document),
			inventorySnapshot(replay(authority)),
		) &&
		contextMatches(document);
	const resolveTarget = (
		document: SaveDocument,
		ownerId: string,
		entityId: string,
		owners?: ReadonlyMap<
			string,
			ReturnType<typeof inventoryContainers>[number]
		>,
		positions?: ReadonlyMap<string, ReadonlyMap<string, number>>,
		blocked?: ReadonlySet<string>,
	) => {
		// New slot handles are published only with the enclosing history commit.
		if (
			resizes.length > 0 ||
			(blocked
				? blocked.has(entityId)
				: writes.some(
						(write) =>
							write.replacement !== undefined &&
							write.ownerId === ownerId &&
							identities[ownerId]?.[Number(write.location)] === entityId,
					))
		)
			return Result.fail(
				new ItemPropertyInvalid({
					message: "Finish the inventory change before editing this item.",
				}),
			);
		const owner = owners?.get(ownerId) ?? ownerIn(document, ownerId);
		const ids = Object.hasOwn(identities, ownerId)
			? identities[ownerId]
			: undefined;
		const items = owner?.slots;
		if (!owner || !ids || items === undefined || ids.length !== items.length)
			return Result.fail(
				new ItemPropertyInvalid({
					message: "This item is no longer editable in this inventory.",
				}),
			);
		const backpackSlot = positions
			? (positions.get(ownerId)?.get(entityId) ?? -1)
			: ids.indexOf(entityId);
		const equipment = Object.hasOwn(equipmentIdentities, ownerId)
			? equipmentIdentities[ownerId]
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
					: readEquipmentSlot(owner.farmer, location);
		if (location === undefined || !isKnownItem(item) || emptySlot(item))
			return Result.fail(
				new ItemPropertyInvalid({
					message: "This item is no longer editable in this inventory.",
				}),
			);
		return Result.succeed({
			location,
			item,
			ownerName: owner.name,
			context: owner.farmer
				? readItemPropertyContext(document, owner.farmer)
				: undefined,
		});
	};
	const target = Effect.fn("Inventory.authorizedTarget")(function* (
		ownerId: string,
		entityId: string,
	) {
		const snapshot = yield* draftOwner.inspect;
		// Raw type/category edits never grant eligibility, even if later reverted.
		if (!authorityMatches(snapshot.state.document))
			return yield* new ItemPropertyInvalid({
				message: "Inventory changed outside the supported item operation.",
			});
		const resolved = yield* Effect.fromResult(
			resolveTarget(snapshot.state.document, ownerId, entityId),
		);
		// Fallible metadata preparation receives a detached item and scalar context,
		// never the borrowed authoritative record or the complete engine snapshot.
		return {
			...resolved,
			version: snapshot.version,
			item: structuredClone(resolved.item),
		};
	});
	const qualityCheckout = Effect.fn("Inventory.authorizedQualityBatch")(
		function* (items: InventoryQualityBatch["items"]) {
			const snapshot = yield* draftOwner.inspect;
			if (!authorityMatches(snapshot.state.document))
				return yield* new BackpackItemInvalid({
					message: "Inventory changed outside the supported item operation.",
				});
			// One owner traversal and one identity index per owner address the complete
			// captured set before metadata work can yield or another draft version appears.
			const owners = new Map(
				inventoryContainers(snapshot.state.document).map((owner) => [
					owner.id,
					owner,
				]),
			);
			const positions = new Map<string, ReadonlyMap<string, number>>();
			for (const ownerId of new Set(items.map((item) => item.ownerId))) {
				const ids = Object.hasOwn(identities, ownerId)
					? identities[ownerId]
					: undefined;
				positions.set(
					ownerId,
					new Map(ids?.map((id, index) => [id, index]) ?? []),
				);
			}
			const blocked = new Set(
				writes.flatMap((write) => {
					const id = write.replacement
						? identities[write.ownerId]?.[Number(write.location)]
						: undefined;
					return id === undefined ? [] : [id];
				}),
			);

			const resolved = [];
			for (const handle of items) {
				const result = resolveTarget(
					snapshot.state.document,
					handle.ownerId,
					handle.entityId,
					owners,
					positions,
					blocked,
				);
				if (Result.isFailure(result))
					return yield* new BackpackItemInvalid({
						message: result.failure.message,
					});
				if (typeof result.success.location !== "number")
					return yield* new BackpackItemInvalid({
						message: "Equipment does not support quality edits.",
					});
				resolved.push({
					ownerId: handle.ownerId,
					location: result.success.location,
					item: structuredClone(result.success.item),
				});
			}
			return { version: snapshot.version, items: resolved };
		},
	);

	const metadataFrom = (catalog: typeof ItemCatalog, item: KnownItem) => {
		// A checked target retains its generated fields. Catalog resolution is lazy,
		// but does not need to revalidate the decoded item's scalar representation.
		return { catalog, info: catalog.ResolveItemData(item) };
	};
	const metadataFor = Effect.fn("Inventory.metadata")(function* (
		item: KnownItem,
	) {
		// Catalog data remains lazy; calendar/Farm startup only projects raw records.
		const catalog = yield* Effect.promise(() => import("../ItemData.ts"));
		return metadataFrom(catalog, item);
	});

	const reviewFor = (
		ownerId: string,
		entityId: string,
		ownerName: string | undefined,
		item: KnownItem,
		label: string,
		property: string,
	) => ({
		label: `${typeof ownerName === "string" && ownerName !== "" ? ownerName : ownerId}: ${typeof item.name === "string" && item.name !== "" ? item.name : "Item"} ${label}`,
		tags: [
			"inventory",
			`inventory:${property}`,
			// Preserve the existing review tag vocabulary, including for chest owners.
			`farmer:${ownerId}`,
			`entity:${entityId}`,
		],
	});
	const apply = Effect.fn("Inventory.authorizePatch")(function* (
		resolved: Effect.Success<ReturnType<typeof target>>,
		ownerId: string,
		patch: ItemPatch,
	) {
		// A no-op still validates its checkout version, but produces no patch or
		// history entry. A concurrent edit must never be hidden by the no-op path.
		const changed = Object.entries(patch).some(
			([key, value]) => !samePlainData(resolved.item[key], value),
		);
		yield* draft.mutate((state) => {
			if (!changed) return;
			// The version guard runs before this callback. Re-resolving the fixed
			// location therefore addresses the exact item checked before metadata.
			// Equipment access also unwraps the single trinket from its saved list.
			const currentOwner = ownerIn(state.document, ownerId);
			const item =
				typeof resolved.location === "number"
					? currentOwner?.slots[resolved.location]
					: readEquipmentSlot(currentOwner?.farmer, resolved.location);
			if (!isKnownItem(item))
				throw new Error("Authorized inventory item disappeared");
			Object.assign(item, patch);
		}, resolved.version);
		if (!changed) return false;
		recordWrite({
			ownerId,
			location: resolved.location,
			patch: structuredClone(patch),
		});
		return true;
	});
	const service = {
		swapFarmers: Effect.fn("Inventory.swapFarmers")(function* (
			sourceId: string,
			targetId: string,
		) {
			const operations = yield* Effect.promise(
				() => import("./farmer-roster-operations.ts"),
			);
			const snapshot = yield* draft.read;
			if (
				!authority ||
				!samePlainData(
					inventorySnapshot(snapshot.state.document),
					inventorySnapshot(replay(authority)),
				) ||
				!contextMatches(snapshot.state.document)
			)
				return yield* new operations.FarmerRosterInvalid({
					message: "Inventory changed outside a supported operation.",
				});
			yield* Effect.fromResult(
				operations.applyFarmerSwap(snapshot.state.document, sourceId, targetId),
			);
			// Farmer identities and their paired slots travel with the whole record.
			// Only the serialized host/farmhand order changes; allocate no new handles.
			yield* draft.replace(snapshot);
			replaySteps.push({
				kind: "farmer-swap",
				sourceId,
				targetId,
				apply: operations.replayFarmerSwap,
			});
		}),

		upgradeBuilding: Effect.fn("Inventory.upgradeBuilding")(function* (
			buildingId: string,
			targetCandidate: string,
		) {
			const operations = yield* Effect.promise(
				() => import("./building-operations.ts"),
			);
			const snapshot = yield* draft.read;
			if (
				!authority ||
				!samePlainData(
					inventorySnapshot(snapshot.state.document),
					inventorySnapshot(replay(authority)),
				) ||
				!contextMatches(snapshot.state.document)
			)
				return yield* new operations.BuildingInvalid({
					message: "Inventory changed outside a supported operation.",
				});
			// Discover before mutation on the same private snapshot: raw chest identity
			// survives tile movement and object-array compaction even when its path changes.
			const before = discoverPlacedChests(snapshot.state.document);
			const handles = new Map(
				before.map((chest) => [
					chest.container,
					preparedInventory.identities[chest.id],
				]),
			);
			// Distinct owner paths need distinct lifetime arrays. A shared raw
			// chest would collapse this reassociation; preserve the save by rejecting it.
			if (handles.size !== before.length)
				return yield* new operations.BuildingInvalid({
					message:
						"Shared storage references cannot be moved by a building upgrade.",
				});

			const warnings = yield* operations.prepareBuildingUpgrade(
				snapshot.state.document,
				buildingId,
				targetCandidate,
			);
			const after = discoverPlacedChests(snapshot.state.document);
			const nextIds = { ...preparedInventory.identities };
			for (const chest of before) delete nextIds[chest.id];
			for (const chest of after) {
				const ids = handles.get(chest.container);
				if (ids) nextIds[chest.id] = [...ids];
			}
			// No new/removed storage records are expected from a supported tier change.
			// Reject a collision or lost record rather than reallocating live item identities.
			if (
				after.length !== before.length ||
				after.some((chest) => !handles.has(chest.container)) ||
				after.some(
					(chest) =>
						handles.has(chest.container) &&
						!inventoryContainers(snapshot.state.document).some(
							(owner) => owner.id === chest.id,
						),
				)
			)
				return yield* new operations.BuildingInvalid({
					message: "This upgrade cannot preserve the placed storage handles.",
				});
			yield* draft.replace(snapshot);
			identities = nextIds;
			preparedInventory = { ...preparedInventory, identities: nextIds };
			replaySteps.push({
				kind: "upgrade",
				buildingId,
				target: targetCandidate,
				apply: operations.replayBuildingUpgrade,
			});
			return warnings;
		}),

		grantPrizeTicket: Effect.fn("Backpack.grantPrizeTicket")(function* (
			farmerId: string,
		) {
			const snapshot = yield* draft.read;
			const owner = ownerIn(snapshot.state.document, farmerId);
			// This bounded capability authorizes only the fixed reward. Earlier raw
			// draft edits cannot manufacture a stack/slot eligible for replacement.
			if (
				!authority ||
				resizes.length > 0 ||
				!owner?.farmer ||
				!identities[farmerId] ||
				identities[farmerId].length !== owner.slots.length ||
				!samePlainData(
					inventorySnapshot(snapshot.state.document),
					inventorySnapshot(replay(authority)),
				)
			)
				return yield* new BackpackItemInvalid({
					message: "This backpack cannot receive a Prize Ticket safely.",
				});
			const destination = prizeTicketDestination(owner.slots);
			if (!destination) return "noRoom" as const;
			const stackSlot = destination.slot;
			if (destination.kind === "stack") {
				const item = owner.slots[stackSlot];
				if (!isKnownItem(item) || typeof item.stack !== "number")
					throw new Error("Validated ticket stack disappeared");
				const patch = { stack: item.stack + 1 };
				Object.assign(item, patch);
				yield* draft.replace(snapshot);
				recordWrite({ ownerId: farmerId, location: stackSlot, patch });
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
			recordWrite({
				ownerId: farmerId,
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
			const valid = new Set([12, 24, 36]);
			if (
				!authority ||
				writes.some((write) => write.replacement) ||
				!owner?.farmer ||
				!valid.has(size) ||
				!valid.has(owner.slots.length) ||
				owner.farmer.maxItems !== owner.slots.length ||
				!samePlainData(
					inventorySnapshot(snapshot.state.document),
					inventorySnapshot(replay(authority)),
				)
			)
				return yield* new BackpackItemInvalid({
					message:
						"Choose a supported backpack with matching saved capacity and slots.",
				});
			// Only null slots can be discarded. Every object, including an unfamiliar
			// item, retains its position until the user explicitly moves or removes it.
			if (owner.slots.slice(size).some((slot) => slot !== null))
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
			recordResize({ farmerId, size });
			return true;
		}),
		setQualityBatch: Effect.fn("Inventory.stageQualityBatch")(function* (
			input: InventoryQualityBatch,
		) {
			const request = yield* Effect.fromResult(
				decodeInventoryQualityBatch(input),
			);
			if (
				!(request.items.length > 0) ||
				new Set(request.items.map((item) => item.entityId)).size !==
					request.items.length
			)
				return yield* new BackpackItemInvalid({
					message: "Choose a nonempty set of unique item handles.",
				});
			const checkout = yield* qualityCheckout(request.items);
			const approved: (typeof writes)[number][] = [];
			const catalog = yield* Effect.promise(() => import("../ItemData.ts"));
			for (const selected of checkout.items) {
				const item = selected.item;
				if (!editable(item) || !numeric(item.quality))
					return yield* new BackpackItemInvalid({
						message: "This item is no longer quality-editable.",
					});
				const category = item.category,
					savedQuality = item.quality;
				const { info } = metadataFrom(catalog, item);
				if (
					!getInventoryItemCapabilities(
						item,
						objectMetadataAllowsEdits(item, info),
						[...catalog.CategoriesWithQuality].some(
							(value) => value === category,
						),
					).canQuality
				)
					return yield* new BackpackItemInvalid({
						message: "This item does not support quality edits.",
					});
				if (savedQuality !== request.quality)
					approved.push({
						ownerId: selected.ownerId,
						location: selected.location,
						patch: { quality: request.quality },
					});
			}
			// All handles and capabilities are checked before this single mutation.
			// Validate the checkout version even for a no-op; stale metadata must never
			// silently succeed after another program changed the same transaction draft.
			yield* draft.mutate((state) => {
				if (!(approved.length > 0)) return;
				const owners = new Map(
					inventoryContainers(state.document).map((owner) => [owner.id, owner]),
				);
				for (const write of approved) {
					const item =
						typeof write.location === "number"
							? owners.get(write.ownerId)?.slots[write.location]
							: undefined;
					if (!isKnownItem(item))
						throw new Error("Authorized quality batch item disappeared");
					Object.assign(item, write.patch);
				}
			}, checkout.version);
			if (approved.length > 0) {
				for (const write of approved) writes.push(write);
				replaySteps.push({ kind: "quality-batch", writes: approved });
			}
			return { changed: approved.length };
		}),

		set: Effect.fn("Backpack.stageField")(function* (
			input: InventoryItemChange,
		) {
			const decoded = decodeInventoryItemChange(input);
			if (Result.isFailure(decoded)) return yield* decoded.failure;
			const change = decoded.success;
			const resolved = yield* target(change.ownerId, change.entityId).pipe(
				Effect.mapError((error) =>
					error._tag === "ItemPropertyInvalid"
						? new BackpackItemInvalid({ message: error.message })
						: error,
				),
			);
			const { item, ownerName } = resolved;
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
			const capabilities = getInventoryItemCapabilities(
				item,
				objectMetadataAllowsEdits(item, info),
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
				change.ownerId,
				change.entityId,
				ownerName,
				item,
				change.property === "stack" ? "quantity" : "quality",
				change.property,
			);
			return {
				changed: yield* apply(resolved, change.ownerId, {
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
			const resolved = yield* target(change.ownerId, change.entityId);
			const { item, ownerName, context } = resolved;
			const { info } = yield* metadataFor(item);
			const field = getItemPropertyFields(item, info, context).find(
				(fieldCandidate) => fieldCandidate.property === change.property,
			);
			if (!field)
				return yield* new ItemPropertyInvalid({
					message: "This item does not support that property edit.",
				});
			let patch: ItemPatch;
			if (Schema.is(TrinketPropertyChangeSchema)(change)) {
				const originalOwner = authority && ownerIn(authority, change.ownerId);
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
				contexts.set(change.ownerId, JSON.stringify(originalContext));
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
				const savedColor =
					change.property === "color" &&
					item.$type === "StardewValley.Objects.ColoredObject"
						? item.color
						: change.property === "clothesColor" &&
							  item.$type === "StardewValley.Objects.Clothing"
							? item.clothesColor
							: undefined;
				const color = itemColorPatch(savedColor, change.value);
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
				change.ownerId,
				change.entityId,
				ownerName,
				item,
				field.label.toLowerCase(),
				change.property,
			);
			return {
				changed: yield* apply(resolved, change.ownerId, patch),
				...review,
			};
		}),
	} satisfies typeof InventoryEdits.Service;
	return {
		service,
		inventory: () => preparedInventory,
		// Authorization compares field presence and values, not object insertion
		// order. A patch-created reward must equal the approved record even when
		// replay enumerates its keys differently; opaque extra fields still reject.
		validate: (document: SaveDocument, baseline: SaveDocument) =>
			contextMatches(document) &&
			samePlainData(
				inventorySnapshot(replay(baseline)),
				inventorySnapshot(document),
			),
		close: Effect.sync(() => {
			authority = undefined;
			writes.length = 0;
			resizes.length = 0;
			replaySteps.length = 0;
			contexts.clear();
		}),
	};
}
