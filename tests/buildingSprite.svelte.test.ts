import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { Raw } from "$lib/proxies";
import type { Building } from "$lib/proxies/Building.svelte";
import BuildingSprite from "../src/routes/(edit)/inventory/BuildingSprite.svelte";

vi.mock("$app/paths", () => ({
	// Match SvelteKit's concatenation with the GitHub Pages base path.
	asset: (file: string) => `/stardew-save-editor${file}`,
}));

describe("BuildingSprite", () => {
	it("separates the deployment base path from the sprite asset path", () => {
		const { container } = render(BuildingSprite, {
			building: {
				[Raw]: { buildingType: "Shipping Bin" },
				name: "Shipping Bin",
			} as Building,
		});
		const sprite = container.querySelector<HTMLElement>(".item");

		expect(sprite?.style.getPropertyValue("--sprite")).toBe(
			'url("/stardew-save-editor/assets/buildings/Shipping Bin.png")',
		);
	});
});
