import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { type Bundle, BundleName } from "$lib/proxies/CommunityBundles.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import BundleCard from "../src/routes/(edit)/bundles/Bundle.svelte";
import JojaBundles from "../src/routes/(edit)/bundles/JojaBundles.svelte";

describe("Community Center bundles", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	const loaded = () => {
		const save = saveManager.save;
		const bundles = save?.communityBundles;
		const cc = save?.locations.find((l) => l[Raw].name === "CommunityCenter");
		if (!save || !bundles || !cc) throw new Error("Save not loaded");
		return { save, bundles, cc };
	};

	const byName = (name: string): Bundle => {
		const bundle = [...loaded().bundles.values()].find((b) => b.name === name);
		if (!bundle) throw new Error(`No ${name} bundle`);
		return bundle;
	};

	/** The bundle's slots in the save's `bundles` */
	const slots = (bundle: Bundle) =>
		loaded().cc[Raw].bundles?.item.find((kv) => kv.key.int === bundle.id)?.value
			.ArrayOfBoolean.boolean;

	const reward = (id: number) =>
		loaded().cc[Raw].bundleRewards?.item.find((kv) => kv.key.int === id)?.value
			.boolean;

	it("completes a bundle like the game does, ticking every slot", () => {
		// Quality Crops needs any 3 of its 4 items
		const bundle = byName("Quality Crops");
		expect(bundle.requiredItemCount).toBeLessThan(bundle.requiredItems.length);
		// The game keeps three slots per item
		expect(slots(bundle)).toHaveLength(bundle.requiredItems.length * 3);

		bundle.complete();
		flushSync();
		expect(bundle.completed).toBe(true);
		expect(bundle.requiredItems.every((i) => i.submitted)).toBe(true);
		expect(slots(bundle)?.every(Boolean)).toBe(true);

		bundle.clear();
		flushSync();
		expect(bundle.completed).toBe(false);
		expect(bundle.requiredItems.some((i) => i.submitted)).toBe(false);
		expect(slots(bundle)?.some(Boolean)).toBe(false);
	});

	it("leaves a finished bundle's reward to collect, and takes it back when cleared", async () => {
		const bundle = byName("Spring Crops");
		expect(reward(bundle.id)).toBe(false);

		bundle.complete();
		flushSync();
		await tick();
		expect(reward(bundle.id)).toBe(true);

		bundle.clear();
		flushSync();
		await tick();
		expect(reward(bundle.id)).toBe(false);
	});

	it("doesn't touch rewards for bundles that didn't change", async () => {
		const spring = byName("Spring Crops");
		const summer = byName("Summer Crops");

		spring.complete();
		flushSync();
		await tick();

		expect(reward(spring.id)).toBe(true);
		expect(reward(summer.id)).toBe(false);
	});

	it("never leaves a reward waiting for the Missing Bundle, which has none", async () => {
		const { bundles } = loaded();
		const missing = bundles.get(BundleName.Missing);
		if (!missing) throw new Error("No Missing Bundle");
		expect(missing.reward?.item).toBeUndefined();

		for (const bundle of bundles.values())
			if (bundle.room === CCRoom.AbandonedJojaMart) bundle.complete();
		flushSync();
		await tick();

		expect(missing.completed).toBe(true);
		expect(reward(BundleName.Missing)).toBe(false);
	});

	it("shows quantities and qualities, and completes from the card button", async () => {
		const bundle = byName("Quality Crops");
		const { container } = render(BundleCard, { bundle });

		const quantities = within(container).getAllByTestId("bundle-item-quantity");
		expect(quantities[0]?.textContent).toBe("5×");
		const star = within(container).getAllByTestId("bundle-item-quality")[0];
		expect(star?.getAttribute("title")).toBe("Gold quality or better");
		expect(within(container).getByTestId("bundle-pick").textContent).toBe(
			"(any 3 of 4)",
		);

		await fireEvent.click(within(container).getByTestId("bundle-toggle"));
		expect(bundle.completed).toBe(true);
		expect(
			within(container).getByTestId("bundle-progress").textContent,
		).toContain(`${bundle.requiredItemCount}/${bundle.requiredItemCount}`);

		await fireEvent.click(within(container).getByTestId("bundle-toggle"));
		expect(bundle.completed).toBe(false);
	});

	it("shows a Vault bundle's price in gold", () => {
		const { container } = render(BundleCard, { bundle: byName("2,500g") });
		expect(
			within(container).getByTestId("bundle-required-items").textContent,
		).toContain("2,500g");
	});

	it("names each item's checkbox after the item", () => {
		const bundle = byName("Quality Crops");
		const { container } = render(BundleCard, { bundle });
		const boxes = within(container).getAllByRole("checkbox", {
			name: / donated$/,
			hidden: true,
		});
		expect(boxes).toHaveLength(bundle.requiredItems.length);
		expect(boxes.map((box) => box.getAttribute("aria-label"))).toContain(
			"Parsnip donated",
		);
	});

	it("only ticks a Joja project once every bundle in its room is done", async () => {
		const { save, bundles } = loaded();
		const { container } = render(JojaBundles, { save, bundles });
		const busRow = container.querySelector('[data-project-name="Bus"]');
		const bus = busRow?.querySelector("input") as HTMLInputElement;

		// One of the four Vault bundles isn't enough
		const vault = [...bundles.values()].filter((b) => b.room === CCRoom.Vault);
		vault[0]?.complete();
		flushSync();
		await tick();
		expect(bus.checked).toBe(false);

		await fireEvent.click(bus);
		expect(vault.every((b) => b.completed)).toBe(true);
		expect(bus.checked).toBe(true);
	});
});
