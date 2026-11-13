import { render, cleanup } from "@testing-library/svelte";
import type { BeforeNavigate } from "$app/navigation";
import { beforeNavigate } from "$app/navigation";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RootLayout from "../src/routes/+layout.svelte";
import { updated } from "./helpers/navigation-state.svelte";

// The root layout serves both editors, so its deployment handling stays in the default suite.
vi.mock("$app/state", async () => import("./helpers/navigation-state.svelte"));
vi.mock("$app/env", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({ beforeNavigate: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
	updated.current = false;
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// Kit may discover a deployment after the layout has mounted. Invoke its actual
// registered callback repeatedly to ensure it reads current state, not a snapshot.
it("reloads client navigation only after a newer deployment is detected", () => {
	render(RootLayout);
	const navigate = vi.mocked(beforeNavigate).mock.calls[0]?.[0];
	if (!navigate) throw new Error("Root layout did not register beforeNavigate");
	const href = vi
		.spyOn(window.location, "href", "set")
		.mockImplementation(() => {});
	const navigation: BeforeNavigate = {
		type: "goto",
		shallow: false,
		from: null,
		to: {
			url: new URL("http://localhost/stardew-save-editor/inventory"),
			params: {},
			route: { id: "/" },
			scroll: null,
		},
		willUnload: false,
		complete: Promise.resolve(),
		cancel: vi.fn(),
	};

	navigate(navigation);
	expect(href).not.toHaveBeenCalled();
	updated.current = true;
	navigate({ ...navigation, willUnload: true });
	navigate({ ...navigation, to: null });
	expect(href).not.toHaveBeenCalled();
	navigate(navigation);
	expect(href).toHaveBeenCalledExactlyOnceWith(
		"http://localhost/stardew-save-editor/inventory",
	);
});
