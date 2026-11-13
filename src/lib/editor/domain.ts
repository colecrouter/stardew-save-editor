import { samePlainData } from "./plain-data.ts";
import { Effect, Result } from "effect";
import { MutationError } from "./mutation-error.ts";
export { MutationError } from "./mutation-error.ts";
import type { InventoryLocation } from "./equipment.ts";
import {
	applyInventoryMutation,
	isInventoryMutation,
	type InventoryIdentityState,
} from "./inventory-transition.ts";
import type { InventoryMoveRequest } from "./inventory-movement.ts";
import type { InventorySlotRequest } from "./inventory-lifecycle.ts";
import type { CalendarEdit } from "./calendar-document.ts";

// Authored records have no extension payload. Removing the generated extension
// index here lets constructors catch misspelled fields without restricting imports.
export type KnownFields<T> = {
	[
		K in keyof T as string extends K ? never : number extends K ? never : K
	]: T[K];
};
// The generated model owns saved fields, including optional fields and opaque
// subclasses. Only the host envelope is refined by SaveCodec on import; cabin
// placeholders and farmhands need not have a complete playable inventory.
export type {
	T_StardewValley_Item as Item,
	T_StardewValley_GameLocation as Location,
} from "../../../generated/save-format/save.ts";
import type {
	Value as SavedGame,
	T_StardewValley_Farmer,
} from "../../../generated/save-format/save.ts";
export type Farmer = T_StardewValley_Farmer;
export type HostFarmer = Farmer & {
	name: string;
	farmName: string;
	money: number;
	UniqueMultiplayerID: bigint;
	items: NonNullable<Farmer["items"]>;
};
/** A decoded cabin placeholder becomes eligible for the host slot only when
 * it carries the same required fields checked by the import envelope. */
export function isHostFarmer(farmer: Farmer): farmer is HostFarmer {
	return (
		typeof farmer.name === "string" &&
		typeof farmer.farmName === "string" &&
		typeof farmer.money === "number" &&
		Number.isFinite(farmer.money) &&
		typeof farmer.UniqueMultiplayerID === "bigint" &&
		Array.isArray(farmer.items)
	);
}
export type EditorGame = SavedGame & {
	player: HostFarmer;
	farmhands: NonNullable<SavedGame["farmhands"]>;
};
export interface SaveDocument {
	SaveGame: EditorGame;
}
/** Positional/core actions ready for the operation adapter; handle requests resolve in the queue first. */
export type ResolvedMutation =
	| {
			type: "equipment-swap";
			ownerId: string;
			slot: InventoryLocation;
			toOwnerId: string;
			toSlot: InventoryLocation;
	  }
	| {
			type: "item-swap";
			ownerId: string;
			slot: number;
			toOwnerId: string;
			toSlot: number;
	  }
	| CalendarEdit
	| { type: "bundle-complete"; bundleId: 13 }
	| { type: "item-place"; ownerId: string; slot: number; item: unknown }
	| { type: "item-remove"; ownerId: string; slot: number; entityId?: string }
	| {
			type: "item-move";
			ownerId: string;
			slot: number;
			entityId?: string;
			toOwnerId: string;
			toSlot: number;
	  }
	| { type: "money"; farmerId: string; value: number }
	| {
			type: "item-stack";
			ownerId: string;
			slot: number;
			itemId: string;
			/** Session-owned identity; resolved by the history session before applying. */
			entityId?: string;
			value: number;
	  }
	| { type: "inventory-organize"; ownerId: string }
	| {
			type: "inventory-transfer";
			ownerId: string;
			sources: readonly { ownerId: string; entityId: string }[];
	  }
	| { type: "chest-type"; ownerId: string; itemId: string }
	| { type: "farm-name"; value: string }
	| { type: "reorder"; ownerId: string; order: readonly number[] };
/** Public execution inputs include instance handles whose positions may change before the queue runs. */
export type MutationRequest =
	| ResolvedMutation
	| InventorySlotRequest
	| InventoryMoveRequest;
export interface Change {
	path: string;
	before: unknown;
	after: unknown;
}
/** Staged operation metadata. Preparation creates it; publication may still fail or be cancelled. */
export interface OperationChange {
	intent: ResolvedMutation;
	label: string;
	review: "standalone" | "compact";
	changes: Change[];
}
/** Detached operation state used during preparation and by comparison executors; not proof of commit. */
export interface SessionState {
	document: SaveDocument;
	history: OperationChange[];
	/** Operation-owned state, carried alongside XML and never exported into it. */
	domainState?: DomainState;
	/** Paired inventory records/handles are staged by one transition owner. */
	inventory?: InventoryIdentityState;
}
export type DomainValue =
	| null
	| boolean
	| number
	| bigint
	| string
	| DomainValue[]
	| { [key: string]: DomainValue };
export type DomainState = Record<string, DomainValue>;
export const farmers = (document: SaveDocument) =>
	[document.SaveGame.player, ...document.SaveGame.farmhands].filter(
		(farmer): farmer is Farmer => farmer !== null,
	);

export const emptySlot = (item: unknown) => item === null || item === undefined;

/** Prepare expected rejections as values; unexpected exceptions remain defects
 * when this planner is lifted into the Effect operation boundary. */
export function applyResult(
	document: SaveDocument,
	mutation: ResolvedMutation,
	inventory?: InventoryIdentityState,
): Result.Result<
	{
		label: string;
		review: OperationChange["review"];
		inventory?: InventoryIdentityState;
	},
	MutationError
> {
	if (isInventoryMutation(mutation))
		return applyInventoryMutation(document, mutation, inventory);
	if (mutation.type === "bundle-complete")
		return Result.fail(
			new MutationError("Bundle operations require the bundle domain adapter"),
		);
	if (mutation.type === "calendar-date" || mutation.type === "calendar-weather")
		return Result.fail(
			new MutationError(
				"Calendar operations require the calendar domain adapter",
			),
		);
	if (mutation.type === "farm-name") {
		if (typeof mutation.value !== "string" || !mutation.value.trim())
			return Result.fail(new MutationError("Farm name is empty"));
		for (const farmer of farmers(document)) farmer.farmName = mutation.value;
		return Result.succeed({
			label: `Rename farm to ${mutation.value}`,
			review: "standalone",
		});
	}
	// Owner identity is checked without coercing opaque imported identifiers.
	const matches = farmers(document).filter((farmer) => {
		if (!farmer || typeof farmer !== "object") return false;
		const id = farmer.UniqueMultiplayerID;
		return (
			(typeof id === "string" ||
				typeof id === "bigint" ||
				(typeof id === "number" && Number.isFinite(id))) &&
			String(id) === mutation.farmerId
		);
	});
	const farmer = matches[0];
	if (!farmer || matches.length !== 1)
		return Result.fail(
			new MutationError("Farmer ID must resolve exactly once"),
		);
	if (
		!Number.isInteger(mutation.value) ||
		mutation.value < 0 ||
		mutation.value > 2147483647
	)
		return Result.fail(new MutationError("Money must be a nonnegative int32"));
	farmer.money = mutation.value;
	return Result.succeed({
		label: `Set ${farmer.name}'s money`,
		review: "standalone",
	});
}

/** Synchronous compatibility for the retained plain comparison executor only.
 * Application commands use prepareEffect and never bridge thrown validation. */
export function apply(document: SaveDocument, mutation: ResolvedMutation) {
	return Result.getOrThrow(applyResult(document, mutation));
}

// Discovery implementation, not a complete semantic diff engine. Arrays are deliberately
// recorded as complete values so a reorder never loses unknown or hidden entries.
export function diff(before: unknown, after: unknown, path = ""): Change[] {
	if (samePlainData(before, after)) return [];
	if (
		before &&
		after &&
		typeof before === "object" &&
		typeof after === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const left = before as Record<string, unknown>;
		const right = after as Record<string, unknown>;
		return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
			(key) =>
				diff(
					left[key],
					right[key],
					`${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
				),
		);
	}
	return [
		{ path, before: structuredClone(before), after: structuredClone(after) },
	];
}

// Both executors use precisely the same draft/commit protocol. Effect does not
// itself roll back ordinary JavaScript writes.
/** Stage record and identity changes together without publishing partial state. */
export function prepareResult(
	state: SessionState,
	input: ResolvedMutation,
	inspect: (draft: SaveDocument) => void = () => {},
): Result.Result<SessionState, MutationError> {
	const mutation = structuredClone(input);
	const draft = structuredClone(state.document);
	const inventory = state.inventory
		? structuredClone(state.inventory)
		: undefined;
	const result = applyResult(draft, mutation, inventory);
	if (Result.isFailure(result)) return Result.fail(result.failure);
	inspect(draft); // Trusted comparison fault injection runs before publication.
	const { inventory: preparedInventory, ...presentation } = result.success;
	const changes = diff(state.document, draft);
	// Equal serialized records can still represent a permutation of item handles.
	// Preserve that prepared transition instead of silently dropping its identities.
	if (
		changes.length === 0 &&
		JSON.stringify(preparedInventory ?? state.inventory) ===
			JSON.stringify(state.inventory)
	)
		return Result.succeed(state);
	return Result.succeed({
		...state,
		document: draft,
		...(preparedInventory ? { inventory: preparedInventory } : {}),
		history: [...state.history, { intent: mutation, ...presentation, changes }],
	});
}

/** The production action path shares the typed failure/defect policy of programs. */
export const prepareEffect = Effect.fn("Editor.prepareAction")(function* (
	state: SessionState,
	input: ResolvedMutation,
) {
	return yield* Effect.fromResult(prepareResult(state, input));
});

/** Historical plain-executor adapter; it intentionally retains synchronous throws. */
export function prepare(
	state: SessionState,
	input: ResolvedMutation,
	inspect: (draft: SaveDocument) => void = () => {},
): SessionState {
	return Result.getOrThrow(prepareResult(state, input, inspect));
}
