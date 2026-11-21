import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

// Each workspace may persist its default on mount. Keep that browser preference
// from becoming an implicit input to the next scenario.
beforeEach(() =>
	localStorage.removeItem("stardew-editor:hide-progress-spoilers"),
);
afterEach(() =>
	localStorage.removeItem("stardew-editor:hide-progress-spoilers"),
);

it("opens both progress views and navigates to recipe editing without changing the save", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, {
		cookingRecipes: [],
		recipesCooked: [],
		craftingRecipes: [],
	});
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		expect(
			page.getByRole("heading", { name: "Cooking recipes made" }),
		).toBeTruthy();
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		expect(page.getByText("Gourmet Chef")).toBeTruthy();
		await fireEvent.click(page.getByRole("button", { name: "Edit recipes" }));
		expect(page.getByRole("heading", { name: /^Recipes$/ })).toBeTruthy();
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		// Unmount the tab consumers before releasing their file-owned subscriptions.
		await opened.dispose();
	}
});

it("updates completion after an edit and Undo while retaining saved award status", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, {
		cookingRecipes: [{ key: "Fried Egg", value: 0 }],
		recipesCooked: [],
		craftingRecipes: [],
		achievements: [15],
	});
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		const cooking = () =>
			within(
				page.getByRole("region", { name: "Cooking recipes made requirements" }),
			);
		expect(cooking().getByText(/0 \/ 81 complete/)).toBeTruthy();
		await fireEvent.click(page.getByRole("button", { name: "Edit recipes" }));
		await fireEvent.input(
			page.getByRole("spinbutton", { name: "Fried Egg cooked" }),
			{ target: { value: "1" } },
		);
		await fireEvent.click(page.getByRole("link", { name: /^Progress$/ }));
		await model.snapshot();
		await waitFor(() =>
			expect(cooking().getByText(/1 \/ 81 complete/)).toBeTruthy(),
		);
		expect(
			cooking().getByRole("progressbar").getAttribute("aria-valuenow"),
		).toBe("1");
		await model.commands.undo();
		await waitFor(() =>
			expect(cooking().getByText(/0 \/ 81 complete/)).toBeTruthy(),
		);
		expect(
			cooking().getByRole("progressbar").getAttribute("aria-valuenow"),
		).toBe("0");
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Search achievements" }),
			{ target: { value: "Cook 10" } },
		);
		expect(page.getByText("Recorded in save", { selector: "p" })).toBeTruthy();
		expect(page.getByText(/0 \/ 10 — In progress/)).toBeTruthy();
	} finally {
		await opened.dispose();
	}
});

it("keeps achievement searches across tab changes and separates recorded awards from requirement progress", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.achievements = [15];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		expect(
			page
				.getByRole("progressbar", { name: "Recorded achievements" })
				.getAttribute("aria-valuenow"),
		).toBe("1");
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Search achievements" }),
			{ target: { value: "Cook 10" } },
		);
		expect(page.getByRole("heading", { name: /^Cook$/ })).toBeTruthy();
		await waitFor(() =>
			expect(page.queryByRole("heading", { name: "Gourmet Chef" })).toBeNull(),
		);
		await fireEvent.click(page.getByRole("tab", { name: "Perfection" }));
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		expect(
			page.getByRole("searchbox", { name: "Search achievements" }),
		).toHaveProperty("value", "Cook 10");
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
	}
});

it("explains historical-only festival evidence instead of showing an invented score", async () => {
	const document = tinyEditorFixture();
	document.SaveGame.player.achievements = [];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Search achievements" }),
			{ target: { value: "Blue Ribbon" } },
		);
		expect(page.getByRole("heading", { name: "Blue Ribbon" })).toBeTruthy();
		expect(
			page.getByText("Unable to determine", { selector: "p" }),
		).toBeTruthy();
		expect(
			page.getByText(/festival result has no independent saved score/),
		).toBeTruthy();
	} finally {
		await opened.dispose();
	}
});

it("hides spoilers by default while retaining totals and allowing an explicit opt-out", async () => {
	localStorage.removeItem("stardew-editor:hide-progress-spoilers");
	const document = tinyEditorFixture();
	document.SaveGame.player.achievements = [36];
	const opened = await renderTestWorkspace(document, "Progress");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		expect(page.queryByRole("heading", { name: "A Distant Shore" })).toBeNull();
		expect(
			page.getByRole("checkbox", { name: "Hide spoilers" }),
		).toHaveProperty("checked", true);
		expect(page.getByRole("heading", { name: "Two Thumbs Up" })).toBeTruthy();
		expect(
			page
				.getByRole("progressbar", { name: "Recorded achievements" })
				.getAttribute("aria-valuenow"),
		).toBe("1");
		expect(localStorage.getItem("stardew-editor:hide-progress-spoilers")).toBe(
			"true",
		);
		await fireEvent.input(
			page.getByRole("searchbox", { name: "Search achievements" }),
			{ target: { value: "Ginger Island" } },
		);
		expect(
			page.getByRole("heading", {
				name: "No achievements match these filters.",
			}),
		).toBeTruthy();
		await fireEvent.click(
			page.getByRole("checkbox", { name: "Hide spoilers" }),
		);
		expect(page.getByRole("heading", { name: "A Distant Shore" })).toBeTruthy();
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
		localStorage.removeItem("stardew-editor:hide-progress-spoilers");
	}
});

it.each(["true", "false", "invalid"])(
	"restores spoiler preference %s for a new editor session",
	async (preference) => {
		localStorage.setItem("stardew-editor:hide-progress-spoilers", preference);
		const document = tinyEditorFixture();
		document.SaveGame.player.achievements = [];
		const opened = await renderTestWorkspace(document, "Progress");
		try {
			const { page } = opened;
			const hidden = preference !== "false";
			expect(
				page.getByRole("checkbox", { name: "Hide spoilers" }),
			).toHaveProperty("checked", hidden);
			expect(
				page.getByRole("heading", { name: "Cooking recipes made" }),
			).toBeTruthy();
			await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
			expect(
				page.queryAllByRole("heading", { name: "A Distant Shore" }),
			).toHaveLength(hidden ? 0 : 1);
			expect(
				page.queryAllByRole("heading", { name: "Hidden achievement" }),
			).toHaveLength(hidden ? 5 : 0);
		} finally {
			await opened.dispose();
		}
	},
);

it("reads the saved spoiler preference before inserting any Progress markup", async () => {
	localStorage.setItem("stardew-editor:hide-progress-spoilers", "true");
	// oxlint-disable-next-line typescript/unbound-method -- The spy preserves the native Storage receiver with .call below.
	const originalGetItem = Storage.prototype.getItem;
	const markupAtRead: boolean[] = [];
	const readPreference = vi
		.spyOn(Storage.prototype, "getItem")
		.mockImplementation(function (this: Storage, key: string) {
			if (key === "stardew-editor:hide-progress-spoilers") {
				// Observing only the settled UI would miss an onMount reveal-and-hide.
				// Capture whether Progress already exists at the instant storage is read.
				markupAtRead.push(
					window.document.querySelector('[aria-label="Progress views"]') !==
						null,
				);
			}
			return originalGetItem.call(this, key);
		});
	let opened: Awaited<ReturnType<typeof renderTestWorkspace>> | undefined;
	try {
		opened = await renderTestWorkspace(tinyEditorFixture(), "Progress");
		expect(markupAtRead.length).toBeGreaterThan(0);
		expect(markupAtRead).not.toContain(true);
		expect(
			opened.page.getByRole("checkbox", { name: "Hide spoilers" }),
		).toHaveProperty("checked", true);
	} finally {
		await opened?.dispose();
		readPreference.mockRestore();
		localStorage.removeItem("stardew-editor:hide-progress-spoilers");
	}
});

it("keeps spoilers hidden and the session usable when browser storage is blocked", async () => {
	// Denial must cover reads as well as writes. A failed initial read must not
	// prevent Progress from mounting, and a failed write must not lock its toggle.
	const denied = () => {
		throw new DOMException("Storage denied", "SecurityError");
	};
	const read = vi
		.spyOn(Storage.prototype, "getItem")
		.mockImplementation(denied);
	const write = vi
		.spyOn(Storage.prototype, "setItem")
		.mockImplementation(denied);
	const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
	let opened: Awaited<ReturnType<typeof renderTestWorkspace>> | undefined;
	try {
		opened = await renderTestWorkspace(tinyEditorFixture(), "Progress");
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Achievements" }));
		expect(
			page.getByRole("checkbox", { name: "Hide spoilers" }),
		).toHaveProperty("checked", true);
		expect(page.queryByRole("heading", { name: "A Distant Shore" })).toBeNull();
		await fireEvent.click(
			page.getByRole("checkbox", { name: "Hide spoilers" }),
		);
		expect(page.getByRole("heading", { name: "A Distant Shore" })).toBeTruthy();
		expect((await model.snapshot()).entries).toHaveLength(0);
		expect(warning).toHaveBeenCalledWith(
			"Failed to persist spoiler preference.",
			expect.any(DOMException),
		);
	} finally {
		await opened?.dispose();
		read.mockRestore();
		write.mockRestore();
		warning.mockRestore();
	}
});
