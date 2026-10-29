import { expect, it, vi } from "vitest";
import * as catalog from "../../src/lib/ItemData";
import {
	readItemPresentation,
	readItemVisual,
} from "../../src/lib/editor/item-presentation";

const metadata = (name: string) => {
	const value = catalog.ItemData.get(name);
	if (!value) throw new Error(`Missing fixture metadata: ${name}`);
	return value;
};

it("projects plain rendering and editing descriptions without exposing saved records", () => {
	const raw = Object.freeze({
		"@_xsi:type": "Object",
		itemId: "390",
		name: "Stone",
		quality: 2,
		stack: 20,
		category: -8,
		bigCraftable: false,
		modData: Object.freeze({ opaque: "kept" }),
	});
	const view = readItemPresentation(raw);
	expect(view.name).toBe("Stone");
	expect(view.visual?.quality).toBe(2);
	expect(view.visual?.sheet).toBe("springobjects.png");
	expect(view).not.toHaveProperty("raw");
	expect(structuredClone(view)).toEqual(view);
	// The representation contains plain instructions, never a Sprite instance
	// whose methods or catalog references would cross the UI boundary.
	expect(view.visual).not.toHaveProperty("sprite");
});

it("keeps clothing dye masks and colored-object overlays in domain drawing instructions", () => {
	const color = { R: 12, G: 34, B: 56, A: 255 };
	const shirt = readItemVisual(
		{ "@_xsi:type": "Clothing", clothesColor: color },
		metadata("Basic Pullover (M)"),
	);
	expect(shirt?.layers).toHaveLength(2);
	expect(shirt?.layers[1]?.tint).toEqual([12, 34, 56, 255]);
	expect(shirt?.layers[1]?.rect.x).toBe(
		(shirt?.sourceRect.x ?? 0) + (shirt?.sheetSize.width ?? 0) / 2,
	);
	const pants = readItemVisual(
		{ "@_xsi:type": "Clothing", clothesColor: color },
		metadata("Polka Dot Shorts"),
	);
	expect(pants?.layers).toHaveLength(1);
	expect(pants?.layers[0]?.tint).toEqual([12, 34, 56, 255]);
	const colored = readItemVisual({
		"@_xsi:type": "ColoredObject",
		itemId: "390",
		name: "Stone",
		color,
	});
	expect(colored?.layers).toHaveLength(2);
	expect(colored?.layers[1]?.tint).toEqual([12, 34, 56, 255]);
});

it("uses the ingredient sprite for smoked fish and preserves an explicit unknown fallback", () => {
	const raw = {
		"@_xsi:type": "Object",
		itemId: "SmokedFish",
		name: "Smoked Fish",
		preservedParentSheetIndex: "128",
		bigCraftable: false,
	};
	const fish = readItemVisual(raw);
	expect(fish?.layers).toHaveLength(2);
	expect(fish?.layers[1]?.tint).toEqual([80, 30, 10, 153]);
	expect(
		readItemVisual({ ...raw, preservedParentSheetIndex: "mod.unknown" }),
	).toBeUndefined();
});

it("rejects malformed catalog inputs as unavailable while preserving genuine lookup defects", () => {
	expect(
		readItemPresentation({ itemId: {}, name: { opaque: "kept" } }).visual,
	).toBeUndefined();
	const lookup = vi.spyOn(catalog, "ResolveItemData").mockImplementation(() => {
		throw new Error("catalog defect");
	});
	try {
		expect(() =>
			readItemPresentation({ itemId: "390", name: "Stone" }),
		).toThrow("catalog defect");
	} finally {
		lookup.mockRestore();
	}
});
