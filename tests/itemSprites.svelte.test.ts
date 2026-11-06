import { render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { ItemData, ResolveItemData } from "$lib/ItemData";
import { getItemSprite } from "$lib/ItemSprite";
import {
	ClothingProxy,
	ColoredObjectProxy,
	createItemProxy,
} from "$lib/proxies/items";
import { Sprite } from "$lib/Sprite.svelte";
import type { ItemInformation } from "$types/items";
import type { Item } from "$types/save";
import ItemSprite from "../src/routes/(legacy)/(edit)/inventory/ItemSprite.svelte";

function metadata(name: string) {
	const info = ItemData.get(name);
	if (!info) throw new Error(`Missing fixture metadata: ${name}`);
	return info;
}

function withItem(
	raw: Item,
	fn: (item: ReturnType<typeof createItemProxy>) => void,
) {
	const cleanup = $effect.root(() => fn(createItemProxy(raw)));
	flushSync();
	cleanup();
}

describe("game menu sprite rectangles", () => {
	it.each([
		["Country Lamp", { x: 48, y: 720, width: 16, height: 48 }],
		["Wall Sconce", { x: 448, y: 1392, width: 16, height: 32 }],
		["Shirt And Tie", { x: 88, y: 224, width: 8, height: 8 }],
		["Shorts", { x: 192, y: 672, width: 16, height: 16 }],
	])("matches the game's source rectangle for %s", (name, expected) => {
		expect(new Sprite(metadata(name)).sourceRect).toEqual(expected);
	});

	it("indexes furniture by 16px cells even on a differently named texture", () => {
		const sprite = new Sprite({
			...metadata("Country Lamp"),
			texture: "FreeCactuses.png",
			spriteIndex: 9,
		} as ItemInformation);
		expect(sprite.sourceRect).toEqual({ x: 16, y: 16, width: 16, height: 48 });
	});

	it("uses texture width for clothing and hat layouts", () => {
		const shirt = new Sprite({
			...metadata("Shirt And Tie"),
			texture: "furniture.png",
			spriteIndex: 32,
		} as ItemInformation);
		expect(shirt.sourceRect).toEqual({ x: 0, y: 32, width: 8, height: 8 });
		const hat = new Sprite({
			...metadata("Cowboy Hat"),
			texture: "FreeCactuses.png",
			spriteIndex: 7,
		} as ItemInformation);
		expect(hat.sourceRect).toEqual({ x: 12, y: 80, width: 20, height: 20 });
		const pants = new Sprite({
			...metadata("Shorts"),
			spriteIndex: 11,
		} as ItemInformation);
		expect(pants.sourceRect).toEqual({
			x: 192,
			y: 1360,
			width: 16,
			height: 16,
		});
	});

	it("wraps adjacent object dye layers onto the next row", () => {
		const sprite = new Sprite({ ...metadata("Wine"), spriteIndex: 127 });
		expect(sprite.getSourceRect(1)).toEqual({
			x: 0,
			y: 256,
			width: 16,
			height: 16,
		});
	});
});

describe("saved item drawing rules", () => {
	it("matches smoked variants by ingredient instead of the first shared ID", () => {
		const raw = {
			"@_xsi:type": "ColoredObject",
			name: "Smoked Anchovy",
			itemId: "SmokedFish",
			preservedParentSheetIndex: "129",
		} as Item;
		expect(ResolveItemData(raw)?.name).toBe("Smoked Anchovy");
		withItem(raw, (item) => {
			const drawing = getItemSprite(item);
			expect(drawing?.sprite.sourceRect).toEqual({
				x: 144,
				y: 80,
				width: 16,
				height: 16,
			});
			expect(drawing?.layers[1]?.tint).toEqual([80, 30, 10, 153]);
		});
	});

	it("selects the smoked ingredient even when the saved name is different", () => {
		withItem(
			{
				"@_xsi:type": "ColoredObject",
				name: "Localized fish name",
				itemId: "SmokedFish",
				preservedParentSheetIndex: "130",
			} as Item,
			(item) => {
				expect(getItemSprite(item)?.sprite.sourceRect).toEqual({
					x: 160,
					y: 80,
					width: 16,
					height: 16,
				});
			},
		);
	});

	it("honors both colored-object modes without generated metadata colors", () => {
		withItem(
			{
				"@_xsi:type": "ColoredObject",
				name: "Blueberry Wine",
				itemId: "348",
				color: { R: 46, G: 85, B: 183, A: 128, PackedValue: 0 },
			} as Item,
			(item) => {
				expect(item).toBeInstanceOf(ColoredObjectProxy);
				expect(item.info?.color).toBeUndefined();
				const drawing = getItemSprite(item);
				expect(drawing?.layers).toEqual([
					{ sourceRect: { x: 48, y: 240, width: 16, height: 16 } },
					{
						sourceRect: { x: 64, y: 240, width: 16, height: 16 },
						tint: [46, 85, 183, 128],
					},
				]);
				if (!(item instanceof ColoredObjectProxy))
					throw new Error("Expected colored object");
				item.colorSameIndexAsParentSheetIndex = true;
				expect(getItemSprite(item)?.layers).toEqual([
					{
						sourceRect: { x: 48, y: 240, width: 16, height: 16 },
						tint: [46, 85, 183, 128],
					},
				]);
			},
		);
	});

	it("keeps shirt details untinted and updates its separate dye layer reactively", () => {
		withItem(
			{
				"@_xsi:type": "Clothing",
				name: "Shirt And Tie",
				itemId: "1123",
				clothesColor: { R: 46, G: 85, B: 183, A: 255, PackedValue: 0 },
			} as Item,
			(item) => {
				if (!(item instanceof ClothingProxy) || !item.color)
					throw new Error("Expected clothing color");
				const view = render(ItemSprite, { item });
				const images = view.container.querySelectorAll("svg image");
				expect(images[0]?.getAttribute("filter")).toBeNull();
				expect(images[1]?.getAttribute("filter")).toMatch(/^url\(#.+\)$/);
				expect(getItemSprite(item)?.layers[1]?.sourceRect).toEqual({
					x: 216,
					y: 224,
					width: 8,
					height: 8,
				});
				item.color.R = 255;
				flushSync();
				expect(
					view.container.querySelector("feColorMatrix")?.getAttribute("values"),
				).toMatch(/^1 0 0/);
				view.unmount();
			},
		);
	});

	it("tints pants once, with no untinted base underneath translucent colors", () => {
		withItem(
			{
				"@_xsi:type": "Clothing",
				name: "Shorts",
				itemId: "1",
				clothesColor: { R: 20, G: 30, B: 40, A: 128, PackedValue: 0 },
			} as Item,
			(item) => {
				expect(getItemSprite(item)?.layers).toEqual([
					{
						sourceRect: { x: 192, y: 672, width: 16, height: 16 },
						tint: [20, 30, 40, 128],
						prismatic: false,
					},
				]);
			},
		);
	});

	it("animates only the prismatic shirt mask and gives each instance unique filters", () => {
		withItem(
			{
				"@_xsi:type": "Clothing",
				name: "Prismatic Shirt",
				itemId: "1223",
				isPrismatic: true,
				hasBeenInInventory: false,
				isRecipe: false,
				quality: 0,
				stack: 1,
			} as Item,
			(item) => {
				const first = render(ItemSprite, { item });
				const second = render(ItemSprite, { item });
				expect(
					first.container.querySelector("animate")?.getAttribute("dur"),
				).toBe("9s");
				expect(
					first.container.querySelectorAll("svg")[0]?.querySelector("animate"),
				).toBeNull();
				expect(first.container.querySelector("filter")?.id).not.toBe(
					second.container.querySelector("filter")?.id,
				);
				first.unmount();
				second.unmount();
			},
		);
	});

	it("renders unknown items as a visible placeholder", () => {
		withItem(
			{ name: "Unknown custom item", itemId: "example" } as Item,
			(item) => {
				const view = render(ItemSprite, { item });
				expect(view.container.textContent).toBe("??");
				view.unmount();
			},
		);
	});
});
