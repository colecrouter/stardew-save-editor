import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { getItemSprite } from "$lib/ItemSprite";
import { Item } from "$lib/proxies/Item.svelte";
import { Villagers } from "$lib/Villagers";

describe("villager loved gifts", () => {
	const gifts = [...Villagers].flatMap(([villager, info]) =>
		info.loves.map((gift) => ({ villager, ...gift })),
	);

	it("lists loved gifts for the villagers", () => {
		expect(gifts.length).toBeGreaterThan(Villagers.size);
		expect(Villagers.get("Lewis")?.loves.map((gift) => gift.name)).toContain(
			"Autumn's Bounty",
		);
	});

	it("resolves every loved gift in generated/villagers.json to an item with a sprite", () => {
		const unresolved: string[] = [];
		const cleanup = $effect.root(() => {
			for (const { villager, name, item } of gifts) {
				try {
					if (!name.trim()) throw new Error("no name");
					const proxy = Item.fromName(item);
					if (!getItemSprite(proxy)) throw new Error("no sprite");
				} catch (error) {
					unresolved.push(`${villager}: ${name} (${item}): ${error}`);
				}
			}
		});
		flushSync();
		cleanup();
		expect(unresolved).toEqual([]);
	});
});
