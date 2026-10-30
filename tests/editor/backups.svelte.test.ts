import { expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { Effect, Result } from "effect";
import { openDB } from "idb";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	saveOriginalBackup,
	openOriginalBackupStore,
} from "../../src/lib/saveBackups";
import {
	readOriginalBackups,
	deleteOriginalBackup,
	downloadOriginalBackup,
	runBackupCommand,
} from "../../src/lib/editor/backup-operations";
import * as downloads from "../../src/lib/downloadSave";
import BackupPanel from "../../src/lib/editor/ui/BackupPanel.svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { fixtureXml } from "./fixtures";

mockIDB();
beforeEach(async () => {
	const db = await openOriginalBackupStore();
	try {
		await db.clear("files");
	} finally {
		db.close();
	}
});

it("reads original byte formats newest first without rewriting wrappers, then deletes only the captured key", async () => {
	const db = await openOriginalBackupStore();
	const legacy = {
		name: "OldFarm",
		data: "<SaveGame />",
		type: "text/text",
		size: 12,
		lastModified: 1,
		modData: { opaque: "007" },
	};
	let oldKey: number;
	try {
		oldKey = Number(await db.add("files", legacy));
	} finally {
		db.close();
	}
	const bytes = new Uint8Array([120, 156, 255, 0, 128, 42]);
	await saveOriginalBackup(
		new File([bytes], "CompressedFarm", {
			lastModified: 2,
			type: "application/octet-stream",
		}),
	);
	const rows = await Effect.runPromise(readOriginalBackups());
	expect(rows.map((row) => row.name)).toEqual(["CompressedFarm", "OldFarm"]);
	const latest = rows[0],
		oldest = rows[1];
	if (!latest?.file || !oldest?.file)
		throw new Error("Missing original backup");
	expect(new Uint8Array(await latest.file.arrayBuffer())).toEqual(bytes);
	expect(await oldest.file.text()).toBe("<SaveGame />");
	expect(oldest.file.lastModified).toBe(1);
	const check = await openDB("backups", 1);
	try {
		expect(await check.get("files", oldKey)).toEqual(legacy);
	} finally {
		check.close();
	}
	await Effect.runPromise(deleteOriginalBackup(latest.key));
	const remaining = await Effect.runPromise(readOriginalBackups());
	expect(remaining.map((row) => row.key)).toEqual([oldKey]);
	expect(remaining[0]?.rowId).toBe(oldest.rowId);
});

it("retains malformed archive data and exposes it as an unavailable row instead of clearing other backups", async () => {
	const db = await openOriginalBackupStore();
	const broken = {
		name: "Broken",
		data: "%%%",
		encoding: "base64",
		type: "text/text",
		size: 3,
		lastModified: 1,
		untouched: "opaque",
	};
	let key: number;
	try {
		key = Number(await db.add("files", broken));
	} finally {
		db.close();
	}
	await saveOriginalBackup(new File(["valid original"], "ValidFarm"));
	const rows = await Effect.runPromise(readOriginalBackups());
	expect(rows).toHaveLength(2);
	expect(rows.find((row) => row.key === key)).toMatchObject({
		name: "Broken",
		file: undefined,
		reason: expect.any(String),
	});
	const check = await openDB("backups", 1);
	try {
		expect(await check.get("files", key)).toEqual(broken);
		expect(await check.count("files")).toBe(2);
	} finally {
		check.close();
	}
});

it("downloads the restored File and original filename, while browser failures stay typed", async () => {
	const bytes = new Uint8Array([120, 156, 0, 255]);
	const file = new File([bytes], "Farm_123", { lastModified: 3 });
	const download = vi.spyOn(downloads, "downloadSave").mockResolvedValue(true);
	try {
		expect(await Effect.runPromise(downloadOriginalBackup(file))).toBe(true);
		expect(download).toHaveBeenCalledWith(file, "Farm_123", undefined);
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
		download.mockRejectedValue(
			new DOMException("Unavailable", "NotAllowedError"),
		);
		expect(
			Result.isFailure(
				await Effect.runPromise(Effect.result(downloadOriginalBackup(file))),
			),
		).toBe(true);
	} finally {
		download.mockRestore();
	}
});

it("requires explicit confirmation for deletion and leaves originals untouched when cancelled", async () => {
	await saveOriginalBackup(new File(["source bytes"], "Farm_123"));
	const page = render(BackupPanel, { onopen: vi.fn(async () => {}) });
	try {
		const card = within(
			await page.findByRole("article", { name: "Farm_123 backup" }),
		);
		await fireEvent.click(card.getByRole("button", { name: "Delete backup" }));
		const dialog = page.getByRole("dialog", {
			name: "Delete this original backup?",
		});
		await fireEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		expect(await Effect.runPromise(readOriginalBackups())).toHaveLength(1);
		await fireEvent.click(card.getByRole("button", { name: "Delete backup" }));
		await fireEvent.click(
			within(page.getByRole("dialog")).getByRole("button", {
				name: "Delete backup",
			}),
		);
		await waitFor(() =>
			expect(
				page.getByText("No original backups are stored in this browser."),
			).toBeTruthy(),
		);
		expect(await Effect.runPromise(readOriginalBackups())).toHaveLength(0);
	} finally {
		page.unmount();
	}
});

it(
	"opens an archived original through the v2 import owner without appending a duplicate backup",
	{ timeout: 15000 },
	async () => {
		await saveOriginalBackup(
			new File([fixtureXml], "ArchivedFarm", { lastModified: 12 }),
		);
		const backup = vi.fn(saveOriginalBackup);
		const page = render(EditorApp, { backupOriginal: backup });
		try {
			await fireEvent.click(
				page.getByText("Original save backups", { selector: "summary" }),
			);
			// Happy DOM does not implement summary's native details toggle for fireEvent.
			const details = page.getByText("Original save backups", {
				selector: "summary",
			}).parentElement;
			if (!(details instanceof HTMLDetailsElement))
				throw new Error("Missing backups disclosure");
			details.open = true;
			await fireEvent(details, new Event("toggle"));
			await fireEvent.click(
				await page.findByRole("button", { name: "Open original" }),
			);
			await page.findByRole("button", { name: "Export save" });
			expect(backup).not.toHaveBeenCalled();
			expect(await Effect.runPromise(readOriginalBackups())).toHaveLength(1);
		} finally {
			page.unmount();
		}
	},
);

it("keeps expected failures typed and reports defects without an unhandled UI rejection", async () => {
	const report = vi.fn();
	const rejected = await runBackupCommand(
		deleteOriginalBackup(undefined),
		report,
	);
	expect(rejected && Result.isFailure(rejected)).toBe(true);
	expect(report).not.toHaveBeenCalled();
	const logging = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		expect(
			await runBackupCommand(Effect.die(new Error("unexpected")), report),
		).toBeNull();
		expect(report).toHaveBeenCalledOnce();
		expect(logging).toHaveBeenCalledOnce();
	} finally {
		logging.mockRestore();
	}
});

it("reports unexpected download implementation failures as defects rather than storage denials", async () => {
	const file = new File(["bytes"], "Farm");
	const download = vi
		.spyOn(downloads, "downloadSave")
		.mockRejectedValue(new TypeError("broken implementation"));
	const log = vi.spyOn(console, "error").mockImplementation(() => {}),
		report = vi.fn();
	try {
		expect(
			await runBackupCommand(downloadOriginalBackup(file), report),
		).toBeNull();
		expect(report).toHaveBeenCalledOnce();
		expect(log).toHaveBeenCalledOnce();
	} finally {
		download.mockRestore();
		log.mockRestore();
	}
});
