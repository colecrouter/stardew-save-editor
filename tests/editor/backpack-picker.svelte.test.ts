import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import type { CatalogChoice } from "../../src/lib/editor/item-catalog";
import BackpackItemPicker from "../../src/lib/editor/ui/BackpackItemPicker.svelte";

// Small catalog fixtures isolate browsing from save construction; integration
// tests exercise the same Add callback against the real application session.
const entry = (
	id: string,
	name: string,
	qualifiedId: string,
	kind = "Object",
): CatalogChoice => ({
	id,
	name,
	qualifiedId,
	kind,
	description: `${name} description`,
	visual: undefined,
});
const entries = [
	entry("Hardwood", "Hardwood", "(O)709"),
	entry("Wood", "Wood", "(O)388"),
	entry("Sneakers", "Sneakers", "(B)504", "Boots"),
];

it("searches name and both ID forms, previews without adding, and explicitly adds the catalog identity", async () => {
	const onadd = vi.fn(async () => true);
	const page = render(BackpackItemPicker, { slot: 3, entries, onadd });
	try {
		const search = page.getByRole("searchbox", { name: "Search items" });
		await fireEvent.input(search, { target: { value: "wood" } });
		const results = page.getAllByRole("button", { name: /^Preview / });
		expect(results[0]?.getAttribute("aria-label")).toBe(
			"Preview Wood ((O)388)",
		);
		expect(onadd).not.toHaveBeenCalled();
		await fireEvent.click(
			page.getByRole("button", { name: "Preview Hardwood ((O)709)" }),
		);
		expect(
			within(page.getByRole("region", { name: "Item preview" })).getByRole(
				"heading",
				{ name: "Hardwood" },
			),
		).toBeTruthy();
		expect(onadd).not.toHaveBeenCalled();
		for (const value of ["388", "(O)388"]) {
			await fireEvent.input(search, { target: { value } });
			expect(page.getAllByRole("button", { name: /^Preview / })).toHaveLength(
				1,
			);
			expect(
				within(page.getByRole("region", { name: "Item preview" })).getByRole(
					"heading",
					{ name: "Wood" },
				),
			).toBeTruthy();
		}
		await fireEvent.click(page.getByRole("button", { name: "Add to slot 4" }));
		await waitFor(() => expect(onadd).toHaveBeenCalledWith("Wood"));
	} finally {
		page.unmount();
	}
});

it("keeps later results reachable with pagination and resets the page when filtering", async () => {
	const entries = Array.from({ length: 101 }, (_, index) =>
		entry(
			`item:${index}`,
			`Item ${String(index).padStart(2, "0")}`,
			`(O)${index}`,
		),
	);
	const page = render(BackpackItemPicker, {
		slot: 0,
		entries,
		onadd: async () => true,
	});
	try {
		expect(page.getAllByRole("button", { name: /^Preview / })).toHaveLength(48);
		expect(page.getByText(/1–48 of 101 items/)).toBeTruthy();
		// The next equally sized page must start at its first result, even after
		// the user scrolled the prior page to the bottom.
		const list = page.container.querySelector<HTMLDivElement>(".item-list")!;
		list.scrollTop = 200;
		await fireEvent.click(page.getByRole("button", { name: "Next" }));
		expect(page.getAllByRole("button", { name: /^Preview / })).toHaveLength(48);
		expect(page.getByText(/49–96 of 101 items/)).toBeTruthy();
		expect(list.scrollTop).toBe(0);
		list.scrollTop = 100;
		await fireEvent.input(page.getByRole("searchbox"), {
			target: { value: "Item 00" },
		});
		expect(
			page.getByRole("button", { name: "Preview Item 00 ((O)0)" }),
		).toBeTruthy();
		expect(list.scrollTop).toBe(0);
		expect(
			page.queryByRole("navigation", { name: "Item result pages" }),
		).toBeNull();
	} finally {
		page.unmount();
	}
});

it("filters by real item type, explains empty results, and preserves the preview after a rejected add", async () => {
	const onadd = vi.fn(async () => false);
	const page = render(BackpackItemPicker, {
		slot: 0,
		entries,
		onadd,
		error: "This slot is no longer empty.",
	});
	try {
		const select = page.getByRole("combobox", {
			name: "Item type",
		}) as HTMLSelectElement;
		// Native select binding resolves the selected option in the real browser.
		await fireEvent.change(select, { target: { value: "Boots" } });
		expect(page.getAllByRole("button", { name: /^Preview / })).toHaveLength(1);
		await fireEvent.click(page.getByRole("button", { name: "Add to slot 1" }));
		await waitFor(() => expect(onadd).toHaveBeenCalledWith("Sneakers"));
		expect(page.getByRole("status").textContent).toContain(
			"This slot is no longer empty",
		);
		expect(
			page
				.getByRole("button", { name: "Preview Sneakers ((B)504)" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		await fireEvent.input(page.getByRole("searchbox"), {
			target: { value: "absent item" },
		});
		expect(page.getByText("No items found")).toBeTruthy();
		expect(page.queryByRole("button", { name: "Add to slot 1" })).toBeNull();
		expect(onadd).toHaveBeenCalledTimes(1);
	} finally {
		page.unmount();
	}
});

it("starts a new preview's reading areas at the top while retaining the result list position", async () => {
	const page = render(BackpackItemPicker, {
		slot: 3,
		entries,
		onadd: async () => true,
	});
	try {
		const preview = page.getByRole("region", { name: "Item preview" });
		const firstDescription = within(preview).getByRole("region", {
			name: /description$/,
		});
		const firstTitle = within(preview).getByRole("heading");
		const list = page.container.querySelector(".item-list");
		if (!(list instanceof HTMLElement)) throw new Error("Missing item list");
		// Small catalogs fit without scrolling in a real browser. Constrain this
		// reading surface so the retained position is a real, nonzero scroll offset.
		Object.assign(list.style, {
			height: "40px",
			maxHeight: "40px",
			overflowY: "auto",
		});
		// Short fixture text normally fits in the preview. Force both reading
		// areas to overflow so zero after selection proves a reset from real scroll.
		for (const surface of [firstDescription, firstTitle]) {
			Object.assign(surface.style, {
				height: "1px",
				minHeight: "0",
				maxHeight: "1px",
				padding: "0",
				overflowY: "auto",
			});
		}
		firstDescription.scrollTop = 90;
		firstTitle.scrollTop = 20;
		list.scrollTop = 100;
		expect(firstDescription.scrollTop).toBeGreaterThan(0);
		expect(firstTitle.scrollTop).toBeGreaterThan(0);
		await fireEvent.click(
			page.getByRole("button", { name: "Preview Wood ((O)388)" }),
		);
		expect(
			within(preview).getByRole("region", { name: "Wood description" })
				.scrollTop,
		).toBe(0);
		expect(
			within(preview).getByRole("heading", { name: "Wood" }).scrollTop,
		).toBe(0);
		expect(list.scrollTop).toBe(100);
	} finally {
		page.unmount();
	}
});
