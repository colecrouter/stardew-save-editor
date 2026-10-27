import { expect, it, vi } from "vitest";
import { openDB } from "idb";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	saveOriginalBackup,
	restoreOriginal,
	type StoredOriginal,
} from "../../src/lib/saveBackups";
import { downloadSave } from "../../src/lib/downloadSave";

mockIDB();

it("source backups preserve compressed bytes and prune only the oldest originals", async () => {
	const bytes = new Uint8Array([120, 156, 255, 0, 128, 42]);
	for (let index = 0; index < 6; index++)
		await saveOriginalBackup(
			new File([bytes], `Farm_${index}`, {
				type: "application/octet-stream",
				lastModified: index,
			}),
		);
	const db = await openDB("backups", 1);
	try {
		const stored = (await db.getAll("files")) as StoredOriginal[];
		expect(stored).toHaveLength(5);
		expect(stored[0]?.name).toBe("Farm_1");
		const last = stored[4];
		if (!last) throw Error("Missing persisted original");
		const restored = restoreOriginal(last);
		expect(new Uint8Array(await restored.arrayBuffer())).toEqual(bytes);
		expect(restored.name).toBe("Farm_5");
		expect(restored.lastModified).toBe(5);
	} finally {
		db.close();
	}
});

it("existing plain-text backups remain readable", async () => {
	const file = restoreOriginal({
		name: "OldFarm",
		data: "<SaveGame />",
		lastModified: 1,
		size: 12,
		type: "text/text",
	});
	expect(await file.text()).toBe("<SaveGame />");
});

it("browser downloads keep the original filename and release their attached anchor after the stream starts", async () => {
	vi.useFakeTimers();
	const create = vi.fn(() => "blob:save-download");
	const revoke = vi.fn();
	const originalCreate = URL.createObjectURL,
		originalRevoke = URL.revokeObjectURL;
	URL.createObjectURL = create;
	URL.revokeObjectURL = revoke;
	const click = vi
		.spyOn(HTMLAnchorElement.prototype, "click")
		.mockImplementation(function (this: HTMLAnchorElement) {
			expect(this.isConnected).toBe(true);
			expect(this.download).toBe("Farm_123");
		});
	try {
		const blob = new Blob(["save"], { type: "application/octet-stream" });
		expect(await downloadSave(blob, "Farm_123")).toBe(true);
		expect(create).toHaveBeenCalledWith(blob);
		expect(revoke).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(revoke).toHaveBeenCalledWith("blob:save-download");
		expect(document.querySelector('a[download="Farm_123"]')).toBeNull();
	} finally {
		URL.createObjectURL = originalCreate;
		URL.revokeObjectURL = originalRevoke;
		click.mockRestore();
		vi.useRealTimers();
	}
});

it("save-picker cancellation returns noncompletion without writing bytes", async () => {
	const picker = vi.fn(async () => {
		throw new DOMException("Cancelled", "AbortError");
	});
	Object.defineProperty(window, "showSaveFilePicker", {
		configurable: true,
		value: picker,
	});
	try {
		expect(await downloadSave(new Blob(["save"]), "Farm_123")).toBe(false);
		expect(picker).toHaveBeenCalledOnce();
	} finally {
		Reflect.deleteProperty(window, "showSaveFilePicker");
	}
});
