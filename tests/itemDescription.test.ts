import { describe, expect, it } from "vitest";
import { ItemData, ItemDescription } from "$lib/ItemData";

describe("item descriptions", () => {
	it("shows the description from the game's data", () => {
		expect(ItemDescription(ItemData.get("Leek"))).toBe(
			"A tasty relative of the onion.",
		);
		// Flavored goods take the product's description
		expect(ItemDescription(ItemData.get("Blueberry Wine"))).toBe(
			"Drink in moderation.",
		);
	});

	it("hides descriptions that can't be shown as-is", () => {
		const leek = ItemData.get("Leek");
		if (!leek) throw new Error("Leek not found");
		expect(
			ItemDescription({
				...leek,
				description: "[LocalizedText Strings\\Objects:Leek_Description]",
			}),
		).toBeUndefined();
		// "A whole {0}, smoked to perfection."
		expect(ItemDescription(ItemData.get("Smoked Salmon"))).toBeUndefined();
		expect(ItemDescription(undefined)).toBeUndefined();
	});
});
