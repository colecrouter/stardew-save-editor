import { SvelteMap } from "svelte/reactivity";
import type { ParentIndex } from "$lib/ItemParentIndex";
import { createItemProxy, type ItemProxy } from "$lib/proxies/items";
import type { Player } from "$types/save";
import { type DataProxy, Dispose, Raw } from ".";

const nil = { "@_xsi:nil": "true" };
function isNilSentinel(value: unknown): value is { "@_xsi:nil": "true" } {
	return (
		typeof value === "object" &&
		value !== null &&
		"@_xsi:nil" in (value as Record<string, unknown>) &&
		// Only consider it a nil sentinel when explicitly "true"
		// Some loaders might emit "@_xsi:nil": "false" which should not be treated as nil
		(value as Record<string, unknown>)["@_xsi:nil"] === "true"
	);
}

/**
 * The player's inventory
 *
 * Includes both regular inventory slots, as well as equipment slots (e.g. hat, pants).
 */
export class Inventory
	extends SvelteMap<ParentIndex, ItemProxy | undefined>
	implements DataProxy<Player>
{
	public [Raw]: Player;

	// Reactive slot count for UI derivations
	public slotCount: number;

	constructor(raw: Player) {
		super();
		this[Raw] = raw;

		// Initialize reactive slot count
		this.slotCount = $state(this[Raw].items.Item.length);

		// Prime numeric inventory slots
		this[Raw].items.Item.forEach((entry, i) => {
			if (
				isNilSentinel(entry) ||
				!entry ||
				entry.name?.startsWith?.("Secret Note")
			) {
				super.set(i, undefined);
			} else {
				super.set(i, createItemProxy(entry));
			}
		});

		// Prime equipment slots once. Thereafter, this Map is authoritative; external
		// code should mutate via Inventory APIs, not by poking raw.* directly.
		const equipSlots: Exclude<ParentIndex, number>[] = [
			"hat",
			"shirtItem",
			"pantsItem",
			"boots",
			"leftRing",
			"rightRing",
			"trinketItem",
		];
		for (const slot of equipSlots) {
			const rawEntry = this[Raw][slot];
			if (
				!rawEntry ||
				isNilSentinel(rawEntry) ||
				rawEntry?.name?.startsWith?.("Secret Note")
			) {
				// Treat undefined or nil sentinel as empty equipment
				super.set(slot, undefined);
				// Optional cleanup: eagerly remove nil sentinel from raw so it won't persist
				if (isNilSentinel(rawEntry)) {
					delete this[Raw][slot];
				}
			} else {
				super.set(slot, createItemProxy(rawEntry));
			}
		}
	}

	public set(index: ParentIndex, value: ItemProxy | undefined): this {
		// Dispose previous item's effect root if replacing/removing
		const prev = this.get(index);
		if (prev && prev !== value) {
			prev[Dispose]?.();
		}

		if (typeof index === "number") {
			const itemsArray = this[Raw].items.Item;
			// @ts-expect-error converting undefined to nil marker
			itemsArray[index] = value ? value[Raw] : nil;
		} else {
			// For equipment, omit empty slots entirely rather than writing xsi:nil
			if (value == null) {
				delete this[Raw][index];
			} else {
				// Equipment slots are properly typed in Player interface
				const equipmentSlots = this[Raw] as unknown as Record<string, unknown>;
				equipmentSlots[index] = value[Raw];
			}
		}
		return super.set(index, value);
	}

	/**
	 * Lay out the backpack slots in order (used by sorting); items keep their
	 * proxies. Slots holding an item the editor doesn't show (Secret Notes) are
	 * left exactly as they are, and the other items are laid out around them.
	 */
	public arrange(items: ItemProxy[]) {
		const raw = this[Raw].items.Item;
		const slots: number[] = [];
		for (let index = 0; index < this.slotCount; index++) {
			const entry = raw[index];
			const hidden =
				this.get(index) === undefined && !!entry && !isNilSentinel(entry);
			if (!hidden) slots.push(index);
		}
		if (items.length > slots.length) {
			throw new Error(
				`${items.length} items won't fit in ${slots.length} slots`,
			);
		}
		slots.forEach((index, i) => {
			const item = items[i];
			// @ts-expect-error converting undefined to nil marker
			raw[index] = item ? item[Raw] : nil;
			super.set(index, item);
		});
	}

	public delete(index: ParentIndex): boolean {
		const existed = this.has(index);
		// Preserve reactive anchor by using set(undefined) instead of super.delete
		this.set(index, undefined);
		return existed;
	}

	/**
	 * Whether a backpack slot holds nothing. Unlike `get`, this counts items the
	 * editor doesn't load (Secret Notes), which still take up the slot.
	 */
	public isEmpty(index: number) {
		// Read through the map too, so effects update when the slot changes
		if (this.get(index)) return false;
		const entry = this[Raw].items.Item[index];
		return !entry || isNilSentinel(entry);
	}

	public adjustSlots(size: number) {
		if (size < 1 || size > 36 || size % 12 !== 0)
			throw new Error("Invalid size");
		const items = this[Raw].items.Item;
		const oldSize = items.length;
		if (size === oldSize) return;

		// update reactive slot count
		this.slotCount = size;

		if (size > oldSize) {
			for (let i = oldSize; i < size; i++) {
				// @ts-expect-error push nil sentinel
				items.push(nil);
				// Establish per-index reactive anchor without write-through duplication
				super.set(i, undefined);
			}
		} else {
			// Dispose any items that will be truncated out of the raw array
			for (let i = size; i < oldSize; i++) {
				const prev = this.get(i);
				if (prev) prev[Dispose]?.();
			}
			items.length = size;
			for (let i = size; i < oldSize; i++) {
				// Keep stable anchor for removed indices
				super.set(i, undefined);
			}
		}
	}

	/**
	 * Swap two backpack slots. Unlike two `set` calls, this doesn't dispose
	 * either item (which would stop its edits being saved), and it moves the
	 * save's own entries, so items the editor doesn't load (Secret Notes) move too.
	 */
	public swap(a: number, b: number) {
		const items = this[Raw].items.Item;
		[items[a], items[b]] = [items[b], items[a]];
		const first = this.get(a);
		super.set(a, this.get(b));
		super.set(b, first);
	}
}
