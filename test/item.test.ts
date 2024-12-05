import { describe, expect, it } from "vitest";
import { Item } from "../src/lib/proxies/Item";

/*
    In this file are *known-to-be-correct* tests for the item save data.
    The properties tested for on each item are ones that are confirmed to be required by the game.

    By keeping these tests, we can ensure that code/item creation can be refactored & tweaked, without breaking the core functionality.

    To add a new item test, simply give yourself the item in-game, open the save file, and start
    deleting/commenting out properties until the game crashes.

    Pro-tip: If you're using SMAPI, the game will just boot you back to the title screen instead of crashing.
*/

describe("Item", () => {
    it("should create a Galaxy Sword", () => {
        expect(Item.fromName("Galaxy Sword").raw).toMatchObject({
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

    it("should create an Iridium Sprinkler", () => {
        expect(Item.fromName("Iridium Sprinkler").raw).toMatchObject({
            category: -8,
            name: "Iridium Sprinkler",
            parentSheetIndex: 645,
            itemId: "645",
            stack: 1,
            type: "Crafting", // Required on all BigCraftables
            price: 1000,
            "@_xsi:type": "Object",
        });
    });

    it("should create an auto-grabber", () => {
        expect(Item.fromName("Auto-Grabber").raw).toMatchObject({
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

    it("should create a parsnip", () => {
        expect(Item.fromName("Parsnip").raw).toMatchObject({
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

    it("should create an iridium pickaxe", () => {
        expect(Item.fromName("Iridium Pickaxe").raw).toMatchObject({
            category: -99,
            name: "Pickaxe",
            itemId: "IridiumPickaxe",
            parentSheetIndex: 154,
            indexOfMenuItemView: 180, // Determines which animation sprite to use
            upgradeLevel: 4,
            "@_xsi:type": "Pickaxe",
        });
    });

    it("should create a beach warp totem", () => {
        expect(Item.fromName("Warp Totem: Beach").raw).toMatchObject({
            name: "Warp Totem: Beach",
            itemId: "690",
            stack: 1,
            price: 20,
            parentSheetIndex: 690,
            "@_xsi:type": "Object",
        });
    });

    it("should create a white turban", () => {
        expect(Item.fromName("White Turban").raw).toMatchObject({
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

    it("should create a WizardCatalogue", () => {
        expect(Item.fromName("WizardCatalogue").raw).toMatchObject({
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

    it("should create a Leprechaun Hat", () => {
        expect(Item.fromName("Leprechaun Hat").raw).toMatchObject({
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
