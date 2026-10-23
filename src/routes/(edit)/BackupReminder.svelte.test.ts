import { readFile } from "node:fs/promises";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager, setSaveManagerContext } from "$lib/SaveManager.svelte";
import { setToastManagerContext, ToastManager } from "$lib/ToastManager.svelte";
import editLayout from "./+layout.svelte";
import BackupReminder, { backupReminderSkipped } from "./BackupReminder.svelte";

describe("Backup reminder", () => {
	beforeEach(() => localStorage.clear());

	const show = () => {
		const onconfirm = vi.fn();
		const oncancel = vi.fn();
		render(BackupReminder, {
			filename: "Wookies_450650579",
			onconfirm,
			oncancel,
		});
		return { onconfirm, oncancel };
	};

	test("names the save folder to back up", () => {
		show();
		expect(screen.getByTestId("backup-reminder").textContent).toContain(
			"Wookies_450650579",
		);
	});

	test("downloads only when confirmed", async () => {
		const { onconfirm, oncancel } = show();
		await fireEvent.click(screen.getByTestId("backup-cancel"));
		expect(oncancel).toHaveBeenCalledOnce();
		expect(onconfirm).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByTestId("backup-confirm"));
		expect(onconfirm).toHaveBeenCalledOnce();
		// Still reminds next time unless asked not to
		expect(backupReminderSkipped()).toBe(false);
	});

	test("Escape cancels", async () => {
		const { oncancel } = show();
		await fireEvent.keyDown(window, { key: "Escape" });
		expect(oncancel).toHaveBeenCalledOnce();
	});

	test("'Don't remind me again' is remembered", async () => {
		const { onconfirm } = show();
		await fireEvent.click(screen.getByTestId("backup-dont-remind"));
		await fireEvent.click(screen.getByTestId("backup-confirm"));
		expect(onconfirm).toHaveBeenCalledOnce();
		expect(backupReminderSkipped()).toBe(true);
	});
});

describe("Save button", () => {
	mockIDB();
	beforeEach(() => localStorage.clear());

	/** The editor's layout with a save loaded; downloads are only recorded */
	const renderEditor = async () => {
		let saveManager!: SaveManager;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
		});
		const save = await readFile("tests/TestSave");
		await saveManager.import(new File([save], "Farm_1"));
		const download = vi.spyOn(saveManager, "download").mockResolvedValue();

		const page = render(editLayout, {
			props: {
				children: createRawSnippet(() => ({ render: () => "<div></div>" })),
			},
			context: new Map<unknown, unknown>([
				...setSaveManagerContext(saveManager),
				...setToastManagerContext(new ToastManager()),
			]),
		});
		return { page, download, cleanup };
	};

	test("reminds about backing up before downloading", async () => {
		const { page, download, cleanup } = await renderEditor();
		await fireEvent.click(page.getByTestId("save-button"));
		expect(page.getByTestId("backup-reminder").textContent).toContain("Farm_1");

		await fireEvent.click(page.getByTestId("backup-cancel"));
		expect(page.queryByTestId("backup-reminder")).toBeNull();
		expect(download).not.toHaveBeenCalled();

		await fireEvent.click(page.getByTestId("save-button"));
		await fireEvent.click(page.getByTestId("backup-confirm"));
		expect(page.queryByTestId("backup-reminder")).toBeNull();
		await waitFor(() => expect(download).toHaveBeenCalledOnce());
		cleanup();
	});

	test("downloads straight away once told not to remind again", async () => {
		localStorage.setItem("skipBackupReminder", "true");
		const { page, download, cleanup } = await renderEditor();
		await fireEvent.click(page.getByTestId("save-button"));
		expect(page.queryByTestId("backup-reminder")).toBeNull();
		await waitFor(() => expect(download).toHaveBeenCalledOnce());
		cleanup();
	});
});
