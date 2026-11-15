import { cleanup, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goto } from "$app/navigation";

import Router from "../src/routes/(legacy)/(edit)/Router.svelte";
import BackupsLayout from "../src/routes/(legacy)/(home)/(backups)/backups/+layout.svelte";
import {
	deployment,
	page,
	saveManager,
	updated,
} from "./helpers/navigation-state.svelte";

// These mocks replace Kit's browser runtime, while rune-backed page state keeps
// its relevant reactive contract. Render the real layouts and sidebar below.
vi.mock("$app/state", () =>
	Promise.resolve(import("./helpers/navigation-state.svelte")),
);
vi.mock("$app/env", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({
	beforeNavigate: vi.fn<typeof import("$app/navigation").beforeNavigate>(),
	goto: vi
		.fn<typeof import("$app/navigation").goto>()
		.mockResolvedValue(undefined),
}));
vi.mock("$lib/SaveManager.svelte", async () => {
	const { saveManager: candidateSaveManager } =
		await import("./helpers/navigation-state.svelte");
	return { getSaveManager: () => candidateSaveManager };
});
vi.mock("$app/paths", async () => {
	const { deployment: candidateDeployment } =
		await import("./helpers/navigation-state.svelte");
	return {
		resolve: (path: string) => `${candidateDeployment.base}/${path}`,
		asset: (path: string) => `${candidateDeployment.base}/${path}`,
	};
});

beforeEach(() => {
	vi.clearAllMocks();
	deployment.base = "/stardew-save-editor";
	page.url = new URL("http://localhost/stardew-save-editor/backups");
	page.route.id = "/";
	updated.current = false;
	saveManager.save = undefined;
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe.each(["", "/stardew-save-editor"])(
	"legacy navigation with base %j",
	(base) => {
		it.each(["/", ""])(
			"redirects a loaded save only when navigation reaches home with suffix %j",
			(suffix) => {
				deployment.base = base;
				saveManager.save = { raw: {} };
				page.url = new URL(`http://localhost${base}/backups`);
				render(BackupsLayout);
				expect(goto).not.toHaveBeenCalled();

				// Arriving home must rerun the effect without remounting the layout.
				flushSync(() => {
					page.url = new URL(`http://localhost${base}${suffix}`);
				});
				expect(goto).toHaveBeenCalledExactlyOnceWith(`${base}/inventory`);
			},
		);

		it("waits for a loaded save before redirecting from home", () => {
			deployment.base = base;
			page.url = new URL(`http://localhost${base}/`);
			render(BackupsLayout);
			expect(goto).not.toHaveBeenCalled();
			flushSync(() => {
				saveManager.save = { raw: {} };
			});
			expect(goto).toHaveBeenCalledExactlyOnceWith(`${base}/inventory`);
		});

		it("updates the active sidebar link and mobile title after navigation", () => {
			deployment.base = base;
			page.url = new URL(`http://localhost${base}/inventory`);
			const view = render(Router);
			expect(
				view
					.getAllByRole("link", { name: "Inventory" })
					.every((link) => link.getAttribute("aria-current") === "page"),
			).toBe(true);

			// The component stays mounted as Kit publishes a new URL; both navigation
			// presentations must follow it and clear the old section's active marker.
			flushSync(() => {
				page.url = new URL(`http://localhost${base}/character`);
			});
			expect(
				view
					.getAllByRole("link", { name: "Character" })
					.every((link) => link.getAttribute("aria-current") === "page"),
			).toBe(true);
			expect(
				view
					.getAllByRole("link", { name: "Inventory" })
					.every((link) => !link.hasAttribute("aria-current")),
			).toBe(true);
			expect(view.container.querySelector("summary span")?.textContent).toBe(
				"Character",
			);
		});
	},
);
