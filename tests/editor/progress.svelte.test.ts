import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { renderTestWorkspace } from "./workspace.ts";

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
