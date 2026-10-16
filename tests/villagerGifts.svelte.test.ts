import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { ItemData } from "$lib/ItemData";
import { getItemSprite } from "$lib/ItemSprite";
import { LovedGifts } from "$lib/LovedGifts";
import { characters } from "$lib/NPCs";
import { Item } from "$lib/proxies/Item.svelte";

describe("villager loved gifts", () => {
	const gifts = [...LovedGifts].flatMap(([villager, info]) =>
		[...info.loves, ...info.universalLoves].map((gift) => ({
			villager,
			...gift,
		})),
	);
	const names = (gifts: { name: string }[] | undefined) =>
		gifts?.map((gift) => gift.name);

	it("lists loved gifts for every villager", () => {
		expect([...LovedGifts.keys()].sort()).toEqual([...characters].sort());
		for (const [villager, info] of LovedGifts) {
			expect(info.loves.length, villager).toBeGreaterThan(0);
		}
		expect(names(LovedGifts.get("Lewis")?.loves)).toContain("Autumn's Bounty");
	});

	it("lists the universal loves each villager doesn't override", () => {
		const universal = [
			"Golden Pumpkin",
			"Magic Rock Candy",
			"Pearl",
			"Prismatic Shard",
			"Rabbit's Foot",
		];
		expect(names(LovedGifts.get("Lewis")?.universalLoves)).toEqual(universal);
		// Haley hates Prismatic Shard and Penny hates Rabbit's Foot
		expect(names(LovedGifts.get("Haley")?.universalLoves)).toEqual(
			universal.filter((name) => name !== "Prismatic Shard"),
		);
		expect(names(LovedGifts.get("Penny")?.universalLoves)).toEqual(
			universal.filter((name) => name !== "Rabbit's Foot"),
		);
	});

	it("shows Penny's love of every book once", () => {
		const books = LovedGifts.get("Penny")?.loves.find(
			(gift) => gift.name === "Any book",
		);
		expect(books?.items).toContain("Monster Compendium");
		expect(books?.items?.length).toBeGreaterThan(20);
	});

	it("resolves every loved gift in generated/gifttastes.json to an object or trinket with a sprite", () => {
		const unresolved: string[] = [];
		const cleanup = $effect.root(() => {
			for (const { villager, name, item } of gifts) {
				try {
					if (!name.trim()) throw new Error("no name");
					const type = ItemData.get(item)?._type;
					if (type !== "Object" && type !== "Trinket") {
						throw new Error(`not an object or trinket (${type})`);
					}
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
