import { waitFor } from "@testing-library/svelte";
import * as idb from "idb";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { BackupManager } from "../src/lib/BackupManager.svelte";
import { restoreOriginal, serializeOriginal } from "../src/lib/saveBackups";

vi.mock("idb", async (importOriginal) => {
	const original = await importOriginal<typeof import("idb")>();
	return { ...original, openDB: vi.fn(original.openDB) };
});

mockIDB();
beforeEach(async () => {
	const db = await archive();
	await db.clear("files");
	db.close();
});
let stop: (() => void) | undefined;
afterEach(() => {
	stop?.();
	vi.restoreAllMocks();
});

function manager(limit = 5) {
	let result!: BackupManager;
	stop = $effect.root(() => {
		result = new BackupManager(limit);
	});
	flushSync();
	return result;
}

async function archive() {
	const db = await idb.openDB("backups", 1, {
		upgrade: (db) => db.createObjectStore("files", { autoIncrement: true }),
	});
	return db;
}

describe("legacy backup persistence", () => {
	it("retains loaded backups, persists new originals and removes deleted entries", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "old")));
		const backups = manager();
		await waitFor(() =>
			expect(backups.files.map((file) => file.name)).toEqual(["old"]),
		);
		backups.files.unshift(new File([new Uint8Array([0, 255])], "new"));
		flushSync();
		await waitFor(async () => {
			const stored = await db.getAll("files");
			expect(stored.map((file) => file.name)).toEqual(["old", "new"]);
			expect(
				new Uint8Array(await restoreOriginal(stored[1]).arrayBuffer()),
			).toEqual(new Uint8Array([0, 255]));
		});
		backups.files.pop();
		flushSync();
		await waitFor(async () =>
			expect((await db.getAll("files")).map((file) => file.name)).toEqual([
				"new",
			]),
		);
		db.close();
	});

	it("keeps imports made before the archive read finishes and applies the limit", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "old")));
		const backups = manager(1);
		// load() has yielded to IndexedDB; the import must survive its completion.
		backups.files.unshift(new File(["new"], "new"));
		flushSync();
		await waitFor(async () =>
			expect((await db.getAll("files")).map((file) => file.name)).toEqual([
				"new",
			]),
		);
		expect(backups.files.map((file) => file.name)).toEqual(["new"]);
		db.close();
	});

	it("does not let an identical before-load import evict another original", async () => {
		const db = await archive();
		await db.add(
			"files",
			await serializeOriginal(new File(["older"], "older")),
		);
		await db.add(
			"files",
			await serializeOriginal(new File(["latest"], "latest")),
		);
		const backups = manager(2);
		backups.files.unshift(new File(["latest"], "latest"));
		flushSync();
		await waitFor(() =>
			expect(backups.files.map((file) => file.name)).toEqual([
				"latest",
				"older",
			]),
		);
		expect((await db.getAll("files")).map((file) => file.name)).toEqual([
			"older",
			"latest",
		]);
		db.close();
	});

	it("awaits initial load and serializes duplicate arrivals without dropping changed bytes", async () => {
		const db = await archive();
		const old = await serializeOriginal(
			new File([new Uint8Array([255])], "Farm"),
		);
		await db.add("files", old);
		const backups = manager();
		// 0xff and 0xfe both decode to U+FFFD, so text equality is insufficient.
		await Promise.all([
			backups.add(new File([new Uint8Array([255])], "Farm")),
			backups.add(new File([new Uint8Array([254])], "Farm")),
			backups.add(new File([new Uint8Array([254])], "Farm")),
		]);
		flushSync();
		expect(backups.files).toHaveLength(2);
		await waitFor(async () => expect(await db.getAll("files")).toHaveLength(2));
		expect((await db.getAll("files"))[0]).toEqual(old);
		db.close();
	});

	it("shares one successful file read across concurrent admission, deduplication and persistence", async () => {
		const db = await archive();
		const backups = manager();
		const file = new File(["original"], "Farm");
		const read = vi.spyOn(file, "arrayBuffer");
		await Promise.all([backups.add(file), backups.add(file)]);
		flushSync();
		await waitFor(async () => expect(await db.getAll("files")).toHaveLength(1));
		expect(read).toHaveBeenCalledTimes(1);
		expect(backups.files).toHaveLength(1);
		db.close();
	});

	it("compares restored originals from their known bytes without reading their Files again", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "Farm")));
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		const previous = backups.files[0];
		expect.assert(previous !== undefined);
		const previousRead = vi
			.spyOn(previous, "arrayBuffer")
			.mockRejectedValue(new Error("Must use known bytes"));
		const incoming = new File(["new"], "Farm");
		const incomingRead = vi.spyOn(incoming, "arrayBuffer");
		await backups.add(incoming);
		flushSync();
		await waitFor(async () => expect(await db.getAll("files")).toHaveLength(2));
		await backups.add(new File(["new"], "Farm"));
		expect(backups.files).toHaveLength(2);
		expect(previousRead).not.toHaveBeenCalled();
		expect(incomingRead).toHaveBeenCalledTimes(1);
		db.close();
	});

	it.each([{ data: "a" }, { data: " YQ \n", encoding: "base64" }])(
		"canonicalizes loaded bytes lazily for duplicate comparison (%j)",
		async (source) => {
			const db = await archive();
			const stored = {
				name: "Farm",
				lastModified: 1,
				size: 1,
				type: "",
				...source,
			};
			await db.add("files", stored);
			const backups = manager();
			await waitFor(() => expect(backups.files).toHaveLength(1));
			const previous = backups.files[0];
			expect.assert(previous !== undefined);
			const read = vi
				.spyOn(previous, "arrayBuffer")
				.mockRejectedValue(new Error("Must use stored bytes"));
			await backups.add(new File(["a"], "Farm"));
			flushSync();
			expect(backups.files).toHaveLength(1);
			expect(read).not.toHaveBeenCalled();
			expect(await db.getAll("files")).toEqual([stored]);
			db.close();
		},
	);

	it("does not retain rejected reads when the same File is retried", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "Farm")));
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		const incoming = new File(["new"], "Farm");
		const read = vi
			.spyOn(incoming, "arrayBuffer")
			.mockRejectedValueOnce(new Error("Temporary read failure"))
			.mockResolvedValue(new TextEncoder().encode("new").buffer);
		await expect(backups.add(incoming)).rejects.toThrow(
			"Temporary read failure",
		);
		await backups.add(incoming);
		flushSync();
		await waitFor(async () => expect(await db.getAll("files")).toHaveLength(2));
		expect(read).toHaveBeenCalledTimes(2);
		db.close();
	});

	it("preserves an unreadable archive and disables replacement writes", async () => {
		const db = await archive();
		await db.add("files", { name: "invalid", data: 123 });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const backups = manager();
		await waitFor(() => expect(warn).toHaveBeenCalled());
		backups.files.push(new File(["new"], "new"));
		flushSync();
		expect(await db.getAll("files")).toEqual([{ name: "invalid", data: 123 }]);
		db.close();
	});

	it("preserves records appended by the v2 editor and opaque fields on retained records", async () => {
		const db = await archive();
		const old = {
			...(await serializeOriginal(new File(["old"], "old"))),
			opaque: { keep: true },
		};
		await db.add("files", old);
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		// Another editor can append after this manager's initial snapshot.
		const other = await serializeOriginal(new File(["v2"], "v2"));
		await db.add("files", other);
		backups.files.unshift(new File(["legacy"], "legacy"));
		flushSync();
		await waitFor(async () => expect(await db.getAll("files")).toHaveLength(3));
		const records = await db.getAll("files");
		expect(records[0]).toEqual(old);
		expect(records[1]).toEqual(other);
		backups.files.pop();
		flushSync();
		await waitFor(async () =>
			expect((await db.getAll("files")).map((file) => file.name)).toEqual([
				"v2",
				"legacy",
			]),
		);
		db.close();
	});

	it("serializes overlapping revisions so an older slow write cannot restore a removed file", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "old")));
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		let release!: (value: ArrayBuffer) => void;
		const reading = new Promise<ArrayBuffer>((resolve) => {
			release = resolve;
		});
		const slow = new File(["slow"], "slow");
		const read = vi.spyOn(slow, "arrayBuffer").mockReturnValue(reading);
		backups.files.push(slow);
		flushSync();
		await waitFor(() => expect(read).toHaveBeenCalled());
		backups.files = [new File(["new"], "new")];
		flushSync();
		release(new TextEncoder().encode("slow").buffer);
		await waitFor(async () =>
			expect((await db.getAll("files")).map((file) => file.name)).toEqual([
				"new",
			]),
		);
		db.close();
	});

	it("reports failures opening IndexedDB without an unhandled rejection", async () => {
		vi.spyOn(idb, "openDB").mockRejectedValueOnce(
			new DOMException("Unavailable", "AbortError"),
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const backups = manager();
		await waitFor(() => expect(warn).toHaveBeenCalled());
		const file = new File(["new"], "new");
		const read = vi.spyOn(file, "arrayBuffer");
		await backups.add(file);
		expect(read).not.toHaveBeenCalled();
	});

	it("rolls back a revision when creating an IndexedDB write request fails", async () => {
		const db = await archive();
		const old = await serializeOriginal(new File(["old"], "old"));
		await db.add("files", old);
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		// The interception deliberately calls the original with each real store receiver.
		// oxlint-disable-next-line typescript/unbound-method -- Invoked through apply(this, args) below.
		const add = IDBObjectStore.prototype.add;
		let writes = 0;
		vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
			this: IDBObjectStore,
			...args
		) {
			// The first queued write must roll back with the second failing request.
			if (++writes === 2)
				throw new DOMException("Cannot clone", "DataCloneError");
			return add.apply(this, args);
		});
		backups.files = [new File(["one"], "one"), new File(["two"], "two")];
		flushSync();
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(await db.getAll("files")).toEqual([old]);
		db.close();
	});

	it("retains stored originals when reading a new file fails", async () => {
		const db = await archive();
		await db.add("files", await serializeOriginal(new File(["old"], "old")));
		const backups = manager();
		await waitFor(() => expect(backups.files).toHaveLength(1));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const broken = new File(["new"], "new");
		vi.spyOn(broken, "arrayBuffer").mockRejectedValue(
			new Error("File read failed"),
		);
		backups.files.unshift(broken);
		flushSync();
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect((await db.getAll("files")).map((file) => file.name)).toEqual([
			"old",
		]);
		db.close();
	});
});
