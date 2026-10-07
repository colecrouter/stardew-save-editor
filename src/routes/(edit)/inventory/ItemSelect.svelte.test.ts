import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, test, vi } from "vitest";
import ItemSelect from "./ItemSelect.svelte";

const search = async (value: string) => {
	const input = screen.getByTestId("item-name") as HTMLInputElement;
	await fireEvent.input(input, { target: { value } });
	await tick();
};

const resultNames = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLButtonElement>("button.item")].map(
		(button) => button.textContent?.trim() ?? "",
	);

describe("Item select", () => {
	test("only lists items whose name contains the search text", async () => {
		const { container } = render(ItemSelect, { onsubmit: () => {} });

		await search("ring");

		const names = resultNames(container);
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			expect(name.toLowerCase()).toContain("ring");
		}
	});

	test("ranks an exact match first", async () => {
		const { container } = render(ItemSelect, { onsubmit: () => {} });

		await search("Leek");

		expect(resultNames(container)[0]).toBe("Leek");
	});

	test("caps the results at 50", async () => {
		const { container } = render(ItemSelect, { onsubmit: () => {} });

		await search("a");

		expect(resultNames(container)).toHaveLength(50);
	});

	test("shows a message when nothing matches", async () => {
		const { container } = render(ItemSelect, { onsubmit: () => {} });

		await search("zzzznotanitem");

		expect(resultNames(container)).toHaveLength(0);
		expect(screen.getByText("No items found")).toBeTruthy();
	});

	test("submits the clicked item", async () => {
		const onsubmit = vi.fn();
		render(ItemSelect, { onsubmit });

		await search("Leek");
		await fireEvent.click(screen.getByText("Leek"));

		expect(onsubmit).toHaveBeenCalledWith("Leek");
	});

	test("the list scrolls when results overflow it", async () => {
		const { container } = render(ItemSelect, { onsubmit: () => {} });

		await search("a");

		const list = container.querySelector<HTMLElement>(".list");
		const rows = container.querySelectorAll<HTMLElement>("button.item");
		const firstRow = rows[0];
		if (!list) throw new Error("list not rendered");
		if (!firstRow) throw new Error("no rows rendered");

		const listStyle = getComputedStyle(list);
		const rowStyle = getComputedStyle(firstRow);
		expect(listStyle.overflowY).toBe("auto");
		// Rows must not shrink to fit, otherwise they squish instead of scrolling
		expect(rowStyle.flexShrink).toBe("0");

		// happy-dom has no layout engine, so compare the CSS sizes directly
		const maxHeight = Number.parseFloat(listStyle.maxHeight);
		const rowHeight = Number.parseFloat(rowStyle.minHeight);
		const gap = Number.parseFloat(listStyle.rowGap || listStyle.gap);
		const contentHeight = rows.length * rowHeight + (rows.length - 1) * gap;
		expect(maxHeight).toBeGreaterThan(0);
		expect(contentHeight).toBeGreaterThan(maxHeight);
	});
});
