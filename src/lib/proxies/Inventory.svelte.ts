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

export class Inventory implements DataProxy<Player> {
	public [Raw]: Player;

	// Authoritative reactive state for inventory slots (0-35)
	public items = new SvelteMap<number, Item | undefined>();
	// Authoritative reactive state for equipment slots
	private equipment = new SvelteMap<
		Exclude<ParentIndex, number>,
		Item | undefined
	>();

	get raw() {
		return this[Raw];
	}

	constructor(raw: Player) {
		this[Raw] = raw;
		this.primeFromRaw(); // one-time prime; Maps become source-of-truth afterwards
		$effect(() => this.syncToRaw()); // always write raw from Maps
	}

	private primeFromRaw() {
		// Prime numeric inventory slots
		this[Raw].items.Item.forEach((entry, i) => {
			if (
				isNilSentinel(entry) ||
				!entry ||
				entry.name.startsWith("Secret Note")
			) {
				this.items.set(i, undefined);
			} else {
				this.items.set(i, new Item(entry));
			}
		});

		// Prime equipment slots once. Thereafter, the Maps are authoritative; external
		// code should mutate via Inventory APIs, not by poking raw.* directly.
		const equipSlots: Exclude<ParentIndex, number>[] = [
			"hat",
			"shirtItem",
			"pantsItem",
			"boots",
			"leftRing",
			"rightRing",
		];
		for (const slot of equipSlots) {
			const rawEntry = this[Raw][slot];
			if (
				!rawEntry ||
				isNilSentinel(rawEntry) ||
				rawEntry?.name?.startsWith?.("Secret Note")
			) {
				// Treat undefined or nil sentinel as empty equipment
				this.equipment.set(slot, undefined);
				// Optional cleanup: eagerly remove nil sentinel from raw so it won't persist
				if (isNilSentinel(rawEntry)) {
					delete this[Raw][slot];
				}
			} else {
				this.equipment.set(slot, new Item(rawEntry));
			}
		}
	}

	private syncToRaw() {
		// Sync numeric slots
		const itemsArray = this[Raw].items.Item;
		for (let i = 0; i < itemsArray.length; i++) {
			const cached = this.items.get(i);
			// @ts-expect-error converting undefined to nil marker
			itemsArray[i] = cached ? cached.raw : nil;
		}
		// Sync equipment slots
		for (const [slot, value] of this.equipment) {
			// For equipment, omit empty slots entirely rather than writing xsi:nil
			if (value == null) {
				// ensure legacy sentinel or old value doesn't linger
				delete this[Raw][slot];
			} else {
				this[Raw][slot] = value.raw as never;
			}
		}
	}

	// --- Equipment helpers ---
	private readEquipment(slot: Exclude<ParentIndex, number>) {
		return this.equipment.get(slot);
	}

	private writeEquipment(
		slot: Exclude<ParentIndex, number>,
		value: Item | undefined,
	) {
		if (value === undefined) {
			this.equipment.set(slot, undefined);
		} else {
			this.equipment.set(slot, value);
		}
	}

	// (Removed raw->equipment $effects; Maps are now the single source of truth.)

	// Public accessors replacing previous getters/setters
	get pants() {
		return this.readEquipment("pantsItem");
	}
	set pants(v) {
		this.writeEquipment("pantsItem", v);
	}

	get shirt() {
		return this.readEquipment("shirtItem");
	}
	set shirt(v) {
		this.writeEquipment("shirtItem", v);
	}

	get hat() {
		return this.readEquipment("hat");
	}
	set hat(v) {
		this.writeEquipment("hat", v);
	}

	get boots() {
		return this.readEquipment("boots");
	}
	set boots(v) {
		this.writeEquipment("boots", v);
	}

	get leftRing() {
		return this.readEquipment("leftRing");
	}
	set leftRing(v) {
		this.writeEquipment("leftRing", v);
	}

	get rightRing() {
		return this.readEquipment("rightRing");
	}
	set rightRing(v) {
		this.writeEquipment("rightRing", v);
	}

	adjustSlots(size: number) {
		if (size < 1 || size > 36 || size % 12 !== 0)
			throw new Error("Invalid size");
		const items = this[Raw].items.Item;
		const oldSize = items.length;
		if (size === oldSize) return;
		if (size > oldSize) {
			for (let i = oldSize; i < size; i++) {
				// @ts-expect-error push nil sentinel
				items.push(nil);
				this.items.set(i, undefined);
			}
		} else {
			items.length = size;
			for (let i = size; i < oldSize; i++) this.items.delete(i);
		}
	}

	// Unified access helpers ---------------------------------
	get(index: ParentIndex): Item | undefined {
		return typeof index === "number"
			? this.items.get(index)
			: this.readEquipment(index);
	}

	set(index: ParentIndex, value: Item | undefined) {
		if (typeof index === "number") this.items.set(index, value);
		else this.writeEquipment(index, value);
	}

	delete(index: ParentIndex) {
		if (typeof index === "number") this.items.set(index, undefined);
		else this.writeEquipment(index, undefined);
	}
}
