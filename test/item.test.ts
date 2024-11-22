import { describe, expect, it } from "vitest";
import { Item } from "../src/lib/proxies/Item";

describe("Item", () => {
    it("should create a Galaxy Sword item correctly", () => {
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

    it("should create an Iridium Sprinkler item correctly", () => {
        expect(Item.fromName("Iridium Sprinkler").raw).toMatchObject({
            category: -8,
            name: "Iridium Sprinkler",
            parentSheetIndex: 645,
            itemId: "645",
            stack: 1,
            type: "Crafting",
            canBeSetDown: true,
            canBeGrabbed: true,
            price: 1000,
            "@_xsi:type": "Object",
        });
    });

    it("should create an auto-grabber item correctly", () => {
        expect(Item.fromName("Auto-Grabber").raw).toMatchObject({
            name: "Auto-Grabber",
            itemId: "165",
            stack: 1,
            isRecipe: false,
            price: 0,
            parentSheetIndex: 165,
            category: -9,
            boundingBox: {
                X: 0,
                Y: 0,
                Width: 64,
                Height: 64,
                Size: {
                    X: 64,
                    Y: 64,
                },
                Location: {
                    X: 0,
                    Y: 0,
                },
            },
            type: "Crafting",
            bigCraftable: true,
            "@_xsi:type": "Object",
        });
    });
});
