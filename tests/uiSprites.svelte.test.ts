import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { imageDimensionsFromData } from "image-dimensions";
import { expect, it } from "vitest";
import {
	dialogueFrame,
	uiAtlases,
	uiIcons,
	uiIconAtlases,
} from "$lib/ui/uiAssets";
import Harness from "./helpers/PixelFrameHarness.svelte";

it("sprite definitions match the shipped atlas dimensions and stay in bounds", () => {
	for (const spec of Object.values(uiAtlases)) {
		expect(imageDimensionsFromData(readFileSync(`static${spec.path}`))).toEqual(
			{ width: spec.width, height: spec.height },
		);
	}
	for (const [rectangles, atlas] of [
		[dialogueFrame, uiAtlases.menu],
		...Object.entries(uiIcons).map(
			([name, rect]) =>
				[
					[rect],
					uiAtlases[uiIconAtlases[name as keyof typeof uiIcons]],
				] as const,
		),
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
	const input = screen.getByRole("spinbutton", {
		name: "Quantity",
	}) as HTMLInputElement;
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
