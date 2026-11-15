import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import { readAppearances } from "../../src/lib/editor/appearance-operations.ts";
import { requireInstance } from "../helpers/assertions.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { openTestDocument } from "../helpers/open-editor.ts";
import StepperHarness from "./StepperHarness.svelte";

// Skin field behavior depends on its descriptor and history, not a populated
// farm. Keep fixtures small while exercising real browser focus and input order.

it("makes browsing discrete while preserving native typing and bounded imported values", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, { skin: 0 });
	const opened = await openTestDocument(document);
	const page = await render(StepperHarness, { model: opened.model });
	try {
		const input = requireInstance(
			page
				.getByRole("spinbutton", {
					name: "Skin",
				})
				.element(),
			HTMLInputElement,
		);
		const previous = requireInstance(
			page
				.getByRole("button", {
					name: "Previous Skin",
				})
				.element(),
			HTMLButtonElement,
		);
		const next = requireInstance(
			page
				.getByRole("button", {
					name: "Next Skin",
				})
				.element(),
			HTMLButtonElement,
		);
		expect(previous.disabled).toBe(true);
		await userEvent.click(next);
		await expect.element(input).toHaveValue(1);
		await expect.poll(() => next.disabled).toBe(false);
		await userEvent.click(next);
		await expect.element(input).toHaveValue(2);
		await opened.model.edits.endActive();
		expect((await opened.model.snapshot()).entries).toHaveLength(2);
		await opened.model.commands.undo();
		await expect.element(input).toHaveValue(1);
		await opened.model.commands.undo();
		await expect.element(input).toHaveValue(0);
		input.focus();
		await userEvent.fill(input, "3");
		await userEvent.fill(input, "4");
		await userEvent.tab();
		await opened.model.edits.endActive();
		await expect.element(input).toHaveValue(4);
		expect((await opened.model.snapshot()).entries).toHaveLength(1);
		await opened.model.commands.undo();
		await expect.element(input).toHaveValue(0);
		// A replacement blank is local text. Activate without moving focus to
		// exercise the blank guard before native blur restores the saved value.
		input.focus();
		await userEvent.fill(input, "");
		next.click();
		await opened.model.edits.endActive();
		expect((await opened.model.snapshot()).cursor).toBe(0);
		// A real pointer click first blurs the input, restoring committed zero,
		// then advances from that restored value rather than treating blank as zero.
		await userEvent.click(next);
		await opened.model.edits.endActive();
		await expect.element(input).toHaveValue(1);
		expect((await opened.model.snapshot()).cursor).toBe(1);
	} finally {
		await page.unmount();
		await opened.close();
	}
});

it("ignores repeated pending activation and disables browsing at the upper bound", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, { skin: 22 });
	const opened = await openTestDocument(document);
	const realEdit = opened.model.commands.edit;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const edit = vi
		.spyOn(opened.model.commands, "edit")
		.mockImplementationOnce(
			async <E>(...args: Parameters<typeof realEdit<E>>) => {
				await gate;
				return realEdit(...args);
			},
		);
	const page = await render(StepperHarness, { model: opened.model });
	try {
		const input = requireInstance(
			page
				.getByRole("spinbutton", {
					name: "Skin",
				})
				.element(),
			HTMLInputElement,
		);
		const next = requireInstance(
			page
				.getByRole("button", {
					name: "Next Skin",
				})
				.element(),
			HTMLButtonElement,
		);
		await userEvent.click(next);
		expect(next.disabled).toBe(true);
		// A disabled native button ignores activation. The browser driver would
		// wait for it to become enabled, which this test deliberately holds back.
		next.click();
		expect(edit).toHaveBeenCalledTimes(1);
		release();
		await expect.element(input).toHaveValue(23);
		expect(next.disabled).toBe(true);
		expect((await opened.model.snapshot()).entries).toHaveLength(1);
	} finally {
		release();
		edit.mockRestore();
		await page.unmount();
		await opened.close();
	}
});

it("keeps imported indices visible and editable without silently normalizing them", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, { skin: 99 });
	const opened = await openTestDocument(document);
	const page = await render(StepperHarness, { model: opened.model });
	try {
		const input = requireInstance(
			page
				.getByRole("spinbutton", {
					name: "Skin",
				})
				.element(),
			HTMLInputElement,
		);
		expect(input.value).toBe("99");
		expect(input.disabled).toBe(false);
		for (const name of ["Previous Skin", "Next Skin"])
			expect(
				requireInstance(
					page.getByRole("button", { name }).element(),
					HTMLButtonElement,
				).disabled,
			).toBe(true);
		expect((await opened.model.snapshot()).entries).toHaveLength(0);
	} finally {
		await page.unmount();
		await opened.close();
	}
});

it("applies an opposite arrow even when queued typing returns to the stale descriptor value", async () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, { skin: 10 });
	const opened = await openTestDocument(document);
	const realEdit = opened.model.commands.edit;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	// The engine accepts typing first, but its callback/publication is delayed.
	// This recreates a visible11 with a captured field descriptor still at10.
	const edit = vi
		.spyOn(opened.model.commands, "edit")
		.mockImplementationOnce(
			async <E>(...args: Parameters<typeof realEdit<E>>) => {
				const result = await realEdit(...args);
				await gate;
				return result;
			},
		);
	const page = await render(StepperHarness, {
		model: opened.model,
		holdPublication: true,
	});
	try {
		const input = requireInstance(
			page
				.getByRole("spinbutton", {
					name: "Skin",
				})
				.element(),
			HTMLInputElement,
		);
		input.focus();
		await userEvent.fill(input, "11");
		await expect.element(input).toHaveValue(11);
		await opened.model.snapshot();
		await userEvent.click(
			page.getByRole("button", { name: "Previous Skin" }).element(),
		);
		await expect
			.poll(
				async () =>
					readAppearances(
						(await opened.model.snapshot()).document,
					)[0]?.numbers.find((field) => field.key === "skin")?.value,
			)
			.toBe(10);
		release();
		await page.rerender({ model: opened.model, holdPublication: false });
		await expect.element(input).toHaveValue(10);
		expect((await opened.model.snapshot()).entries).toHaveLength(2);
		await opened.model.commands.undo();
		await expect.element(input).toHaveValue(11);
		await opened.model.commands.undo();
		await expect.element(input).toHaveValue(10);
	} finally {
		release();
		edit.mockRestore();
		await page.unmount();
		await opened.close();
	}
});
