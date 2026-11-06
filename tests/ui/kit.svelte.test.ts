import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import KitHarness from "./KitHarness.svelte";

it("preserves native form behavior and prevents pending/disabled button activation", () => {
	const onclick = vi.fn(),
		onsubmit = vi.fn();
	const page = render(KitHarness, { onclick, onsubmit });
	try {
		page.getByRole("button", { name: "Ordinary action" }).click();
		expect(onclick).toHaveBeenCalledOnce();
		expect(onsubmit).not.toHaveBeenCalled();
		page.getByRole("button", { name: "Submit form" }).click();
		expect(onsubmit).toHaveBeenCalledOnce();
		// Native click() honors disabled state, unlike dispatching an arbitrary
		// synthetic event directly to an unavailable element's listener.
		page.getByRole("button", { name: "Pending action" }).click();
		page.getByRole("button", { name: "Disabled action" }).click();
		expect(onclick).toHaveBeenCalledOnce();
		expect(
			page
				.getByRole("button", { name: "Pending action" })
				.getAttribute("aria-busy"),
		).toBe("true");
	} finally {
		page.unmount();
	}
});

it("associates native labels and all feedback with unique controls", () => {
	const page = render(KitHarness, { onclick: vi.fn(), onsubmit: vi.fn() });
	try {
		const farm = page.getByRole("textbox", { name: "Farm name" });
		const farmer = page.getByRole("textbox", { name: "Farmer name" });
		expect(farm.id).not.toBe(farmer.id);
		expect(farm.getAttribute("aria-invalid")).toBe("true");
		const descriptions = farm
			.getAttribute("aria-describedby")
			?.split(" ")
			.map((id) => document.getElementById(id)?.textContent);
		expect(descriptions).toEqual(["Imported farm.", "Enter a name."]);
		expect(farmer.hasAttribute("aria-invalid")).toBe(false);
	} finally {
		page.unmount();
	}
});

it("retains native draft state while inactive panels are excluded from accessibility", async () => {
	const page = render(KitHarness, { onclick: vi.fn(), onsubmit: vi.fn() });
	try {
		const note = page.getByRole("textbox", { name: "Draft note" });
		await fireEvent.input(note, { target: { value: "Uncommitted note" } });
		await fireEvent.click(page.getByRole("tab", { name: "Chests" }));
		await waitFor(() =>
			expect(page.queryByRole("textbox", { name: "Draft note" })).toBeNull(),
		);
		expect(note.isConnected).toBe(true);
		await fireEvent.click(page.getByRole("tab", { name: "Backpack" }));
		await waitFor(() =>
			expect(page.getByRole("textbox", { name: "Draft note" })).toHaveProperty(
				"value",
				"Uncommitted note",
			),
		);
		expect(
			page.getByRole("tab", { name: "Equipment" }).hasAttribute("disabled"),
		).toBe(true);
	} finally {
		page.unmount();
	}
});

it("only announces notices whose owners request live feedback", () => {
	const page = render(KitHarness, { onclick: vi.fn(), onsubmit: vi.fn() });
	try {
		expect(page.getAllByRole("alert")).toHaveLength(1);
		expect(page.getByRole("alert").textContent).toContain("Dynamic failure");
		expect(
			page.getByText("Static notice").closest('[role="alert"]'),
		).toBeNull();
	} finally {
		page.unmount();
	}
});
