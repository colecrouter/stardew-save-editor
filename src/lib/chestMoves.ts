import { Dispose, Raw } from "$lib/proxies";
import type { ChestProxy } from "$lib/proxies/Chest.svelte";
import type { ItemProxy } from "$lib/proxies/items";

/** One slot in one chest */
export interface SlotRef {
	chest: ChestProxy;
	index: number;
}

export const sameSlot = (a: SlotRef, b: SlotRef) =>
	a.chest === b.chest && a.index === b.index;

/**
 * Move one item onto a slot. An empty slot takes it; an occupied one swaps
 * the two items, as dropping onto a full slot does in-game.
 */
export function moveItem(from: SlotRef, to: SlotRef) {
	if (sameSlot(from, to)) return;
	const moving = from.chest.inventory.take(from.index);
	if (!moving) return;
	const displaced = to.chest.inventory.take(to.index);
	to.chest.inventory.place(to.index, moving);
	if (displaced) from.chest.inventory.place(from.index, displaced);
}

export type MoveResult =
	| { ok: true; moved: SlotRef[] }
	| { ok: false; needed: number; free: number };

/**
 * Move several items into a chest's empty slots. Items already in that chest
 * stay put. Nothing moves unless they all fit.
 */
export function moveItems(from: SlotRef[], target: ChestProxy): MoveResult {
	const moving = from.filter(
		(ref) => ref.chest !== target && ref.chest.inventory.get(ref.index),
	);
	const free: number[] = [];
	for (let index = 0; index < target.inventory.slotCount; index++)
		if (!target.inventory.get(index)) free.push(index);

	if (moving.length > free.length)
		return { ok: false, needed: moving.length, free: free.length };

	const moved: SlotRef[] = [];
	for (const [i, ref] of moving.entries()) {
		const item = ref.chest.inventory.take(ref.index);
		const index = free[i] as number;
		if (!item) continue;
		target.inventory.place(index, item);
		moved.push({ chest: target, index });
	}
	return { ok: true, moved };
}

// Tools (including weapons) go first when the game organizes a chest
const TOOL_TYPES = new Set([
	"Tool",
	"MeleeWeapon",
	"Slingshot",
	"FishingRod",
	"WateringCan",
	"Pickaxe",
	"Axe",
	"Hoe",
	"Pan",
	"MilkPail",
	"Shears",
	"Wand",
	"GenericTool",
]);
const STACKABLE_TYPES = new Set(["Object", "ColoredObject"]);
const MAX_STACK = 999;
// Object.maximumStackSize: Secret Notes, Journal Scraps, the Horse Flute and
// fishing tackle never stack
const SINGLE_OBJECTS = new Set(["(O)79", "(O)842", "(O)911"]);
const TACKLE_CATEGORY = -22;

type RawColor = { R?: number; G?: number; B?: number; A?: number };

// Values read back from a save can be strings, numbers or booleans
type RawFields = {
	"@_xsi:type"?: string;
	bigCraftable?: boolean | string;
	category?: number;
	color?: RawColor;
	isRecipe?: boolean | string;
	itemId?: string | number;
	name?: string;
	orderData?: string;
	parentSheetIndex?: number;
	quality?: number;
	stack?: number;
	type?: string;
};

const raw = (item: ItemProxy) => item[Raw] as unknown as RawFields;

// Item.getCategorySortValue: "Clothing" (-100) sorts with the furniture
const categorySortValue = (item: ItemProxy) => {
	const category = Number(raw(item).category ?? 0);
	return category === -100 ? -94 : category;
};

const isObject = (item: ItemProxy) =>
	!TOOL_TYPES.has(raw(item)["@_xsi:type"] ?? "") &&
	raw(item).type !== undefined;

/** Item.CompareTo from the game */
function compareItems(a: ItemProxy, b: ItemProxy) {
	const ra = raw(a);
	const rb = raw(b);
	if (Number(ra.category ?? 0) !== Number(rb.category ?? 0))
		return categorySortValue(b) - categorySortValue(a);
	if (ra.name === rb.name && ra.parentSheetIndex === rb.parentSheetIndex) {
		const byQuality = Number(rb.quality ?? 0) - Number(ra.quality ?? 0);
		if (byQuality !== 0) return byQuality;
		return count(a) - count(b);
	}
	if (isObject(a) && isObject(b))
		return `${ra.type ?? ""}${ra.name ?? ""}`.localeCompare(
			`${rb.type ?? ""}${rb.name ?? ""}`,
		);
	return (ra.name ?? "").localeCompare(rb.name ?? "");
}

/**
 * How many are in a stack. Items track this as both `amount` (what the item
 * editor edits) and `stack`, and both write the saved stack size, so change
 * them together.
 */
const count = (item: ItemProxy) => item.amount ?? item.stack;
const setCount = (item: ItemProxy, n: number) => {
	item.stack = n;
	if (item.amount !== undefined) item.amount = n;
};

const isTrue = (value: unknown) => value === true || value === "true";

/** Item.QualifiedItemId, e.g. "(O)388", whether or not the save has the prefix */
const qualifiedId = (item: ItemProxy) => {
	const { itemId, bigCraftable } = raw(item);
	const id = String(itemId ?? "");
	if (id.startsWith("(")) return id;
	return `${isTrue(bigCraftable) ? "(BC)" : "(O)"}${id}`;
};

/** Object.Name: flavoured goods have their own name, e.g. "Blueberry Wine" */
const gameName = (item: ItemProxy) =>
	`${raw(item).name ?? ""}${isTrue(raw(item).isRecipe) ? " Recipe" : ""}`;

const maximumStackSize = (item: ItemProxy) =>
	SINGLE_OBJECTS.has(qualifiedId(item)) ||
	Number(raw(item).category) === TACKLE_CATEGORY
		? 1
		: MAX_STACK;

const sameColor = (a: RawColor = {}, b: RawColor = {}) =>
	(["R", "G", "B", "A"] as const).every(
		(channel) => Number(a[channel] ?? 0) === Number(b[channel] ?? 0),
	);

/**
 * Item.canStackWith from the game. Only the fields it checks are compared, so
 * an item made in the editor still stacks with one the game saved, even
 * though their other fields differ.
 */
function canStack(a: ItemProxy, b: ItemProxy) {
	const ra = raw(a);
	const rb = raw(b);
	const type = ra["@_xsi:type"] ?? "";
	if (type !== rb["@_xsi:type"] || !STACKABLE_TYPES.has(type)) return false;
	if (type === "ColoredObject" && !sameColor(ra.color, rb.color)) return false;
	if (maximumStackSize(a) <= 1 || maximumStackSize(b) <= 1) return false;
	if ((ra.orderData ?? "") !== (rb.orderData ?? "")) return false;
	if (Number(ra.quality ?? 0) !== Number(rb.quality ?? 0)) return false;
	if (qualifiedId(a) !== qualifiedId(b)) return false;
	return gameName(a) === gameName(b);
}

/** Anything with numbered slots that can be sorted: a chest or the backpack */
export interface SortableSlots {
	slotCount: number;
	get(index: number): ItemProxy | undefined;
	arrange(items: ItemProxy[]): void;
}

/**
 * Sort slots the way the game's Organize button does
 * (ItemGrabMenu.organizeItemsInList): tools first in their current order,
 * then stacks the game would combine merged (up to 999), then everything
 * sorted by category, type and name, best quality first.
 */
export function sortSlots(slots: SortableSlots) {
	const items: ItemProxy[] = [];
	for (let index = 0; index < slots.slotCount; index++) {
		const item = slots.get(index);
		if (item) items.push(item);
	}
	// Leave empty containers exactly as they were saved
	if (!items.length) return;

	const tools = items.filter((item) =>
		TOOL_TYPES.has(raw(item)["@_xsi:type"] ?? ""),
	);
	const rest = items.filter((item) => !tools.includes(item));

	const merged: ItemProxy[] = [];
	const emptied: ItemProxy[] = [];
	for (const item of rest) {
		let remaining = count(item);
		for (const target of merged) {
			if (remaining <= 0) break;
			if (count(target) >= MAX_STACK || !canStack(target, item)) continue;
			const moved = Math.min(MAX_STACK - count(target), remaining);
			setCount(target, count(target) + moved);
			remaining -= moved;
		}
		if (remaining > 0) {
			setCount(item, remaining);
			merged.push(item);
		} else emptied.push(item);
	}

	merged.sort(compareItems);
	slots.arrange([...tools, ...merged]);
	for (const item of emptied) item[Dispose]?.();
}

export const sortChest = (chest: ChestProxy) => sortSlots(chest.inventory);
