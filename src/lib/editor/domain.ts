import { samePlainData } from "./plain-data.ts";
import { Effect, Result } from "effect";
import { MutationError } from "./mutation-error.ts";
export { MutationError } from "./mutation-error.ts";
import type { InventoryLocation, EquipmentSlot } from "./equipment.ts";
import {
	applyInventoryMutation,
	isInventoryMutation,
	type InventoryIdentityState,
} from "./inventory-transition.ts";
import type { BackpackMoveRequest } from "./backpack-movement.ts";
import type { BackpackLifecycleRequest } from "./backpack-lifecycle.ts";
import type { CalendarEdit } from "../calendarDocument.ts";

// Deliberately narrow lens over a full parsed save. Unknown fields stay attached.
// Equipment fields may be absent or contain opaque imported records. Describing
// their actual keys permits typed access without asserting that their values are valid.
export interface Farmer extends Partial<Record<EquipmentSlot, unknown>> {
	UniqueMultiplayerID: string | number;
	name: string;
	farmName: string;
	money: number;
	// Parrot Egg stat rolls depend on the owning farmer's lifetime earnings.
	totalMoneyEarned?: unknown;
	items: { Item: unknown[] };
}
export interface SaveDocument {
	SaveGame: {
		player: Farmer;
		// World storage is traversed conservatively without asserting a complete game schema.
		locations?: unknown;
		// Trinket seed interpretation follows the save's selected game RNG algorithm.
		// Keep raw context unknown until validated; inspection must not normalize it.
		useLegacyRandom?: unknown;
		farmhands: "" | { Farmer: Farmer[] };
	};
}
export type Mutation =
	| {
			type: "equipment-swap";
			farmerId: string;
			slot: InventoryLocation;
			toFarmerId: string;
			toSlot: InventoryLocation;
	  }
	| BackpackLifecycleRequest
	| BackpackMoveRequest
	| {
			type: "item-swap";
			farmerId: string;
			slot: number;
			toFarmerId: string;
			toSlot: number;
	  }
	| CalendarEdit
	| { type: "bundle-complete"; bundleId: 13 }
	| { type: "item-place"; farmerId: string; slot: number; item: unknown }
	| { type: "item-remove"; farmerId: string; slot: number; entityId?: string }
	| {
			type: "item-move";
			farmerId: string;
			slot: number;
			entityId?: string;
			toFarmerId: string;
			toSlot: number;
	  }
	| { type: "money"; farmerId: string; value: number }
	| {
			type: "item-stack";
			farmerId: string;
			slot: number;
			itemId: string;
			/** Session-owned identity; resolved by the history session before applying. */
			entityId?: string;
			value: number;
	  }
	| { type: "farm-name"; value: string }
	| { type: "reorder"; farmerId: string; order: readonly number[] };
export interface Change {
	path: string;
	before: unknown;
	after: unknown;
}
export interface Receipt {
	intent: Mutation;
	label: string;
	review: "standalone" | "compact";
	changes: Change[];
}
export interface SessionState {
	document: SaveDocument;
	history: Receipt[];
	/** Operation-owned state, carried alongside XML and never exported into it. */
	domainState?: DomainState;
	/** Paired inventory records/handles are staged by one transition owner. */
	inventory?: InventoryIdentityState;
}
export type DomainValue =
	| null
	| boolean
	| number
	| string
	| DomainValue[]
	| { [key: string]: DomainValue };
export type DomainState = Record<string, DomainValue>;
export const farmers = (document: SaveDocument) => [
	document.SaveGame.player,
	...(document.SaveGame.farmhands === ""
		? []
		: document.SaveGame.farmhands.Farmer),
];

export const emptySlot = (item: unknown) =>
	item === null ||
	item === undefined ||
	(typeof item === "object" &&
		"@_xsi:nil" in item &&
		String(item["@_xsi:nil"]) === "true");

/** Prepare expected rejections as values; unexpected exceptions remain defects
 * when this planner is lifted into the Effect operation boundary. */
export function applyResult(
	document: SaveDocument,
	mutation: Mutation,
	inventory?: InventoryIdentityState,
): Result.Result<
	{
		label: string;
		review: Receipt["review"];
		inventory?: InventoryIdentityState;
	},
	MutationError
> {
	if (isInventoryMutation(mutation))
		return applyInventoryMutation(document, mutation, inventory);
	if (
		mutation.type === "backpack-add" ||
		mutation.type === "backpack-remove" ||
		mutation.type === "backpack-move"
	)
		return Result.fail(
			new MutationError(
				"Backpack requests require session identity resolution",
			),
		);
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
export function apply(document: SaveDocument, mutation: Mutation) {
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
	input: Mutation,
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
	input: Mutation,
) {
	return yield* Effect.fromResult(prepareResult(state, input));
});

/** Historical plain-executor adapter; it intentionally retains synchronous throws. */
export function prepare(
	state: SessionState,
	input: Mutation,
	inspect: (draft: SaveDocument) => void = () => {},
): SessionState {
	return Result.getOrThrow(prepareResult(state, input, inspect));
}
