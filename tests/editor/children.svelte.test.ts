import { fireEvent, waitFor, within } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { renderTestWorkspace } from "./workspace.ts";
import { childrenFixture } from "./children-fixture.ts";
import { readChildren } from "../../src/lib/editor/children-data.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

it("searches catalog hats, previews a replacement privately and restores focus on Cancel", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		const card = within(page.getByRole("region", { name: "Juniper child" }));
		const trigger = card.getByRole("button", { name: "Edit child" });
		await fireEvent.click(trigger);
		await waitFor(() =>
			expect(document.activeElement).toBe(
				card.getByRole("textbox", { name: "New name for Juniper" }),
			),
		);
		const hats = card.getByRole("combobox", { name: "Hat" });
		await fireEvent.click(hats);
		await fireEvent.input(hats, { target: { value: "no matching hats" } });
		await waitFor(() => expect(page.getByText("No hats found.")).toBeTruthy());
		expect(page.queryByRole("option", { name: /Straw Hat/ })).toBeNull();
		await fireEvent.input(hats, { target: { value: "Straw" } });
		await fireEvent.pointerUp(
			await page.findByRole("option", { name: /Straw Hat/ }),
			{ pointerType: "mouse", button: 0 },
		);
		expect(card.getByRole("combobox", { name: "Hat" })).toHaveProperty(
			"value",
			"Straw Hat",
		);
		expect(
			page
				.getByRole("region", { name: "Juniper child" })
				.querySelector('[data-child-hat="Straw Hat"]'),
		).toBeTruthy();
		expect(
			readChildren((await model.snapshot()).document)[0]?.hat.name,
		).not.toBe("Straw Hat");
		await fireEvent.click(
			card.getByRole("button", { name: "Apply child changes" }),
		);
		await waitFor(async () =>
			expect(readChildren((await model.snapshot()).document)[0]?.hat.name).toBe(
				"Straw Hat",
			),
		);
		expect((await model.snapshot()).entries).toHaveLength(1);
		await fireEvent.click(card.getByRole("button", { name: "Cancel changes" }));
		await waitFor(() =>
			expect(document.activeElement).toBe(
				card.getByRole("button", { name: "Edit child" }),
			),
		);
		await model.commands.undo();
		expect(
			readChildren((await model.snapshot()).document)[0]?.hat.name,
		).not.toBe("Straw Hat");
	} finally {
		await opened.dispose();
	}
}, 30000);

it("previews appearance and age privately, then applies the combined child edit once", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		const card = within(page.getByRole("region", { name: "Juniper child" }));
		await fireEvent.click(card.getByRole("button", { name: "Edit child" }));
		await fireEvent.change(card.getByRole("combobox", { name: "Gender" }), {
			target: { value: "Male" },
		});
		await fireEvent.change(card.getByRole("combobox", { name: "Skin tone" }), {
			target: { value: "light" },
		});
		await fireEvent.change(
			card.getByRole("combobox", { name: "Development stage" }),
			{ target: { value: "1" } },
		);
		expect(
			(card.getByRole("spinbutton", { name: "Days old" }) as HTMLInputElement)
				.value,
		).toBe("13");
		expect(card.getByText("Baby")).toBeTruthy();
		expect(card.getByText("13 days old")).toBeTruthy();
		expect(readChildren((await model.snapshot()).document)[0]).toMatchObject({
			gender: "Female",
			daysOld: 64,
		});
		// An existing hat is removed only through the explicit draft selection.
		await fireEvent.click(card.getByRole("combobox", { name: "Hat" }));
		await fireEvent.pointerUp(
			await page.findByRole("option", { name: /^No hat$/ }),
			{ pointerType: "mouse", button: 0 },
		);
		expect(
			page
				.getByRole("region", { name: "Juniper child" })
				.querySelector("[data-child-hat]"),
		).toBeNull();
		expect(card.queryByText("Unknown item")).toBeNull();
		await fireEvent.click(
			card.getByRole("button", { name: "Apply child changes" }),
		);
		await waitFor(async () =>
			expect(readChildren((await model.snapshot()).document)[0]).toMatchObject({
				gender: "Male",
				darkSkinned: false,
				daysOld: 13,
				stage: 1,
				hat: { present: false },
			}),
		);
		expect((await model.snapshot()).entries).toHaveLength(1);
		await model.commands.undo();
		expect(readChildren((await model.snapshot()).document)[0]).toMatchObject({
			gender: "Female",
			darkSkinned: true,
			daysOld: 64,
			hat: { present: true },
		});
	} finally {
		await opened.dispose();
	}
}, 30000);

it("retains a private rename draft across relationship tabs", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		await fireEvent.click(
			within(page.getByRole("region", { name: "Juniper child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		const input = page.getByRole("textbox", {
			name: "New name for Juniper",
		}) as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "Hazel" } });
		await fireEvent.click(page.getByRole("tab", { name: "Friendships" }));
		expect(
			page.queryByRole("textbox", { name: "New name for Juniper" }),
		).toBeNull();
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		expect(page.getByRole("textbox", { name: "New name for Juniper" })).toBe(
			input,
		);
		expect(input.value).toBe("Hazel");
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
	}
}, 30000);

it("explains an empty Children tab without presenting rename controls", async () => {
	const opened = await renderTestWorkspace(
		tinyEditorFixture(),
		"Relationships",
	);
	try {
		await fireEvent.click(
			opened.page.getByRole("tab", { name: "Children (0)" }),
		);
		expect(opened.page.getByText("No children in this save")).toBeTruthy();
		expect(
			opened.page.queryByRole("button", { name: "Edit child" }),
		).toBeNull();
	} finally {
		await opened.dispose();
	}
}, 30000);

it("keeps typing private, applies one rename, and restores it with Undo/Redo", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		await fireEvent.click(
			within(page.getByRole("region", { name: "Juniper child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		const input = page.getByRole("textbox", { name: "New name for Juniper" });
		await fireEvent.input(input, { target: { value: "Hazel" } });
		expect(readChildren((await model.snapshot()).document)[0]?.name).toBe(
			"Juniper",
		);
		await fireEvent.submit(input.closest("form")!);
		await waitFor(() =>
			expect(page.getByRole("textbox", { name: "New name for Hazel" })).toBe(
				input,
			),
		);
		expect((await model.snapshot()).entries).toHaveLength(1);
		await model.commands.undo();
		await waitFor(() =>
			expect(
				page.getByRole("textbox", { name: "New name for Juniper" }),
			).toBeTruthy(),
		);
		await model.commands.redo();
		await waitFor(() =>
			expect(
				page.getByRole("textbox", { name: "New name for Hazel" }),
			).toBeTruthy(),
		);
	} finally {
		await opened.dispose();
	}
}, 30000);

it("retains a rejected name for correction and lets Cancel abandon the draft", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		await fireEvent.click(
			within(page.getByRole("region", { name: "Juniper child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		const input = page.getByRole("textbox", {
			name: "New name for Juniper",
		}) as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "Rowan" } });
		await fireEvent.submit(input.closest("form")!);
		await waitFor(() =>
			expect(
				input.closest("form")?.querySelector('[role="status"]')?.textContent,
			).toContain("already identifies"),
		);
		expect(input.value).toBe("Rowan");
		expect((await model.snapshot()).entries).toHaveLength(0);
		await fireEvent.click(page.getByRole("button", { name: "Cancel changes" }));
		await fireEvent.click(
			within(page.getByRole("region", { name: "Juniper child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		expect(
			(
				page.getByRole("textbox", {
					name: "New name for Juniper",
				}) as HTMLInputElement
			).value,
		).toBe("Juniper");
	} finally {
		await opened.dispose();
	}
}, 30000);

it("rejects a draft after another edit rather than refreshing its captured revision", async () => {
	const opened = await renderTestWorkspace(childrenFixture(), "Relationships");
	try {
		const { page, model } = opened;
		await fireEvent.click(page.getByRole("tab", { name: "Children (2)" }));
		await fireEvent.click(
			within(page.getByRole("region", { name: "Juniper child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		await fireEvent.click(
			within(page.getByRole("region", { name: "Rowan child" })).getByRole(
				"button",
				{ name: "Edit child" },
			),
		);
		const first = page.getByRole("textbox", { name: "New name for Juniper" });
		const second = page.getByRole("textbox", { name: "New name for Rowan" });
		await fireEvent.input(first, { target: { value: "Hazel" } });
		await fireEvent.input(second, { target: { value: "Willow" } });
		await fireEvent.submit(second.closest("form")!);
		// The queued edit and shared publication must settle before testing the
		// other draft's conflict. This is a correctness check, not a 1s latency budget.
		expect(
			await page.findByRole(
				"textbox",
				{ name: "New name for Willow" },
				{ timeout: 10000 },
			),
		).toBe(second);
		await fireEvent.submit(first.closest("form")!);
		await waitFor(
			() =>
				expect(
					first.closest("form")?.querySelector('[role="status"]')?.textContent,
				).toBeTruthy(),
			{ timeout: 10000 },
		);
		expect(
			readChildren((await model.snapshot()).document).map(
				(child) => child.name,
			),
		).toEqual(["Juniper", "Willow"]);
		expect((await model.snapshot()).entries).toHaveLength(1);
	} finally {
		await opened.dispose();
	}
}, 30000);
