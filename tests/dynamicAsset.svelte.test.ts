import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { asset } from "$app/paths";
import VillagerPortrait from "$lib/editor/ui/VillagerPortrait.svelte";
import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";

vi.mock("$app/paths", () => ({
	// Keep the real generated manifest, but exercise a non-root deployment URL.
	asset: vi.fn<(path: string) => string>(
		(path: string) => `/stardew-save-editor/${path}`,
	),
}));

beforeEach(() => vi.clearAllMocks());

describe("runtime asset references", () => {
	it.each([
		"/assets/buildings/Big Barn.png",
		"assets/buildings/Big%20Barn.png",
	])("resolves an installed sheet from %s", (reference) => {
		expect(dynamicAsset(reference)).toBe(
			"/stardew-save-editor/assets/buildings/Big Barn.png",
		);
		expect(asset).toHaveBeenCalledWith("assets/buildings/Big Barn.png");
	});

	it.each([
		"assets/portraits/Unknown Modded Villager.png",
		"assets/portraits/%ZZ.png",
	])("keeps an unavailable reference absent: %s", (reference) => {
		expect(dynamicAsset(reference)).toBeUndefined();
		expect(asset).not.toHaveBeenCalled();
	});

	it("shows an unknown villager's initial without requesting a guessed image", () => {
		const { container } = render(VillagerPortrait, {
			name: "Unknown Modded Villager",
		});
		expect(screen.getByText("U")).toBeTruthy();
		expect(container.querySelector("img")).toBeNull();
	});
});
