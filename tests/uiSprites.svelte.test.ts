import { fireEvent, render, screen } from "@testing-library/svelte";
import { imageDimensionsFromData } from "image-dimensions";
import { expect, it } from "vitest";

import {
	dialogueFrame,
	uiAtlases,
	uiIconAtlases,
	uiIcons,
} from "$lib/ui/uiAssets";

import { requireInstance } from "./helpers/assertions.ts";
import Harness from "./helpers/PixelFrameHarness.svelte";

// Enumerated atlas keys are still checked before indexing the correlated icon table.
const isUiIcon = (name: string): name is keyof typeof uiIcons =>
	Object.hasOwn(uiIcons, name);

it("sprite definitions match the shipped atlas dimensions and stay in bounds", async () => {
	for (const spec of Object.values(uiAtlases)) {
		// Read the shipped image through the browser rather than a Node filesystem
		// API. The decoder also reports format; this contract checks dimensions.
		expect(
			imageDimensionsFromData(
				new Uint8Array(await (await fetch(`/${spec.path}`)).arrayBuffer()),
			),
		).toMatchObject({ width: spec.width, height: spec.height });
	}
	for (const [rectangles, atlas] of [
		[dialogueFrame, uiAtlases.menu],
		...Object.entries(uiIcons).map(([name, rect]) => {
			expect.assert(isUiIcon(name), "Expected an enumerated UI icon key");
			return [[rect], uiAtlases[uiIconAtlases[name]]] as const;
		}),
	] as const) {
		for (const rect of rectangles) {
			expect(rect.x).toBeGreaterThanOrEqual(0);
			expect(rect.y).toBeGreaterThanOrEqual(0);
			expect(rect.width).toBeGreaterThan(0);
			expect(rect.height).toBeGreaterThan(0);
			expect(rect.x + rect.width).toBeLessThanOrEqual(atlas.width);
			expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
		}
	}
});

it("changing decoration preserves a partially typed input and meaningful icon names", async () => {
	render(Harness);
	const input = requireInstance(
		screen.getByRole("spinbutton", {
			name: "Quantity",
		}),
		HTMLInputElement,
	);
	await fireEvent.input(input, { target: { value: "2" } });
	await fireEvent.click(screen.getByRole("button", { name: "Toggle frame" }));
	const retained = screen.getByRole("spinbutton", { name: "Quantity" });
	// A value below the minimum lives in the editing interaction, not the save.
	// Swapping decorative chrome must not recreate that interaction and erase it.
	expect(retained).toBe(input);
	expect(input.value).toBe("2");
	expect(screen.getAllByRole("img")).toHaveLength(1);
	expect(screen.getByRole("img", { name: "Inventory icon" })).toBeTruthy();
});
