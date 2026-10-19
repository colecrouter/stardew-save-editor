import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import Toasts from "../src/lib/ui/Toasts.svelte";

describe("Toasts", () => {
	it("renders a live region before any toast, so screen readers announce them", () => {
		const manager = new ToastManager();
		const page = render(Toasts, { context: setToastManagerContext(manager) });
		const region = page.getByRole("status");
		expect(region.getAttribute("aria-live")).toBe("polite");
		expect(region.classList.contains("toasts")).toBe(true);
	});
});
