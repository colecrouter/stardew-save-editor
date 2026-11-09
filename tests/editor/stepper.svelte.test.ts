import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";
import { readAppearances } from "../../src/lib/editor/appearance-operations.ts";
import StepperHarness from "./StepperHarness.svelte";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";

it(
	"makes browsing discrete while preserving native typing and bounded imported values",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { skin: 0 });
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(StepperHarness, { model: opened.model });
		try {
			const input = page.getByRole("spinbutton", {
				name: "Skin",
			}) as HTMLInputElement;
			const previous = page.getByRole("button", {
				name: "Previous Skin",
			}) as HTMLButtonElement;
			const next = page.getByRole("button", {
				name: "Next Skin",
			}) as HTMLButtonElement;
			expect(previous.disabled).toBe(true);
			await fireEvent.click(next);
			await waitFor(() => expect(input.value).toBe("1"));
			await waitFor(() => expect(next.disabled).toBe(false));
			await fireEvent.click(next);
			await waitFor(() => expect(input.value).toBe("2"));
			await opened.model.edits.endActive();
			expect((await opened.model.snapshot()).entries).toHaveLength(2);
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("1"));
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("0"));
			input.focus();
			await fireEvent.input(input, { target: { value: "3" } });
			await fireEvent.input(input, { target: { value: "4" } });
			input.blur();
			await opened.model.edits.endActive();
			await waitFor(() => expect(input.value).toBe("4"));
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("0"));
			// A replacement blank is local text; browsing must not turn it into zero.
			input.focus();
			await fireEvent.input(input, { target: { value: "" } });
			await fireEvent.click(next);
			await opened.model.edits.endActive();
			expect((await opened.model.snapshot()).cursor).toBe(0);
			input.blur();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"ignores repeated pending activation and disables browsing at the upper bound",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { skin: 22 });
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(exportDocument(document)),
		);
		const realEdit = opened.model.commands.edit;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const edit = vi
			.spyOn(opened.model.commands, "edit")
			.mockImplementationOnce(async (program, gesture) => {
				await gate;
				return realEdit(program, gesture);
			});
		const page = render(StepperHarness, { model: opened.model });
		try {
			const input = page.getByRole("spinbutton", {
				name: "Skin",
			}) as HTMLInputElement;
			const next = page.getByRole("button", {
				name: "Next Skin",
			}) as HTMLButtonElement;
			await fireEvent.click(next);
			expect(next.disabled).toBe(true);
			await fireEvent.click(next);
			expect(edit).toHaveBeenCalledTimes(1);
			release();
			await waitFor(() => expect(input.value).toBe("23"));
			expect(next.disabled).toBe(true);
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
		} finally {
			release();
			edit.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"keeps imported indices visible and editable without silently normalizing them",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { skin: 99 });
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(StepperHarness, { model: opened.model });
		try {
			const input = page.getByRole("spinbutton", {
				name: "Skin",
			}) as HTMLInputElement;
			expect(input.value).toBe("99");
			expect(input.disabled).toBe(false);
			for (const name of ["Previous Skin", "Next Skin"])
				expect(
					(page.getByRole("button", { name }) as HTMLButtonElement).disabled,
				).toBe(true);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it(
	"applies an opposite arrow even when queued typing returns to the stale descriptor value",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { skin: 10 });
		const opened = await openEditor(
			SaveProcessingSync,
			new TextEncoder().encode(exportDocument(document)),
		);
		const realEdit = opened.model.commands.edit;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		// The engine accepts typing first, but its callback/publication is delayed.
		// This recreates a visible11 with a captured field descriptor still at10.
		const edit = vi
			.spyOn(opened.model.commands, "edit")
			.mockImplementationOnce(async (program, gesture) => {
				const result = await realEdit(program, gesture);
				await gate;
				return result;
			});
		const page = render(StepperHarness, {
			model: opened.model,
			holdPublication: true,
		});
		try {
			const input = page.getByRole("spinbutton", {
				name: "Skin",
			}) as HTMLInputElement;
			input.focus();
			await fireEvent.input(input, { target: { value: "11" } });
			await waitFor(() => expect(input.value).toBe("11"));
			await opened.model.snapshot();
			await fireEvent.click(
				page.getByRole("button", { name: "Previous Skin" }),
			);
			await waitFor(async () =>
				expect(
					readAppearances(
						(await opened.model.snapshot()).document,
					)[0]?.numbers.find((field) => field.key === "skin")?.value,
				).toBe(10),
			);
			release();
			await page.rerender({ model: opened.model, holdPublication: false });
			await waitFor(() => expect(input.value).toBe("10"));
			expect((await opened.model.snapshot()).entries).toHaveLength(2);
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("11"));
			await opened.model.commands.undo();
			await waitFor(() => expect(input.value).toBe("10"));
		} finally {
			release();
			edit.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);
