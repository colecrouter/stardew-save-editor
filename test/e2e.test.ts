import { fireEvent, render } from "@testing-library/svelte";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { saveManager } from "../src/lib/save.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import { tick } from "svelte";

describe("Upload save, edit, export", () => {
    beforeAll(async () => {
        vi.spyOn(window, "alert").mockImplementation((m) =>
            console.log(`[alert]: ${m}`),
        );

        const file = await readFile("test/TestSave");
        expect(file).toBeDefined();

        await saveManager.import(new File([file], "TestSave"));
        expect(saveManager.save).toBeDefined();
    });

    it("should edit the save file", async () => {
        // Select an empty slot
        const page = render(editorPage);
        const slot = page.getByTestId("item-9");
        slot.click();

        await tick();

        // Create a new item
        const inputElement = page.getByTestId("item-name");
        if (!(inputElement instanceof HTMLInputElement)) {
            throw new Error("Input not found");
        }
        fireEvent.input(inputElement, { target: { value: "Leek" } });

        const createButton = page.getByTestId("create-item");
        createButton.click();

        // Ensure the item was created
        expect(saveManager.save).toBeDefined();
        expect(saveManager.save.player.inventory.getItem(9).name).toBe("Leek");

        // Save the file
        // Not checking anything yet, just making sure it completes
        const save = saveManager.export();
        expect(save).toBeTruthy();
    });

    it("should modify exp values", async () => {
        const page = render(characterPage);
        const reference = [
            ["farming", 0],
            ["mining", 3],
            ["combat", 4],
            ["foraging", 2],
            ["fishing", 1],
        ] as const;
        const inputs = reference.map(
            ([name, index]) =>
                [page.getByTestId(`skills-${name}`), index] as const,
        );

        for (const [input, index] of inputs) {
            if (!(input instanceof HTMLInputElement)) {
                throw new Error("Input not found");
            }
            fireEvent.input(input, { target: { value: index } });
            expect(saveManager.save?.player.skills.raw[index]).toBe(index);
        }
        const save = saveManager.export();
        expect(save).toBeTruthy();
    });

    it("should show color picker for dyeable clothing", async () => {
        const page = render(editorPage);
        const slot = page.getByTestId("item-pantsItem");
        slot.click();

        await tick();

        const colorPicker = page.getByTestId("color-picker");
        expect(colorPicker).toBeTruthy();
    });

    it("should modify crafting recipes", () => {
        // Check beforehand
        // Player should not be able to craft a "Keg" item
        expect(saveManager.save.player.craftingRecipes.recipes.Keg).toBeFalsy();

        const page = render(craftingPage);
        const kegCheckbox = page.getByTestId("recipe-keg");

        // Toggle the checkbox
        kegCheckbox.click();

        // Check after
        expect(
            saveManager.save.player.craftingRecipes.recipes.Keg,
        ).toBeTruthy();
    });

    it("should be able to change character appearance", async () => {
        // Need to change Name, Farm Name, Favourite Thing, Skin, Hair, and Accessory
        // Test before values
        expect(saveManager.save.player.name).toBe("Test");
        expect(saveManager.save.player.farmName).toBe("Test");
        expect(saveManager.save.player.favoriteThing).toBe("Unit Tests");
        expect(saveManager.save.player.skin).toBe(0);
        expect(saveManager.save.player.hairstyle).toBe(112);
        expect(saveManager.save.player.accessory).toBe(25);

        const page = render(appearancePage);
        const reference = [
            ["name", "Test2"],
            ["farmName", "Test2"],
            ["favoriteThing", "Integration Tests"],
            ["skin", 1],
            ["hairstyle", 113],
            ["accessory", 26],
        ] as const;

        const inputs = reference.map(
            ([name, value]) =>
                [page.getByTestId(`appearance-${name}`), value] as const,
        );

        for (const [input, value] of inputs) {
            if (!(input instanceof HTMLInputElement)) {
                throw new Error("Input not found");
            }
            fireEvent.input(input, { target: { value } });
        }

        // Check after values
        for (const [name, value] of reference) {
            expect(saveManager.save.player[name]).toBe(value);
        }

        const save = saveManager.export();
        expect(save).toBeTruthy();
    });

    it("should be able to change item quality", async () => {
        // There is a parsnip in slot 4, change the quality from silver to gold
        const page = render(editorPage);
        const slot = page.getByTestId("item-4");
        slot.click();

        await tick();

        // Ensure item is silver quality
        expect(saveManager.save.player.inventory.getItem(4).quality).toBe(1);

        // Change quality to gold
        const goldButton = page.getByTestId("quality-gold");
        goldButton.click();

        // Ensure item is gold quality
        expect(saveManager.save.player.inventory.getItem(4).quality).toBe(2);
    });

    it("should be able to change item quantity", async () => {
        // Change the quantity of the parsnip in slot 4 from 1 to 5
        const page = render(editorPage);
        const slot = page.getByTestId("item-4");
        slot.click();

        await tick();

        // Ensure item is quantity 1
        expect(saveManager.save.player.inventory.getItem(4).amount).toBe(1);

        // Change quantity to 5
        const inputElement = page.getByTestId("property-amount");
        if (!(inputElement instanceof HTMLInputElement)) {
            throw new Error("Input not found");
        }

        fireEvent.input(inputElement, { target: { value: "5" } });

        // Ensure item is quantity 5
        expect(saveManager.save.player.inventory.getItem(4).amount).toBe(5);
    });
});
