import { fireEvent, render } from "@testing-library/svelte";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { saveManager } from "../src/lib/save.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import exp from "node:constants";

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

        await new Promise((resolve) => setTimeout(resolve, 100));

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
        expect(saveManager.save.player.inventory[9].name).toBe("Leek");

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
        const slot = page.getByTestId("item-pants");
        slot.click();

        await new Promise((resolve) => setTimeout(resolve, 100));

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
});
