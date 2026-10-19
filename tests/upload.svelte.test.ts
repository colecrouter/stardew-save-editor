import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	SaveManager,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import uploadPage from "../src/routes/(home)/(upload)/+page.svelte";

const renderUploadPage = () => {
	let saveManager!: SaveManager;
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
	});
	const toastManager = new ToastManager();
	const context = new Map<unknown, unknown>([
		...setSaveManagerContext(saveManager),
		...setToastManagerContext(toastManager),
	]);
	const page = render(uploadPage, { context });
	return { page, toastManager, cleanup };
};

describe("Upload page", () => {
	mockIDB();

	it("says how to choose a save in the drop zone", () => {
		const { page, cleanup } = renderUploadPage();
		expect(page.getByLabelText("Save file").getAttribute("type")).toBe("file");
		expect(page.getByTestId("upload-hint").textContent?.trim()).toBe(
			"Click to select a file, or drag and drop here",
		);
		cleanup();
	});

	it("reports a file that looks compressed but isn't, and lets you pick another", async () => {
		const { page, toastManager, cleanup } = renderUploadPage();

		// A first byte of 0x78 ("x") marks a zlib-compressed save; pako throws a string
		const file = new File(["xyz, not a save"], "Farm_1");
		const input = page.getByLabelText("Save file") as HTMLInputElement;
		const transfer = new DataTransfer();
		transfer.items.add(file);
		input.files = transfer.files;
		await fireEvent.change(input);

		await waitFor(() => expect(toastManager.toasts).toHaveLength(1));
		expect(toastManager.toasts[0]?.icon).toBe("❌");
		expect(toastManager.toasts[0]?.message).toBeTruthy();
		await waitFor(() => expect(input.disabled).toBe(false));
		expect(page.getByTestId("upload-hint").textContent).not.toContain(
			"Uploading",
		);
		cleanup();
	});
});
