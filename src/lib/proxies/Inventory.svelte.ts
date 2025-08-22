import type { ParentIndex } from "$lib/ItemParentIndex";
import { Item } from "$lib/proxies/Item.svelte";
import type { Player } from "$types/save";
import { SvelteMap } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";

const nil = { "@_xsi:nil": "true" };
const isNil = (value: unknown): value is { "@_xsi:nil": "true" } =>
	typeof value === "object" && value !== null && "@_xsi:nil" in value;

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
			if (isNil(entry) || !entry || entry.name.startsWith("Secret Note")) {
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
				isNil(rawEntry) ||
				rawEntry.name?.startsWith?.("Secret Note")
			) {
				this.equipment.set(slot, undefined);
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
			// @ts-expect-error dynamic write
			this[Raw][slot] = value ? value.raw : nil;
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
