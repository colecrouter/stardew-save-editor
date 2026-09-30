import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, test } from "vitest";
import { Item } from "$lib/proxies/Item.svelte";
import type { ObjectProxy } from "$lib/proxies/items";
import QualitySelector from "./QualitySelector.svelte";

describe("Quality selector", async () => {
	let item: ObjectProxy;

	beforeEach(() => {
		item = Item.fromName("Blueberry Wine") as ObjectProxy;
	});

	test("Quality selector should display the correct quality", async () => {
		render(QualitySelector, { item });

		const normal = screen.getByTestId("quality-0") as HTMLInputElement;

		expect(normal?.checked).toBe(true);
	});
});
