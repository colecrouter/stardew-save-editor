import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, test } from "vitest";

import { Raw } from "$lib/proxies";
import { Item } from "$lib/proxies/Item.svelte";
import { ObjectProxy } from "$lib/proxies/items";

import { requireInstance } from "../../../../../tests/helpers/assertions.ts";
import QualitySelector from "./QualitySelector.svelte";

describe("Quality selector", () => {
	let item: ObjectProxy;

	beforeEach(() => {
		item = requireInstance(Item.fromName("Blueberry Wine"), ObjectProxy);
	});

	test("Quality selector should display the correct quality", () => {
		render(QualitySelector, { item });

		const normal = requireInstance(
			screen.getByTestId("quality-0"),
			HTMLInputElement,
		);

		expect(normal?.checked).toBe(true);
	});

	test("Changing quality keeps the saved base price and edibility", async () => {
		const parsnip = requireInstance(Item.fromName("Parsnip"), ObjectProxy);
		render(QualitySelector, { item: parsnip });
		expect(parsnip.price).toBe(35);
		expect(parsnip.edibility).toBe(10);

		await fireEvent.click(screen.getByTestId("quality-4"));
		flushSync();

		expect(parsnip.quality).toBe(4);
		expect(parsnip[Raw].quality).toBe(4);
		// The game applies the quality itself when the item is sold or eaten
		expect(parsnip[Raw].price).toBe(35);
		expect(parsnip[Raw].edibility).toBe(10);
	});
});
