import { render } from "@testing-library/svelte";
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
});
