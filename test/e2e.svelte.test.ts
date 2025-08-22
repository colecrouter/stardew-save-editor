import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	SaveManager,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
// import editorPage from "../src/routes/(edit)/inventory/+page.svelte";

describe("Save Manager Integration Tests", () => {
	// Wrap in a root effect so we can initialize the SaveManager
	$effect.root(() => {
		mockIDB(); // Mock IndexedDB for testing
		const saveManager = new SaveManager();
		saveManager.init();

		const renderWithContext = ((component, options) =>
			render(component, {
				context: setSaveManagerContext(saveManager),
				...options,
			})) as typeof render;

		// Mock the alert function
		beforeAll(async () => {
			vi.spyOn(window, "alert").mockImplementation((m) =>
				console.log(`[alert]: ${m}`),
			);
		});

		// Reset the save manager before each test
		beforeEach(async () => {
			let promise: Promise<void> = Promise.resolve();
			const file = await readFile("test/TestSave");

			$effect.root(() => {
				promise = saveManager
					.init()
					.then(() => saveManager.import(new File([file], "TestSave")));
			});

			// I don't even know what's going on at this point
			await promise;

			flushSync();
		});

		// describe("Inventory Management", () => {
		//     it("should create and edit items", async () => {
		//         const page = renderWithContext(editorPage);
		//         const slot = page.getByTestId("item-9");
		//         await fireEvent.click(slot);
		//         await tick();

		//         const input = page.getByTestId("item-name") as HTMLInputElement;
		//         await fireEvent.input(input, { target: { value: "Leek" } });
		//         await fireEvent.click(page.getByTestId("create-item"));

		//         expect(saveManager.save.player.inventory.getItem(9).name).toBe(
		//             "Leek",
		//         );
		//     });

		//     it("should modify item quality", async () => {
		//         const page = renderWithContext(editorPage);
		//         await fireEvent.click(page.getByTestId("item-4"));
		//         await tick();

		//         for (const quality of [0, 1, 2, 4]) {
		//             await fireEvent.click(page.getByTestId(`quality-${quality}`));
		//             expect(
		//                 saveManager.save.player.inventory.getItem(4).quality,
		//             ).toBe(quality);
		//         }
		//     });

		//     it("should support drag and drop operations", async () => {
		//         const page = renderWithContext(editorPage);
		//         const draggable = page.getByTestId("draggable-4");
		//         const destination = page.getByTestId("slot-6");

		//         await fireEvent.dragStart(draggable);
		//         await fireEvent.dragEnter(destination);
		//         await fireEvent.dragOver(destination);
		//         await fireEvent.drop(destination);
		//         await fireEvent.dragEnd(draggable);

		//         expect(saveManager.save.player.inventory.getItem(6).name).toBe(
		//             "Parsnip",
		//         );
		//         expect(
		//             saveManager.save.player.inventory.getItem(4),
		//         ).toBeUndefined();
		//     });
		// });

		describe("Character Customization", () => {
			it("should modify character appearance", () => {
				$effect.root(() => {
					const page = renderWithContext(appearancePage);
					const changes = [
						["name", "Test2"],
						["farmName", "Test2"],
						["favoriteThing", "Integration Tests"],
						["skin", 1],
						["hairstyle", 68],
						["accessory", 26],
					] as const;

					for (const [name, value] of changes) {
						const input = page.getByTestId(
							`appearance-${name}`,
						) as HTMLInputElement;
						fireEvent.input(input, { target: { value } });
						expect(saveManager.save.player[name]).toBe(value);
					}
				});
			});
		});
		describe("Skills and Crafting", () => {
			it("should modify experience values", async () => {
				const page = renderWithContext(characterPage);
				const skills = [
					["farming", 0],
					["mining", 3],
					["combat", 4],
					["foraging", 2],
					["fishing", 1],
				] as const;

				for (const [name, value] of skills) {
					const input = page.getByTestId(`skills-${name}`) as HTMLInputElement;
					await fireEvent.input(input, { target: { value } });
					expect(saveManager.save?.player.skills.raw[value]).toBe(value);
				}
			});

			it("should modify crafting recipes", async () => {
				const page = renderWithContext(craftingPage);
				expect(saveManager.save.player.craftingRecipes.get("Keg")).toBeNull();

				await fireEvent.click(page.getByTestId("recipe-keg"));

				expect(
					saveManager.save.player.craftingRecipes.get("Keg"),
				).not.toBeNull();
			});
		});
	});
});
