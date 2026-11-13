import { expect, it, vi } from "vitest";
import { openDB } from "idb";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	saveOriginalBackup,
	restoreOriginal,
	type StoredOriginal,
} from "../../src/lib/saveBackups";
import {
	chooseSaveDestination,
	downloadSave,
	type SaveDownloadStage,
} from "../../src/lib/downloadSave";

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
	// Spies restore the exact browser methods after the download assertion.
	const create = vi
		.spyOn(URL, "createObjectURL")
		.mockReturnValue("blob:save-download");
	const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
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
		create.mockRestore();
		revoke.mockRestore();
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

// A browser AbortError means cancellation only while the picker is open. Once
// we own a stream, failures must release it and reach the application's retry UI.
it.each(["write", "close"] as const)(
	"aborts an acquired stream after %s fails and preserves the original failure",
	async (stage) => {
		const stages: SaveDownloadStage[] = [];
		const failure = new DOMException(
			"Destination became unavailable",
			"AbortError",
		);
		const write = vi.fn(async () => {
			if (stage === "write") throw failure;
		});
		const close = vi.fn(async () => {
			if (stage === "close") throw failure;
		});
		// Some browsers already error the stream; a second cleanup failure must not
		// replace the write/close reason that the caller needs to report.
		const abort =
			stage === "close"
				? vi.fn(async () => {
						throw new TypeError("Already closed");
					})
				: vi.fn(async () => {});
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: async () => ({
				createWritable: async () => ({ write, close, abort }),
			}),
		});
		try {
			const destination = await chooseSaveDestination(
				"Farm_123",
				undefined,
				"picker",
				(next) => stages.push(next),
			);
			await expect(destination!.write(new Blob(["save"]))).rejects.toBe(
				failure,
			);
			// Failed cleanup must preserve the original stage as well as its error.
			expect(stages).toEqual(
				stage === "write"
					? ["picker", "create_writable", "write"]
					: ["picker", "create_writable", "write", "close"],
			);
			expect(abort).toHaveBeenCalledExactlyOnceWith(failure);
			expect(close).toHaveBeenCalledTimes(stage === "close" ? 1 : 0);
		} finally {
			Reflect.deleteProperty(window, "showSaveFilePicker");
		}
	},
);

it("reports stream acquisition failure rather than treating it as picker cancellation", async () => {
	const failure = new DOMException("Cannot acquire stream", "AbortError");
	Object.defineProperty(window, "showSaveFilePicker", {
		configurable: true,
		value: async () => ({
			createWritable: async () => {
				throw failure;
			},
		}),
	});
	try {
		await expect(downloadSave(new Blob(["save"]), "Farm_123")).rejects.toBe(
			failure,
		);
	} finally {
		Reflect.deleteProperty(window, "showSaveFilePicker");
	}
});

it("reports cleanup rejection for a late unused stream when there is no earlier write failure", async () => {
	const controller = new AbortController();
	const failure = new Error("Cannot release unused stream");
	const write = vi.fn(async () => {});
	const abort = vi.fn(async () => {
		throw failure;
	});
	Object.defineProperty(window, "showSaveFilePicker", {
		configurable: true,
		value: async () => ({
			createWritable: async () => {
				controller.abort();
				return { write, abort };
			},
		}),
	});
	try {
		await expect(
			downloadSave(new Blob(["save"]), "Farm_123", controller.signal),
		).rejects.toBe(failure);
		expect(write).not.toHaveBeenCalled();
		expect(abort).toHaveBeenCalledOnce();
	} finally {
		Reflect.deleteProperty(window, "showSaveFilePicker");
	}
});
