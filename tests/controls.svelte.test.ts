import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Harness from "./helpers/ControlHarness.svelte";

describe("shared control behavior", () => {
	it("pending controls expose busy state and resume normal activation afterward", async () => {
		const onclick = vi.fn();
		const view = render(Harness, { pending: true, onclick });
		const button = screen.getByRole("button", {
			name: "Apply quantity",
		}) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.getAttribute("aria-busy")).toBe("true");
		button.click();
		expect(onclick).not.toHaveBeenCalled();
		await view.rerender({ pending: false });
		expect(button.disabled).toBe(false);
		button.click();
		expect(onclick).toHaveBeenCalledTimes(1);
	});
	it("connects labels, descriptions and errors to the actual input", async () => {
		const view = render(Harness, { onclick: vi.fn() });
		const input = screen.getByRole("spinbutton", { name: "Quantity" });
		const described = () =>
			input
				.getAttribute("aria-describedby")
				?.split(" ")
				.map((id) => document.getElementById(id)?.textContent?.trim());
		expect(described()).toEqual(["Whole items only"]);
		await view.rerender({ error: "Quantity is unavailable" });
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(described()).toEqual([
			"Whole items only",
			"Quantity is unavailable",
		]);
		expect(screen.getByRole("alert").textContent).toBe(
			"Quantity is unavailable",
		);
	});
	it("preserves explicit accessible names and prevents disabled link activation", async () => {
		const onclick = vi.fn();
		render(Harness, { disabled: true, onclick });
		const button = screen.getByRole("button", {
			name: "Apply quantity",
		}) as HTMLButtonElement;
		const link = screen.getByLabelText("Open farm");
		expect(button.disabled).toBe(true);
		expect(link.hasAttribute("href")).toBe(false);
		expect(link.getAttribute("tabindex")).toBe("-1");
		expect(await fireEvent.click(link)).toBe(false);
		expect(onclick).not.toHaveBeenCalled();
	});
});
