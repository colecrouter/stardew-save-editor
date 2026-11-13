import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import {
	SaveManager,
	SaveValidationError,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import editLayout from "../src/routes/(legacy)/(edit)/+layout.svelte";
import uploadPage from "../src/routes/(legacy)/(home)/(upload)/legacy/+page.svelte";
import { fullSaveTimeout } from "./helpers/full-save-budget";

// Legacy routes navigate after upload; exercise their UI without starting Kit navigation.
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

async function importSave(xml: string): Promise<SaveManager> {
	let saveManager!: SaveManager;
	let promise: Promise<void | boolean> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([xml], "TestSave"));
	});
	await promise;
	flushSync();
	cleanup();
	return saveManager;
}

// Full-file worker import/export needs an integration budget under parallel load.
describe("SaveManager validation", { timeout: 30_000 }, () => {
	mockIDB();
	let saveManager: SaveManager;

	// Full-file setup has its own deadline, independent of test-body options.
	beforeEach(async () => {
		saveManager = await importSave(await readFile("tests/TestSave", "utf-8"));
	}, fullSaveTimeout);

	it("validates a save when it's uploaded", () => {
		expect(saveManager.loadValidation).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("validates exactly what would be downloaded", async () => {
		const { blob, validation } = await saveManager.validatedExport();
		expect(blob.size).toBeGreaterThan(0);
		expect(validation.valid).toBe(true);
	});

	it("refuses to download a save that fails validation", async () => {
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = 2 ** 31;

		const error = await saveManager.download().catch((e) => e);
		// Vitest 5 requires an assertion signature to narrow the caught error.
		expect.assert(error instanceof SaveValidationError);
		expect(error.message).toBe(
			"Save file not downloaded: Test's money (2147483648) is out of range",
		);
	});

	it("still downloads a save with warnings, and returns them", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = -5;

		const validation = await saveManager.download();
		expect(click).toHaveBeenCalledOnce();
		expect(validation?.warnings).toEqual(["Test's money (-5) is negative"]);
		click.mockRestore();
	});
});

describe("Validation toasts", { timeout: 30_000 }, () => {
	mockIDB();
	const negativeMoneySave = async () =>
		(await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>-5</money>",
		);

	// Contexts for the pages, with a spy on the toasts they add
	const contexts = (saveManager: SaveManager) => {
		const toastManager = new ToastManager();
		const add = vi.spyOn(toastManager, "add");
		const context = new Map<unknown, unknown>([
			...setSaveManagerContext(saveManager),
			...setToastManagerContext(toastManager),
		]);
		return { context, add };
	};

	it("shows warnings when a save is uploaded", async () => {
		let saveManager!: SaveManager;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
		});
		const { context, add } = contexts(saveManager);
		const page = render(uploadPage, { context });

		const input =
			page.container.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("No file input");
		// happy-dom's FileList is an array
		const files = new FileList();
		(files as unknown as File[]).push(
			new File([await negativeMoneySave()], "TestSave"),
		);
		input.files = files;
		await fireEvent.change(input);

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		const [toast, duration] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file uploaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		expect(duration).toBe(10000);
		cleanup();
	});

	it("shows warnings when a save is downloaded, and still downloads it", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const saveManager = await importSave(await negativeMoneySave());
		const { context, add } = contexts(saveManager);
		const children = createRawSnippet(() => ({ render: () => "<div></div>" }));
		const page = render(editLayout, { props: { children }, context });

		await fireEvent.click(page.getByTestId("save-button"));

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		expect(click).toHaveBeenCalledOnce();
		const [toast] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file downloaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		click.mockRestore();
	});
});

describe("SaveManager validation of an invalid upload", () => {
	mockIDB();
	let saveManager: SaveManager;

	// Full-file setup has its own deadline, independent of test-body options.
	beforeEach(async () => {
		const xml = (await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>99999999999</money>",
		);
		saveManager = await importSave(xml);
	}, fullSaveTimeout);

	it("still opens the save, so it can be fixed", () => {
		expect(saveManager.save).toBeDefined();
		expect(saveManager.loadValidation?.valid).toBe(false);
		expect(saveManager.loadValidation?.errors).toContain(
			"Test's money (99999999999) is out of range",
		);
	});
});
