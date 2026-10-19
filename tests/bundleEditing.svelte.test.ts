import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	canHaveQuality,
	ingredientChoices,
	ingredientKind,
	ingredientName,
	MAX_BUNDLE_ITEMS,
} from "$lib/bundleIngredients";
import { Raw } from "$lib/proxies";
import {
	parseBundleValue,
	serializeBundleValue,
} from "$lib/proxies/bundleSerialization";
import { Bundle } from "$lib/proxies/CommunityBundles.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import type { BoolArrayContainer, StringContainer } from "$types/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import BundleCard from "../src/routes/(edit)/bundles/Bundle.svelte";

/** A bundle on its own, with its data as the save holds it */
const makeBundle = (key: string, value: string, slots?: boolean[]) => {
	const bundleData: StringContainer = { string: value };
	const bundleKey: StringContainer = { string: key };
	const count = parseBundleValue(value).requirements.length;
	const submitted: BoolArrayContainer = {
		boolean: slots ?? new Array(count * 3).fill(false),
	};
	let bundle!: Bundle;
	const dispose = $effect.root(() => {
		bundle = new Bundle(bundleData, bundleKey, submitted);
	});
	flushSync();
	return { bundle, bundleData, submitted, dispose };
};

const springCrops =
	"Spring Crops/O 465 20/24 1 0 188 1 0 190 1 0 192 1 0/0///Spring Crops";
const qualityCrops =
	"Quality Crops/BO 15 1/24 5 2 254 5 2 276 5 2 270 5 2/6/3//Quality Crops";
const vault = "2,500g/O 220 3/-1 2500 2500/4///2,500g";

/** The bundle data entries in a save's XML, by key */
const bundleData = (xml: string) => {
	const section = xml.slice(
		xml.indexOf("<bundleData>"),
		xml.indexOf("</bundleData>"),
	);
	return new Map(
		[
			...section.matchAll(
				/<key>\s*<string>(.*?)<\/string>\s*<\/key>\s*<value>\s*<string>(.*?)<\/string>/gs,
			),
		].map(([, key, value]) => [String(key), String(value)]),
	);
};

/** The Community Center's slots in a save's XML, by bundle index */
const bundleSlots = (xml: string) => {
	const section = xml.slice(
		xml.indexOf("<bundles>"),
		xml.indexOf("</bundles>"),
	);
	return new Map(
		[
			...section.matchAll(
				/<int>(\d+)<\/int>\s*<\/key>\s*<value>\s*<ArrayOfBoolean>(.*?)<\/ArrayOfBoolean>/gs,
			),
		].map(([, key, slots]) => [Number(key), String(slots)]),
	);
};

describe("Bundle data", () => {
	it("serializes every bundle in a save back to exactly what it was", async () => {
		const xml = (await readFile("tests/TestSave")).toString("utf-8");
		const values = [...bundleData(xml).values()];
		expect(values.length).toBe(31);
		for (const value of values)
			expect(serializeBundleValue(parseBundleValue(value))).toBe(value);
	});

	it("keeps remixed bundles' fields, qualified IDs and odd qualities", () => {
		// BundleGenerator writes quality 3 for "IQ", and the sprite field is filled in
		const remixed =
			"Rare Crops/BO 25 1/454 1 0 (O)417 1 3 -75 5 2/1/2/RareCrops/Rare Crops";
		expect(serializeBundleValue(parseBundleValue(remixed))).toBe(remixed);

		const { bundle, bundleData, dispose } = makeBundle("Pantry/3", remixed);
		expect(bundle.requiredItems.map((i) => i.kind)).toEqual([
			"item",
			"item",
			"category",
		]);
		expect(bundle.requiredItems[1]?.quality).toBe(3);
		const first = bundle.requiredItems[0];
		if (!first) throw new Error("No items");
		first.quantity = 2;
		expect(bundleData.string).toBe(
			"Rare Crops/BO 25 1/454 2 0 (O)417 1 3 -75 5 2/1/2/RareCrops/Rare Crops",
		);
		dispose();
	});
});

describe("Ingredients", () => {
	it("tells items, categories and gold apart", () => {
		expect(ingredientKind("24")).toBe("item");
		expect(ingredientKind("(O)24")).toBe("item");
		expect(ingredientKind("SummerSquash")).toBe("item");
		expect(ingredientKind("-5")).toBe("category");
		expect(ingredientKind("-1")).toBe("gold");
		expect(ingredientKind("SomeModItem")).toBe("unknown");
		expect(ingredientName("-5")).toBe("Any Egg");
		expect(ingredientName("-79")).toBe("Any Fruit");
		expect(ingredientName("(O)24")).toBe("Parsnip");
	});

	it("only lets items that can have a quality ask for one", () => {
		expect(canHaveQuality("24")).toBe(true); // Parsnip
		expect(canHaveQuality("-5")).toBe(true); // Any egg
		expect(canHaveQuality("72")).toBe(false); // Diamond
		expect(canHaveQuality("-2")).toBe(false); // Any gem
		expect(canHaveQuality("SomeModItem")).toBe(true);
	});

	it("offers objects by ID, not litter or flavored variants", () => {
		const ids = new Set(ingredientChoices.map((c) => c.id));
		expect(ids.has("24")).toBe(true);
		expect(ids.has("-5")).toBe(true);
		expect(ids.has("0")).toBe(false); // Weeds
		expect(ids.has("-1")).toBe(false); // Gold
		// White and brown large eggs share a name
		const names = ingredientChoices.map((c) => c.name);
		expect(names).toContain("Large Egg (174)");
		expect(names).toContain("Large Egg (182)");
		expect(new Set(ingredientChoices.map((c) => c.id)).size).toBe(
			ingredientChoices.length,
		);
	});
});

describe("Editing a bundle's items", () => {
	it("swaps an item, and changes how many and how good", () => {
		const { bundle, bundleData, submitted, dispose } = makeBundle(
			"Pantry/0",
			springCrops,
		);
		const [parsnip, beans] = bundle.requiredItems;
		if (!parsnip || !beans) throw new Error("No items");
		parsnip.submitted = true;

		beans.itemID = "SummerSquash";
		parsnip.quantity = 5;
		parsnip.quality = 2;
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/24 5 2 SummerSquash 1 0 190 1 0 192 1 0/0///Spring Crops",
		);
		// The donated item is still donated
		expect(submitted.boolean.slice(0, 4)).toEqual([true, false, false, false]);

		// A Diamond never has a quality, so the slot asks for any
		parsnip.itemID = 72;
		expect(parsnip.quality).toBe(0);
		expect(() => (parsnip.quality = 1)).toThrow("never has a quality");
		expect(() => (parsnip.quality = 3)).toThrow("isn't a quality");
		expect(() => (parsnip.quantity = 0)).toThrow("1 to 999");
		expect(() => (parsnip.quantity = 1000)).toThrow("1 to 999");
		expect(() => (parsnip.itemID = "Two Words")).toThrow("can't be");
		expect(() => (parsnip.itemID = "a/b")).toThrow("can't be");
		expect(() => (parsnip.itemID = -1)).toThrow("Vault");
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/72 5 0 SummerSquash 1 0 190 1 0 192 1 0/0///Spring Crops",
		);
		dispose();
	});

	it("adds items with a slot each, keeping what's donated", () => {
		const { bundle, bundleData, submitted, dispose } = makeBundle(
			"Pantry/0",
			springCrops,
		);
		const third = bundle.requiredItems[2];
		if (third) third.submitted = true;

		const added = bundle.addItem("-5", 2, 1);
		expect(added.submitted).toBe(false);
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/24 1 0 188 1 0 190 1 0 192 1 0 -5 2 1/0///Spring Crops",
		);
		// Three slots per item, as the game makes them
		expect(submitted.boolean).toEqual([
			false,
			false,
			true,
			false,
			false,
			...new Array(10).fill(false),
		]);
		// A blank count still means every item
		expect(bundle.requiredItemCount).toBe(5);
		expect(bundle.completed).toBe(false);
		dispose();
	});

	it("keeps a finished bundle finished when an item is added", () => {
		const { bundle, submitted, dispose } = makeBundle("Pantry/0", springCrops);
		bundle.complete();
		expect(submitted.boolean.every(Boolean)).toBe(true);

		bundle.addItem("20");
		expect(bundle.completed).toBe(true);
		expect(submitted.boolean).toEqual(new Array(15).fill(true));
		dispose();
	});

	it("removes an item, moving the later items' slots up", () => {
		const { bundle, bundleData, submitted, dispose } = makeBundle(
			"Pantry/0",
			springCrops,
		);
		const items = bundle.requiredItems;
		if (items[0]) items[0].submitted = true;
		if (items[3]) items[3].submitted = true;

		bundle.removeItem(1);
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/24 1 0 190 1 0 192 1 0/0///Spring Crops",
		);
		expect(submitted.boolean).toEqual([
			true,
			false,
			true,
			...new Array(6).fill(false),
		]);
		dispose();
	});

	it("won't finish or un-finish a bundle by removing an item", () => {
		const { bundle, dispose } = makeBundle("Pantry/0", springCrops);
		for (const item of bundle.requiredItems.slice(0, 3)) item.submitted = true;
		// The rest are donated, so taking away the last one would finish it
		expect(bundle.removeItemProblem(3)).toContain("would finish");
		expect(() => bundle.removeItem(3)).toThrow("would finish");
		expect(bundle.removeItemProblem(0)).toBeUndefined();
		dispose();

		const pick = makeBundle("Pantry/3", qualityCrops);
		const quality = pick.bundle;
		for (const item of quality.requiredItems.slice(0, 3)) item.submitted = true;
		expect(quality.completed).toBe(true);
		// Three of four are needed, and only three are donated
		expect(quality.removeItemProblem(0)).toContain("unfinished");
		expect(quality.removeItemProblem(3)).toBeUndefined();
		quality.removeItem(3);
		expect(pick.bundleData.string).toBe(
			"Quality Crops/BO 15 1/24 5 2 254 5 2 276 5 2/6/3//Quality Crops",
		);
		expect(quality.completed).toBe(true);
		pick.dispose();

		const one = makeBundle("Pantry/0", "One/O 465 20/24 1 0/0///One");
		expect(() => one.bundle.removeItem(0)).toThrow("at least one item");
		one.dispose();
	});

	it("changes how many items are needed, from 1 to every item", () => {
		const { bundle, bundleData, dispose } = makeBundle("Pantry/0", springCrops);
		expect(() => bundle.setRequiredItemCount(0)).toThrow("1 to 4");
		expect(() => bundle.setRequiredItemCount(5)).toThrow("1 to 4");
		expect(() => bundle.setRequiredItemCount(2.5)).toThrow("1 to 4");

		// Asking for every item keeps the count blank
		bundle.setRequiredItemCount(4);
		expect(bundleData.string).toBe(springCrops);

		bundle.setRequiredItemCount(2);
		expect(bundle.requiredItemCount).toBe(2);
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/24 1 0 188 1 0 190 1 0 192 1 0/0/2//Spring Crops",
		);

		// Removing items never leaves it needing more than it has
		bundle.removeItem(3);
		bundle.removeItem(2);
		expect(() => bundle.removeItem(1)).not.toThrow();
		expect(bundle.requiredItemCount).toBe(1);
		dispose();
	});

	it("won't finish or un-finish a bundle by changing how many are needed", () => {
		const { bundle, dispose } = makeBundle("Pantry/0", springCrops);
		for (const item of bundle.requiredItems.slice(0, 2)) item.submitted = true;
		expect(bundle.requiredItemCountProblem(2)).toContain("would finish");
		expect(bundle.requiredItemCountProblem(3)).toBeUndefined();
		bundle.setRequiredItemCount(3);
		const third = bundle.requiredItems[2];
		if (third) third.submitted = true;
		expect(bundle.completed).toBe(true);
		expect(bundle.requiredItemCountProblem(4)).toContain("unfinished");
		dispose();
	});

	it("ticks the rest of a bundle's slots only while it's finished", () => {
		const { bundle, submitted, dispose } = makeBundle("Pantry/0", springCrops);
		for (const item of bundle.requiredItems) item.submitted = true;
		expect(submitted.boolean).toEqual(new Array(12).fill(true));

		const first = bundle.requiredItems[0];
		if (!first) throw new Error("No items");
		first.submitted = false;
		expect(submitted.boolean).toEqual([
			false,
			true,
			true,
			true,
			...new Array(8).fill(false),
		]);
		dispose();
	});

	it("leaves a bundle's slots alone until it's edited", () => {
		// A Vault bundle bought in-game has only its first slot ticked
		const { bundle, submitted, bundleData, dispose } = makeBundle(
			"Vault/23",
			vault,
			[true, false, false],
		);
		expect(bundle.completed).toBe(true);
		expect(submitted.boolean).toEqual([true, false, false]);
		expect(bundleData.string).toBe(vault);
		dispose();
	});

	it("caps a bundle at the 12 items the bundle menu can show", () => {
		const { bundle, dispose } = makeBundle("Pantry/0", springCrops);
		while (bundle.requiredItems.length < MAX_BUNDLE_ITEMS) bundle.addItem("24");
		expect(bundle.addItemProblem("24")).toContain("more than 12");
		expect(() => bundle.addItem("24")).toThrow("more than 12");
		dispose();
	});
});

describe("Editing a Vault bundle", () => {
	it("only changes the price, and renames the bundle after it", () => {
		const { bundle, bundleData, submitted, dispose } = makeBundle(
			"Vault/23",
			vault,
			[true, false, false],
		);
		expect(bundle.isVault).toBe(true);
		expect(bundle.price).toBe(2500);

		bundle.price = 3000;
		expect(bundleData.string).toBe("3,000g/O 220 3/-1 3000 3000/4///3,000g");
		expect(bundle.name).toBe("3,000g");
		expect(bundle.completed).toBe(true);
		expect(submitted.boolean).toEqual([true, false, false]);

		expect(() => (bundle.price = 0)).toThrow("1 to 2,147,483,647");
		expect(() => bundle.addItem("24")).toThrow("bought with gold");
		expect(() => bundle.removeItem(0)).toThrow("bought with gold");
		expect(() => bundle.setRequiredItemCount(1)).toThrow("bought with gold");
		const gold = bundle.requiredItems[0];
		if (!gold) throw new Error("No gold");
		expect(() => (gold.itemID = 24)).toThrow("bought with gold");
		expect(() => (gold.quality = 0)).toThrow("no quality");
		dispose();
	});
});

describe("Editing bundles in a save", () => {
	mockIDB();

	const load = async () => {
		const xml = (await readFile("tests/TestSave")).toString("utf-8");
		let saveManager!: SaveManager;
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([xml], "TestSave"));
		});
		await promise;
		flushSync();
		const bundles = saveManager.save?.communityBundles;
		if (!saveManager.save || !bundles) throw new Error("Save not loaded");
		const byName = (name: string) => {
			const bundle = [...bundles.values()].find((b) => b.name === name);
			if (!bundle) throw new Error(`No ${name} bundle`);
			return bundle;
		};
		return { xml, saveManager, save: saveManager.save, byName, cleanup };
	};

	it("exports only the edited bundle differently", async () => {
		const { xml, saveManager, byName, cleanup } = await load();
		const spring = byName("Spring Crops");
		const parsnip = spring.requiredItems[0];
		if (!parsnip) throw new Error("No Parsnip");
		parsnip.itemID = 20;
		spring.addItem("-5", 3, 2);
		flushSync();

		const exported = await (await saveManager.export(true)).text();
		const before = bundleData(xml);
		const after = bundleData(exported);
		expect([...after.keys()]).toEqual([...before.keys()]);
		for (const [key, value] of before) {
			if (key === "Pantry/0") continue;
			expect(after.get(key)).toBe(value);
		}
		expect(after.get("Pantry/0")).toBe(
			"Spring Crops/O 465 20/20 1 0 188 1 0 190 1 0 192 1 0 -5 3 2/0///Spring Crops",
		);

		const slotsBefore = bundleSlots(xml);
		const slotsAfter = bundleSlots(exported);
		for (const [key, slots] of slotsBefore) {
			if (key === spring.id) continue;
			expect(slotsAfter.get(key)).toBe(slots);
		}
		expect(slotsAfter.get(spring.id)?.match(/<boolean>/g)).toHaveLength(15);
		cleanup();
	});

	it("doesn't change the room's flags when a finished bundle's items change", async () => {
		const { save, byName, cleanup } = await load();
		const pantry = [...(save.communityBundles?.values() ?? [])].filter(
			(b) => b.room === byName("Spring Crops").room,
		);
		for (const bundle of pantry) bundle.complete();
		flushSync();
		await tick();
		expect(save.player.mailReceived.has(MailFlag.ccPantry)).toBe(true);

		const spring = byName("Spring Crops");
		spring.addItem("20");
		spring.removeItem(0);
		const first = spring.requiredItems[0];
		if (first) first.itemID = "SummerSquash";
		flushSync();
		await tick();
		expect(spring.completed).toBe(true);
		expect(save.player.mailReceived.has(MailFlag.ccPantry)).toBe(true);
		const cc = save.locations.find((l) => l[Raw].name === "CommunityCenter");
		expect(cc?.[Raw].areasComplete?.boolean[0]).toBe(true);
		cleanup();
	});

	it("edits the Missing Bundle like any other, still without a reward", async () => {
		const { save, byName, cleanup } = await load();
		const missing = byName("The Missing");
		missing.addItem("20");
		missing.complete();
		flushSync();
		await tick();
		const cc = save.locations.find((l) => l[Raw].name === "CommunityCenter");
		const reward = cc?.[Raw].bundleRewards?.item.find(
			(kv) => kv.key.int === missing.id,
		);
		expect(reward?.value.boolean).toBe(false);
		expect(missing.requiredItems).toHaveLength(7);
		cleanup();
	});
});

describe("The bundle editor", () => {
	const type = async (input: HTMLElement, value: string) => {
		await fireEvent.input(input, { target: { value } });
		await tick();
	};

	const open = async (bundle: Bundle) => {
		const { container } = render(BundleCard, { bundle });
		const card = within(container);
		await fireEvent.click(card.getByTestId("bundle-edit-toggle"));
		expect(card.queryByTestId("bundle-required-items")).toBeNull();
		return card;
	};

	it("changes, adds and removes items", async () => {
		const { bundle, bundleData, dispose } = makeBundle("Pantry/0", springCrops);
		const card = await open(bundle);
		const rows = () => card.getAllByTestId("bundle-edit-row");
		expect(rows()).toHaveLength(4);

		await type(
			card.getAllByTestId("bundle-edit-quantity")[0] as HTMLElement,
			"3",
		);
		const quality = card.getAllByTestId(
			"bundle-edit-quality",
		)[0] as HTMLSelectElement;
		for (const option of quality.options)
			option.selected = option.value === "2";
		await fireEvent.change(quality);
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/24 3 2 188 1 0 190 1 0 192 1 0/0///Spring Crops",
		);

		// Swap the beans for a leek
		await fireEvent.click(
			card.getAllByTestId("bundle-edit-swap")[1] as HTMLElement,
		);
		await type(card.getByTestId("bundle-item-search"), "Leek");
		const leek = card
			.getAllByTestId("bundle-item-choice")
			.find((c) => c.getAttribute("data-item-id") === "20") as HTMLElement;
		await fireEvent.click(leek);
		expect(card.queryByTestId("bundle-item-select")).toBeNull();
		expect(card.getAllByTestId("bundle-edit-name")[1]?.textContent).toBe(
			"Leek",
		);

		// Add any egg
		await fireEvent.click(card.getByTestId("bundle-edit-add"));
		await type(card.getByTestId("bundle-item-search"), "Any Egg");
		await fireEvent.click(
			card
				.getAllByTestId("bundle-item-choice")
				.find((c) => c.getAttribute("data-item-id") === "-5") as HTMLElement,
		);
		expect(rows()).toHaveLength(5);

		await fireEvent.click(
			card.getAllByTestId("bundle-edit-remove")[0] as HTMLElement,
		);
		expect(rows()).toHaveLength(4);
		expect(bundleData.string).toBe(
			"Spring Crops/O 465 20/20 1 0 190 1 0 192 1 0 -5 1 0/0///Spring Crops",
		);

		// Back to the items, as donated
		await fireEvent.click(card.getByTestId("bundle-edit-toggle"));
		expect(card.getAllByTestId("bundle-required-item")).toHaveLength(4);
		dispose();
	});

	it("says why a change can't be made", async () => {
		const { bundle, bundleData, dispose } = makeBundle("Pantry/0", springCrops);
		for (const item of bundle.requiredItems.slice(0, 3)) item.submitted = true;
		const card = await open(bundle);

		await fireEvent.click(
			card.getAllByTestId("bundle-edit-remove")[3] as HTMLElement,
		);
		expect(card.getByTestId("bundle-edit-problem").textContent).toContain(
			"would finish the bundle",
		);
		expect(card.getAllByTestId("bundle-edit-row")).toHaveLength(4);

		const needed = card.getByTestId("bundle-edit-needed") as HTMLInputElement;
		await type(needed, "3");
		expect(card.getByTestId("bundle-edit-problem").textContent).toContain(
			"needing 3 would finish",
		);
		expect(needed.validationMessage).toContain("needing 3 would finish");
		expect(bundleData.string).toBe(springCrops);

		// Diamonds never have a quality
		const quality = () =>
			card.getAllByTestId("bundle-edit-quality")[0] as HTMLSelectElement;
		expect(quality().disabled).toBe(false);
		const first = bundle.requiredItems[0];
		if (first) first.itemID = 72;
		await tick();
		expect(quality().disabled).toBe(true);
		dispose();
	});

	it("only has a price for a Vault bundle", async () => {
		const { bundle, bundleData, dispose } = makeBundle("Vault/23", vault);
		const card = await open(bundle);
		expect(card.queryByTestId("bundle-edit-row")).toBeNull();
		expect(card.queryByTestId("bundle-edit-add")).toBeNull();
		await type(card.getByTestId("bundle-edit-price"), "4000");
		expect(bundleData.string).toBe("4,000g/O 220 3/-1 4000 4000/4///4,000g");
		dispose();
	});
});
