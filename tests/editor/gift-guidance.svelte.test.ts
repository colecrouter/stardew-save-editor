import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import generatedGifts from "../../generated/gifttastes.json";
import { ItemData } from "../../src/lib/ItemData";
import {
	relationshipGifts,
	relationshipMatches,
} from "../../src/lib/editor/relationship-gifts";
import { buildingConstructionCost } from "../../src/lib/editor/building-costs";
import RelationshipGifts from "../../src/lib/editor/ui/RelationshipGifts.svelte";

describe("catalog guidance in the editor", () => {
	it("retains villager exceptions and searches members of grouped gifts", () => {
		const names = (name: string) =>
			relationshipGifts(name).universalLoves.map((gift) => gift.name);
		expect(names("Abigail")).toContain("Prismatic Shard");
		expect(names("Haley")).not.toContain("Prismatic Shard");
		expect(names("Penny")).not.toContain("Rabbit's Foot");
		expect(names("Penny")).toContain("Stardrop Tea");
		expect(relationshipMatches("Penny", "  monster compendium  ")).toBe(true);
		expect(relationshipMatches("Abigail", "diamond")).toBe(false);
		expect(relationshipMatches("Modded villager", "modded")).toBe(true);
		expect(relationshipGifts("Another modded villager")).toBe(
			relationshipGifts("Modded villager"),
		);
		expect(relationshipGifts("Modded villager")).toEqual({
			loves: [],
			universalLoves: [],
		});
	});

	it("every generated recommendation resolves against current metadata", () => {
		// Source PR data must remain compatible with this branch's catalog, not
		// merely its older generated iteminfo snapshot.
		for (const tastes of Object.values(generatedGifts)) {
			for (const gift of [...tastes.loves, ...tastes.universalLoves]) {
				expect(ItemData.has(gift.item), gift.item).toBe(true);
			}
		}
	});

	it("offers labeled, keyboard-focusable icons without saved item instances", async () => {
		const page = render(RelationshipGifts, { name: "Abigail" });
		expect(page.getByText("Loves:")).toBeTruthy();
		expect(page.getByText("Universal loves:")).toBeTruthy();
		const amethyst = page.getByRole("button", {
			name: "Amethyst",
		});
		amethyst.focus();
		await fireEvent.focus(amethyst);
		expect(document.activeElement).toBe(amethyst);
		expect(amethyst.getAttribute("tabindex")).not.toBe("-1");
		page.unmount();
	});

	it("keeps construction costs informational and resolves material drawings", () => {
		const shipping = buildingConstructionCost("Shipping Bin");
		expect(shipping?.gold).toBe(250);
		expect(
			shipping?.materials.map(({ name, amount }) => ({ name, amount })),
		).toEqual([{ name: "Wood", amount: 150 }]);
		expect(shipping?.materials.every((material) => material.visual)).toBe(true);
		expect(Object.isFrozen(shipping)).toBe(true);
		expect(buildingConstructionCost("Unknown mod building")).toBeUndefined();
		expect(buildingConstructionCost("Greenhouse")?.gold).toBeUndefined();
	});
});
