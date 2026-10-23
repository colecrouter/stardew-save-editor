import { render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import GiftIcon from "../src/routes/(edit)/relationships/GiftIcon.svelte";
import { trackItems } from "./helpers/trackItems";

const diamond = { name: "Diamond", item: "Diamond" };
const emerald = { name: "Emerald", item: "Emerald" };

describe("Gift icon", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("draws the item and names it in a tooltip", () => {
		const page = render(GiftIcon, { gift: diamond, testId: "gift" });
		const icon = page.getByTestId("gift");
		expect(icon.getAttribute("aria-label")).toBe("Diamond");
		expect(icon.querySelector("svg image")).toBeTruthy();
		expect(
			page.getByRole("tooltip", { hidden: true }).textContent?.trim(),
		).toBe("Diamond");
	});

	it("names a whole category next to its icon", () => {
		const books = {
			name: "Any book",
			item: "Animal Catalogue",
			items: ["Animal Catalogue", "Monster Compendium"],
		};
		const page = render(GiftIcon, { gift: books, testId: "gift" });
		expect(
			page.getByRole("tooltip", { hidden: true }).textContent?.trim(),
		).toBe("Any book");
		const label = page.getByText("Any book", { selector: "small" });
		expect(label.getAttribute("title")).toBe(
			"Animal Catalogue, Monster Compendium",
		);
	});

	it("disposes its item when the gift changes and when it's removed", async () => {
		const created = trackItems();
		const page = render(GiftIcon, { gift: diamond, testId: "gift" });
		expect(created).toEqual([{ name: "Diamond", disposed: 0 }]);

		await page.rerender({ gift: emerald });
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 0 },
		]);
		expect(page.getByTestId("gift").getAttribute("aria-label")).toBe("Emerald");

		page.unmount();
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 1 },
		]);
	});
});
