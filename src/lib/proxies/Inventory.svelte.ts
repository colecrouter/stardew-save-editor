import type { ParentIndex } from "$lib/ItemParentIndex";
import { Item } from "$lib/proxies/Item.svelte";
import type { Player } from "$types/save";

const nil = { "@_xsi:nil": "true" };
const isNil = (value: unknown): value is { "@_xsi:nil": "true" } =>
    typeof value === "object" && value !== null && "@_xsi:nil" in value;

export class Inventory {
    raw: Player;

    constructor(raw: Player) {
        this.raw = raw;
    }

    getItem(index: ParentIndex) {
        const raw =
            typeof index === "number"
                ? this.raw.items.Item[index]
                : this.raw[index];
        if (!raw || isNil(raw)) return undefined;

        // TODO fix this
        if (raw.name.startsWith("Secret Note")) return undefined;

        return new Item(raw);
    }

    setItem(index: ParentIndex, value: Item | undefined) {
        if (typeof index === "number") {
            // @ts-expect-error
            this.raw.items.Item[index] = value ? value.raw : nil;
        } else {
            // @ts-expect-error
            this.raw[index] = value ? value.raw : nil;
        }
    }

    deleteItem(index: ParentIndex) {
        if (typeof index === "number") {
            // @ts-expect-error
            this.raw.items.Item[index] = nil;
        } else {
            // @ts-expect-error
            this.raw[index] = nil;
        }
    }

    adjustSlots(size: number) {
        if (size < 1 || size > 36 || size % 12 !== 0)
            throw new Error("Invalid size");

        const items = this.raw.items.Item;
        const oldSize = items.length;
        if (size === oldSize) return;

        if (size > oldSize) {
            items.push(...new Array(size - oldSize).fill(nil));
        } else {
            items.length = size;
        }
    }

    get pants() {
        return this.getItem("pantsItem");
    }

    set pants(value) {
        if (!value) {
            this.deleteItem("pantsItem");
        } else {
            this.setItem("pantsItem", value);
        }
    }

    get shirt() {
        return this.getItem("shirtItem");
    }

    set shirt(value) {
        if (!value) {
            this.deleteItem("shirtItem");
        } else {
            this.setItem("shirtItem", value);
        }
    }

    get hat() {
        return this.getItem("hat");
    }

    set hat(value) {
        if (!value) {
            this.deleteItem("hat");
        } else {
            this.setItem("hat", value);
        }
    }

    get boots() {
        return this.getItem("boots");
    }

    set boots(value) {
        if (!value) {
            this.deleteItem("boots");
        } else {
            this.setItem("boots", value);
        }
    }

    get leftRing() {
        return this.getItem("leftRing");
    }

    set leftRing(value) {
        if (!value) {
            this.deleteItem("leftRing");
        } else {
            this.setItem("leftRing", value);
        }
    }

    get rightRing() {
        return this.getItem("rightRing");
    }

    set rightRing(value) {
        if (!value) {
            this.deleteItem("rightRing");
        } else {
            this.setItem("rightRing", value);
        }
    }

    get items() {
        // TODO fix this
        return this.raw.items.Item.map((raw) =>
            isNil(raw) || raw?.name.startsWith("Secret Note")
                ? undefined
                : // @ts-expect-error we need to replace nil with undefined
                  new Item(raw),
        );
    }

    set items(value) {
        // @ts-expect-error same as above but vice versa
        this.raw.items.Item = value.map((item) =>
            item === undefined ? nil : item.raw,
        );
    }
}
