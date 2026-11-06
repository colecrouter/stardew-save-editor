import { expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { setup as mockIDB } from "vitest-indexeddb";
import { Item } from "../../src/lib/proxies/Item.svelte";
import { Raw } from "../../src/lib/proxies";
import type { SaveManager } from "../../src/lib/SaveManager.svelte";
import Harness from "./components/LegacyBoundaryHarness.svelte";
import { fixtureXml } from "./fixtures";

mockIDB();
it("leaving the legacy route group releases imported item roots before another editor opens", async () => {
	let manager: SaveManager | undefined;
	const page = render(Harness, {
		props: {
			onready: (value: SaveManager) => {
				manager = value;
			},
		},
	});
	await waitFor(() => expect(manager).toBeTruthy());
	if (!manager) throw Error("Legacy session was not provided");
	try {
		await manager.import(new File([fixtureXml], "Farm_123"));
		if (!manager.save) throw Error("Legacy import failed");
		const item = Item.fromName("Parsnip");
		manager.save.player.inventory.set(0, item);
		flushSync();
		item.stack = 12;
		flushSync();
		expect(item[Raw].stack).toBe(12);
		page.unmount();
		item.stack = 20;
		flushSync();
		expect(item[Raw].stack).toBe(12);
		expect(manager.save).toBeUndefined();
	} finally {
		page.unmount();
	}
});

it("an import waiting on file bytes cannot recreate a session after legacy teardown", async () => {
	let manager: SaveManager | undefined;
	const page = render(Harness, {
		props: {
			onready: (value: SaveManager) => {
				manager = value;
			},
		},
	});
	await waitFor(() => expect(manager).toBeTruthy());
	if (!manager) throw Error("Legacy session was not provided");
	let release!: (bytes: ArrayBuffer) => void;
	const file = new File([fixtureXml], "Farm_123");
	Object.defineProperty(file, "arrayBuffer", {
		value: () =>
			new Promise<ArrayBuffer>((resolve) => {
				release = resolve;
			}),
	});
	const importing = manager.import(file);
	page.unmount();
	release(new TextEncoder().encode(fixtureXml).buffer);
	expect(await importing).toBe(false);
	expect(manager.save).toBeUndefined();
});

it("a legacy export finishing after teardown cannot open a picker with a stale filename", async () => {
	let manager: SaveManager | undefined;
	const page = render(Harness, {
		props: {
			onready: (value: SaveManager) => {
				manager = value;
			},
		},
	});
	await waitFor(() => expect(manager).toBeTruthy());
	if (!manager) throw Error("Legacy session was not provided");
	let release!: (
		value: Awaited<ReturnType<SaveManager["validatedExport"]>>,
	) => void;
	const exporting = vi.spyOn(manager, "validatedExport").mockImplementation(
		() =>
			new Promise((resolve) => {
				release = resolve;
			}),
	);
	const picker = vi.fn();
	Object.defineProperty(window, "showSaveFilePicker", {
		configurable: true,
		value: picker,
	});
	try {
		const downloading = manager.download();
		page.unmount();
		release({
			blob: new Blob(["save"]),
			validation: { valid: true, errors: [], warnings: [] },
		});
		expect(await downloading).toBeUndefined();
		expect(picker).not.toHaveBeenCalled();
	} finally {
		exporting.mockRestore();
		Reflect.deleteProperty(window, "showSaveFilePicker");
		page.unmount();
	}
});
