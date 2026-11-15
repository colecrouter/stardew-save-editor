import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { type BeforeNavigate, beforeNavigate } from "$app/navigation";

import RootLayout from "../src/routes/+layout.svelte";
import { updated } from "./helpers/navigation-state.svelte";

// The root layout serves both editors, so its deployment handling stays in the default suite.
vi.mock("$app/state", () =>
	Promise.resolve(import("./helpers/navigation-state.svelte")),
);
vi.mock("$app/env", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({
	beforeNavigate: vi.fn<typeof import("$app/navigation").beforeNavigate>(),
}));

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
it("reloads client navigation only after a newer deployment is detected", ({
	onTestFinished,
}) => {
	render(RootLayout);
	const navigate = vi.mocked(beforeNavigate).mock.calls[0]?.[0];
	if (!navigate) throw new Error("Root layout did not register beforeNavigate");
	// Location is non-configurable in a browser. Observe and cancel its native
	// navigation event so the real assignment is checked without leaving the test.
	const href = vi.fn<(event: NavigateEvent) => void>((event) =>
		event.preventDefault(),
	);
	window.navigation.addEventListener("navigate", href);
	onTestFinished(() => window.navigation.removeEventListener("navigate", href));
	const navigation: BeforeNavigate = {
		type: "goto",
		shallow: false,
		from: null,
		to: {
			url: new URL("/stardew-save-editor/inventory", window.location.origin),
			params: {},
			route: { id: "/" },
			scroll: null,
		},
		willUnload: false,
		complete: Promise.resolve(),
		cancel: vi.fn<() => void>(),
	};

	navigate(navigation);
	expect(href).not.toHaveBeenCalled();
	updated.current = true;
	navigate({ ...navigation, willUnload: true });
	navigate({ ...navigation, to: null });
	expect(href).not.toHaveBeenCalled();
	navigate(navigation);
	expect(href).toHaveBeenCalledOnce();
	expect(href.mock.calls[0]?.[0].destination.url).toBe(navigation.to?.url.href);
});
