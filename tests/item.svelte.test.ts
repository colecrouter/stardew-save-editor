import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { Raw } from "$lib/proxies";
import { Item } from "../src/lib/proxies/Item.svelte";

/*
    In this file are *known-to-be-correct* tests for the item save data.
    The properties tested for on each item are ones that are confirmed to be required by the game.

    By keeping these tests, we can ensure that code/item creation can be refactored & tweaked, without breaking the core functionality.

    To add a new item test, simply give yourself the item in-game, open the save file, and start
    deleting/commenting out properties until the game crashes.

    Pro-tip: If you're using SMAPI, the game will just boot you back to the title screen instead of crashing.
*/

describe("Item", () => {
	function withRoot(fn: () => void) {
		const cleanup = $effect.root(() => {
			fn();
		});
		// ensure any pending effects flush synchronously
		flushSync();
		cleanup();
	}

	it("should create a Galaxy Sword", () => {
		withRoot(() => {
			const item = Item.fromName("Galaxy Sword");
			expect(item[Raw]).toMatchObject({
				category: -98,
				name: "Galaxy Sword",
				itemId: "4",
				stack: 1,
				minDamage: 60,
				maxDamage: 80,
				speed: 8,
				knockback: 1,
				critChance: 0.02,
				critMultiplier: 3,
				"@_xsi:type": "MeleeWeapon",
			});
		});
	});

	it("should create an Iridium Sprinkler", () => {
		withRoot(() => {
			const item = Item.fromName("Iridium Sprinkler");
			expect(item[Raw]).toMatchObject({
				category: -8,
				name: "Iridium Sprinkler",
				parentSheetIndex: 645,
				itemId: "645",
				stack: 1,
				type: "Crafting",
				price: 1000,
				"@_xsi:type": "Object",
			});
		});
	});

	it("should create an auto-grabber", () => {
		withRoot(() => {
			const item = Item.fromName("Auto-Grabber");
			expect(item[Raw]).toMatchObject({
				name: "Auto-Grabber",
				itemId: "165",
				stack: 1,
				parentSheetIndex: 165,
				category: -9,
				type: "Crafting",
				bigCraftable: true,
				"@_xsi:type": "Object",
			});
		});
	});

	it("should create a parsnip", () => {
		withRoot(() => {
			const item = Item.fromName("Parsnip");
			expect(item[Raw]).toMatchObject({
				category: -75,
				name: "Parsnip",
				parentSheetIndex: 24,
				itemId: "24",
				quality: 0,
				stack: 1,
				type: "Basic",
				price: 35,
				edibility: 10,
				"@_xsi:type": "Object",
			});
		});
	});

	it("should create an iridium pickaxe", () => {
		withRoot(() => {
			const item = Item.fromName("Iridium Pickaxe");
			expect(item[Raw]).toMatchObject({
				category: -99,
				name: "Pickaxe",
				itemId: "IridiumPickaxe",
				parentSheetIndex: 154,
				indexOfMenuItemView: 180,
				upgradeLevel: 4,
				"@_xsi:type": "Pickaxe",
			});
		});
	});

	it("should create a beach warp totem", () => {
		withRoot(() => {
			const item = Item.fromName("Warp Totem: Beach");
			expect(item[Raw]).toMatchObject({
				name: "Warp Totem: Beach",
				itemId: "690",
				stack: 1,
				price: 20,
				parentSheetIndex: 690,
				"@_xsi:type": "Object",
			});
		});
	});

	it("should create a white turban", () => {
		withRoot(() => {
			const item = Item.fromName("White Turban");
			expect(item[Raw]).toMatchObject({
				category: -95,
				name: "White Turban",
				itemId: "65",
				stack: 1,
				isRecipe: false,
				skipHairDraw: false,
				ignoreHairstyleOffset: true,
				"@_xsi:type": "Hat",
			});
		});
	});

	it("should create a WizardCatalogue", () => {
		withRoot(() => {
			const item = Item.fromName("WizardCatalogue");
			expect(item[Raw]).toMatchObject({
				name: "WizardCatalogue",
				itemId: "WizardCatalogue",
				stack: 1,
				price: 999,
				parentSheetIndex: 168,
				category: -24,
				tileLocation: { X: 0, Y: 0 },
				defaultSourceRect: {
					X: 192,
					Y: 192,
					Width: 16,
					Height: 32,
					Location: { X: 192, Y: 192 },
					Size: { X: 16, Y: 32 },
				},
				"@_xsi:type": "Furniture",
			});
		});
	});

	it("should create a Leprechaun Hat", () => {
		withRoot(() => {
			const item = Item.fromName("Leprechaun Hat");
			expect(item[Raw]).toMatchObject({
				category: -95,
				name: "Leprechaun Hat",
				itemId: "LeprechuanHat",
				stack: 1,
				skipHairDraw: false,
				ignoreHairstyleOffset: true,
				"@_xsi:type": "Hat",
			});
		});
	});

	it("should create a furnace", () => {
		withRoot(() => {
			const item = Item.fromName("Furnace");
			expect(item[Raw]).toMatchObject({
				name: "Furnace",
				itemId: "13",
				stack: 1,
				price: 50,
				parentSheetIndex: 13,
				category: -9,
				boundingBox: {
					X: 0,
					Y: 0,
					Width: 64,
					Height: 64,
					Size: { X: 64, Y: 64 },
					Location: { X: 0, Y: 0 },
				},
				type: "Crafting",
				bigCraftable: true,
				"@_xsi:type": "Object",
			});
		});
	});

	it("should create a WitchBroom", () => {
		withRoot(() => {
			const item = Item.fromName("WitchBroom");
			expect(item[Raw]).toMatchObject({
				name: "WitchBroom",
				itemId: "WitchBroom",
				stack: 1,
				price: 999,
				category: -24,
				type: 6,
				"@_xsi:type": "Furniture",
				defaultSourceRect: {
					X: 192,
					Y: 64,
					Width: 16,
					Height: 48,
					Location: { X: 192, Y: 64 },
					Size: { X: 16, Y: 48 },
				},
			});
		});
	});

	it("should create a Tank Top (M)", () => {
		withRoot(() => {
			const item = Item.fromName("Tank Top (M)");
			expect(item[Raw]).toMatchObject({
				name: "Tank Top (M)",
				itemId: "1129",
				price: 50,
				"@_xsi:type": "Clothing",
			});
		});
	});

	it("should create Polka Dot Shorts", () => {
		withRoot(() => {
			const item = Item.fromName("Polka Dot Shorts");
			expect(item[Raw]).toMatchObject({
				name: "Polka Dot Shorts",
				itemId: "14",
				price: 50,
				"@_xsi:type": "Clothing",
			});
		});
	});

	it("should create Combat Boots", () => {
		withRoot(() => {
			const item = Item.fromName("Combat Boots");
			expect(item[Raw]).toMatchObject({
				name: "Combat Boots",
				itemId: "508",
				indexInColorSheet: 4,
				"@_xsi:type": "Boots",
			});
		});
	});

	it("should create an Advanced Iridium Rod", () => {
		withRoot(() => {
			const item = Item.fromName("Advanced Iridium Rod");
			expect(item[Raw]).toMatchObject({
				name: "Advanced Iridium Rod",
				itemId: "AdvancedIridiumRod",
				category: -99,
				"@_xsi:type": "FishingRod",
			});
		});
	});

	it("should create a Steel Watering Can", () => {
		withRoot(() => {
			const item = Item.fromName("Steel Watering Can");
			expect(item[Raw]).toMatchObject({
				name: "Watering Can",
				itemId: "SteelWateringCan",
				"@_xsi:type": "WateringCan",
			});
		});
	});

	it("should create Banana Wine", () => {
		withRoot(() => {
			const item = Item.fromName("Banana Wine");
			expect(item[Raw]).toMatchObject({
				name: "Banana Wine",
				itemId: "348",
				parentSheetIndex: 123,
				category: -26,
				type: "Basic",
				preserve: "Wine",
				preservedParentSheetIndex: 91,
				color: {
					R: 255,
					G: 230,
					B: 0,
					A: 255,
					PackedValue: 4278249215,
				},
				"@_xsi:type": "ColoredObject",
			});
		});
	});

	it("should create a Ruby Ring", () => {
		withRoot(() => {
			const item = Item.fromName("Ruby Ring");
			expect(item[Raw]).toMatchObject({
				name: "Ruby Ring",
				itemId: "534",
				type: "Ring",
				uniqueID: 1285,
				"@_xsi:type": "Ring",
			});
		});
	});

	it("should create a Return Scepter", () => {
		withRoot(() => {
			const item = Item.fromName("Return Scepter");
			expect(item[Raw]).toMatchObject({
				name: "Return Scepter",
				itemId: "ReturnScepter",
				"@_xsi:type": "Wand",
			});
		});
	});

	it("should create a Fairy Box", () => {
		withRoot(() => {
			const item = Item.fromName("FairyBox");
			expect(item[Raw]).toMatchObject({
				name: "FairyBox",
				itemId: "FairyBox",
				parentSheetIndex: 74,
				"@_xsi:type": "Trinket",
			});
			expect(item[Raw].generationSeed).toBeTypeOf("number");
		});
	});

	it("should create a Mannequin", () => {
		withRoot(() => {
			const item = Item.fromName("MannequinMale");
			expect(item[Raw]).toMatchObject({
				name: "MannequinMale",
				itemId: "MannequinMale",
				"@_xsi:type": "Mannequin",
			});
		});
	});
});
