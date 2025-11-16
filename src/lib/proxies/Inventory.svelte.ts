import type { ParentIndex } from "$lib/ItemParentIndex";
import { Item } from "$lib/proxies/Item.svelte";
import type { Player } from "$types/save";
import { SvelteMap } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";

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
	extends SvelteMap<ParentIndex, Item | undefined>
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
				super.set(i, new Item(entry));
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
				super.set(slot, Item.create(rawEntry));
			}
		}
	}

	public set(index: ParentIndex, value: Item | undefined): this {
		// Dispose previous item's effect root if replacing/removing
		const prev = this.get(index);
		if (prev && prev !== value) {
			prev.dispose();
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
				this[Raw][index] = value[Raw];
			}
		}
		return super.set(index, value);
	}

	public delete(index: ParentIndex): boolean {
		const existed = this.has(index);
		// Preserve reactive anchor by using set(undefined) instead of super.delete
		this.set(index, undefined);
		return existed;
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
				if (prev) prev.dispose();
			}
			items.length = size;
			for (let i = size; i < oldSize; i++) {
				// Keep stable anchor for removed indices
				super.set(i, undefined);
			}
		}
	}
}
