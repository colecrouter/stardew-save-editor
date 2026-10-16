import { expect, it } from "vitest";
import { ItemData } from "$lib/ItemData";
import { Item } from "$lib/proxies/Item.svelte";

// Every item created by name must resolve back to itself, or its icon,
// description and stats come from a different item with the same ID
// (e.g. the Chest, big craftable 130, showing as Tuna, object 130)
it("resolves every item back to its own data", () => {
	const wrong: string[] = [];
	const cleanup = $effect.root(() => {
		for (const [name, data] of ItemData) {
			if (typeof name !== "string") continue;
			const info = Item.fromName(name).info;
			if (info?._type !== data._type || info?._key !== data._key)
				wrong.push(
					`${name} (${data._type} ${data._key}) resolved as ${info?.name} (${info?._type} ${info?._key})`,
				);
		}
	});
	cleanup();
	expect(wrong).toEqual([]);
});
