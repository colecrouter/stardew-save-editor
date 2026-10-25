// Parsed XML consists of plain records, arrays, and primitive values. This
// comparator intentionally does not support class instances, cycles, Maps or Sets.
function equal(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (
		!left ||
		!right ||
		typeof left !== "object" ||
		typeof right !== "object" ||
		Array.isArray(left) !== Array.isArray(right)
	)
		return false;
	const a = left as Record<string, unknown>;
	const b = right as Record<string, unknown>;
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
	);
}

// Deliberately narrow lens over a full parsed save. Unknown fields stay attached.
export interface Farmer {
	UniqueMultiplayerID: string | number;
	name: string;
	farmName: string;
	money: number;
	items: { Item: unknown[] };
}
export interface SaveDocument {
	SaveGame: {
		player: Farmer;
		farmhands: "" | { Farmer: Farmer[] };
	};
}
export type Mutation =
	| { type: "money"; farmerId: string; value: number }
	| {
			type: "item-stack";
			farmerId: string;
			slot: number;
			itemId: string;
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
}
export class MutationError extends Error {
	readonly _tag = "MutationError";
}
export const farmers = (document: SaveDocument) => [
	document.SaveGame.player,
	...(document.SaveGame.farmhands === ""
		? []
		: document.SaveGame.farmhands.Farmer),
];

export function apply(
	document: SaveDocument,
	mutation: Mutation,
): {
	label: string;
	review: Receipt["review"];
} {
	if (mutation.type === "farm-name") {
		if (!mutation.value.trim()) throw new MutationError("Farm name is empty");
		for (const farmer of farmers(document)) farmer.farmName = mutation.value;
		return { label: `Rename farm to ${mutation.value}`, review: "standalone" };
	}
	const matches = farmers(document).filter(
		(farmer) => String(farmer.UniqueMultiplayerID) === mutation.farmerId,
	);
	if (matches.length !== 1)
		throw new MutationError("Farmer ID must resolve exactly once");
	const farmer = matches[0];
	if (mutation.type === "item-stack") {
		const item = farmer.items.Item[mutation.slot];
		if (
			!Number.isInteger(mutation.slot) ||
			mutation.slot < 0 ||
			!item ||
			typeof item !== "object" ||
			!("itemId" in item) ||
			String(item.itemId) !== mutation.itemId ||
			!("stack" in item) ||
			typeof item.stack !== "number" ||
			!("@_xsi:type" in item) ||
			item["@_xsi:type"] !== "Object" ||
			("bigCraftable" in item && item.bigCraftable === true)
		)
			throw new MutationError(
				"Selected slot no longer holds a supported stackable object",
			);
		if (
			!Number.isInteger(mutation.value) ||
			mutation.value < 1 ||
			mutation.value > 999
		)
			throw new MutationError("Stack must be a whole number from 1 to 999");
		item.stack = mutation.value;
		return {
			label: `Set ${farmer.name}'s slot ${mutation.slot + 1} stack`,
			review: "standalone",
		};
	}
	if (mutation.type === "money") {
		// Separate-wallet fixture only: shared-wallet semantics require a domain decision.
		if (
			!Number.isInteger(mutation.value) ||
			mutation.value < 0 ||
			mutation.value > 2147483647
		)
			throw new MutationError("Money must be a nonnegative int32");
		farmer.money = mutation.value;
		return { label: `Set ${farmer.name}'s money`, review: "standalone" };
	}
	const items = farmer.items.Item;
	if (
		mutation.order.length !== items.length ||
		new Set(mutation.order).size !== items.length ||
		mutation.order.some(
			(index) => !Number.isInteger(index) || index < 0 || index >= items.length,
		)
	)
		throw new MutationError("Order must be a permutation of all slots");
	farmer.items.Item = mutation.order.map((index) => items[index]);
	return { label: `Reorder ${farmer.name}'s backpack`, review: "compact" };
}

// Discovery implementation, not a complete semantic diff engine. Arrays are deliberately
// recorded as complete values so a reorder never loses unknown or hidden entries.
export function diff(before: unknown, after: unknown, path = ""): Change[] {
	if (equal(before, after)) return [];
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
export function prepare(
	state: SessionState,
	input: Mutation,
	inspect: (draft: SaveDocument) => void = () => {},
): SessionState {
	const mutation = structuredClone(input);
	const draft = structuredClone(state.document);
	const presentation = apply(draft, mutation);
	inspect(draft); // fault injection / final validation, before any publication
	const changes = diff(state.document, draft);
	if (changes.length === 0) return state;
	return {
		document: draft,
		history: [...state.history, { intent: mutation, ...presentation, changes }],
	};
}
