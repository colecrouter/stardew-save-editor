import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Gender } from "../codegen/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import List from "../src/routes/(legacy)/(edit)/(list)/List.svelte";
import Character from "../src/routes/(legacy)/(edit)/appearance/Character.svelte";
import ItemSelect from "../src/routes/(legacy)/(edit)/inventory/ItemSelect.svelte";
import NamedItemSprite from "../src/routes/(legacy)/(edit)/inventory/NamedItemSprite.svelte";
import { trackItems } from "./helpers/trackItems";

const live = (created: ReturnType<typeof trackItems>) =>
	created.filter((item) => item.disposed === 0).length;

describe("Item sprites drawn by name", () => {
	mockIDB();
	let saveManager!: SaveManager;
	let cleanup: () => void;

	beforeEach(async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		let promise!: Promise<void | boolean>;
		cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([xml], "TestSave"));
		});
		await promise;
		flushSync();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		cleanup();
	});

	const player = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save.player;
	};

	it("disposes its item when the name changes and when it's removed", async () => {
		const created = trackItems();
		const page = render(NamedItemSprite, { name: "Diamond" });
		expect(page.container.querySelector("svg image")).toBeTruthy();
		expect(created).toEqual([{ name: "Diamond", disposed: 0 }]);

		await page.rerender({ name: "Emerald" });
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 0 },
		]);

		page.unmount();
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 1 },
		]);
	});

	it("disposes the recipe list's icons when it closes", () => {
		const created = trackItems();
		const page = render(List, { recipes: player().craftingRecipes });
		const icons = page.container.querySelectorAll(".img").length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes the add-item list's icons as the search changes", async () => {
		const created = trackItems();
		const page = render(ItemSelect, { onsubmit: () => {} });
		const input = page.getByTestId("item-name") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "Leek" } });
		await tick();
		await fireEvent.input(input, { target: { value: "Parsnip" } });
		await tick();
		const icons = page.container.querySelectorAll(".icon").length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes the appearance preview's stand-in clothes", async () => {
		const created = trackItems();
		const farmer = player();
		const page = render(Character, { player: farmer });
		expect(created.map((item) => item.name)).toContain("Polka Dot Shorts");

		farmer.gender = farmer.gender === Gender.Male ? Gender.Female : Gender.Male;
		flushSync();
		const shirts = created.filter((item) =>
			item.name.startsWith("Basic Pullover"),
		);
		expect(shirts.length).toBeGreaterThan(0);
		expect(shirts.filter((item) => item.disposed === 0)).toHaveLength(1);

		page.unmount();
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});
});
