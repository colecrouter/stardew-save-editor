import {
	restoreOriginal,
	serializeOriginal,
	storedOriginalSchema,
	storedOriginalBase64,
	type StoredOriginal,
} from "./saveBackups";
import { openDB } from "idb";
import { Schema } from "effect";
import {
	getToastManager,
	Toast,
	type ToastManager,
} from "./ToastManager.svelte";

const BACKUP_LIMIT = 5;

// Stored metadata is untrusted; checking property presence alone would still
// accept invalid field types and manufacture a wrongly typed File.
const isSerializedFileArray = (obj: unknown): obj is StoredOriginal[] =>
	Array.isArray(obj) && obj.every(Schema.is(storedOriginalSchema));

/**
 * Manages backup save files using IndexedDB for storage.
 *
 * Any errors during saving will trigger a toast notification if a ToastManager is in scope.
 */
export class BackupManager {
	public files: Array<File>;
	readonly limit: number;
	private toast?: ToastManager;
	private disabled: boolean;
	private loaded = $state(false);
	private pendingWrite = Promise.resolve();
	private pendingAdd = Promise.resolve();
	private readonly loading: Promise<void>;
	private persisted = new Map<File, IDBValidKey>();
	private loadedOriginals = new WeakMap<File, StoredOriginal>();
	private serialized = new WeakMap<File, StoredOriginal>();
	private pendingSerializations = new WeakMap<File, Promise<StoredOriginal>>();

	constructor(limit = BACKUP_LIMIT) {
		this.files = $state([]);
		this.limit = limit;
		this.disabled = false; // In case of load errors, disable further saves

		try {
			this.toast = getToastManager();
		} catch {
			// No toast manager in scope
		}

		$effect(() => {
			// Do not overwrite persisted backups with the initial empty state, and
			// never retry writes after storage has been disabled.
			if (!this.loaded || this.disabled) return;

			// Bound this manager's known list; concurrent unowned v2 records in
			// the shared store are preserved even if its total temporarily exceeds the limit.
			this.files.length = Math.min(this.files.length, this.limit);

			// Capture each revision before awaiting I/O, then write in order so an
			// older slow file read cannot replace a newer backup list.
			const files = Array.from(this.files);
			this.pendingWrite = this.pendingWrite.then(() => this.save(files));
		});

		// Retain completion so imports can compare against the loaded archive.
		// load/save contain their error reporting because effects cannot await them.
		this.loading = this.load();
	}

	/** Admit distinct originals to the list; the persistence effect reports write failures. */
	add(file: File): Promise<void> {
		const added = this.pendingAdd.then(async () => {
			await this.loading;
			const candidates = this.files.filter(
				(existing) => existing.name === file.name,
			);
			// Different filenames cannot be duplicates. Let persistence read this File
			// once instead of encoding a multi-megabyte original just to admit it.
			if (candidates.length === 0) {
				this.files.unshift(file);
				return;
			}
			const incoming = await this.serialize(file);
			// Compare exact canonical bytes, not decoded text: compressed originals
			// can differ even when both texts contain the same replacement characters.
			for (const existing of candidates) {
				const stored = await this.serialize(existing);
				if (this.files.includes(existing) && stored.data === incoming.data)
					return;
			}
			this.files.unshift(file);
		});
		// Each caller receives its failure. Observe it internally only to keep a
		// failed read from poisoning the queue for subsequent import attempts.
		this.pendingAdd = added.catch(() => {});
		return added;
	}

	private serializeLoaded(file: File): StoredOriginal | undefined {
		const cached = this.serialized.get(file);
		if (cached) return cached;
		const original = this.loadedOriginals.get(file);
		if (!original) return undefined;
		// The loaded record already supplied these bytes to restoreOriginal. Only
		// canonicalize when compared, retaining File-normalized metadata.
		const stored: StoredOriginal = {
			name: file.name,
			data: storedOriginalBase64(original),
			encoding: "base64",
			lastModified: file.lastModified,
			size: file.size,
			type: file.type,
		};
		this.serialized.set(file, stored);
		return stored;
	}

	private serialize(file: File): Promise<StoredOriginal> {
		const cached = this.serializeLoaded(file);
		if (cached) return Promise.resolve(cached);
		const pending = this.pendingSerializations.get(file);
		if (pending) return pending;
		// Files are immutable. Share pending work and retain a successful encoding
		// while its File lives, so deduplication and persistence cannot read it twice.
		const read = serializeOriginal(file).then(
			(stored) => {
				this.serialized.set(file, stored);
				this.pendingSerializations.delete(file);
				return stored;
			},
			(error: unknown) => {
				// A failed read is not cached. Retry may succeed for the same File, and
				// the original rejection still reaches its current caller.
				this.pendingSerializations.delete(file);
				throw error;
			},
		);
		this.pendingSerializations.set(file, read);
		return read;
	}

	/**
	 * Populates the backup manager from IndexedDB.
	 *
	 * Invalid/unreadable archives disable writes while retaining persisted data.
	 */
	private async load() {
		// Opening IndexedDB can fail before a connection exists (for example,
		// private browsing). Keep that failure within the same reporting boundary.
		let db: Awaited<ReturnType<typeof openDB>> | undefined;
		try {
			db = await openDB("backups", 1, {
				upgrade: (db) => db.createObjectStore("files", { autoIncrement: true }),
			});
			// Values and keys must come from one snapshot even if another editor
			// appends an original while this manager is loading.
			const transaction = db.transaction("files");
			const [backupFiles, keys] = await Promise.all([
				transaction.store.getAll(),
				transaction.store.getAllKeys(),
			]);
			if (!isSerializedFileArray(backupFiles)) throw new Error("Invalid data");

			const newFiles: File[] = [];
			for (const [index, stored] of backupFiles.entries()) {
				const file = restoreOriginal(stored);
				newFiles.unshift(file);
				const key = keys[index];
				if (key === undefined) throw new Error("Backup record has no key");
				this.persisted.set(file, key);
				this.loadedOriginals.set(file, stored);
			}
			// Older callers can still append directly while storage opens. Resolve
			// those bytes before retention, so a duplicate cannot evict a distinct
			// stored original. Include arrivals during each asynchronous file read.
			const incoming = new Map<File, StoredOriginal>();
			while (this.files.some((file) => !incoming.has(file))) {
				await Promise.all(
					this.files
						.filter((file) => !incoming.has(file))
						.map(async (file) => {
							incoming.set(file, await this.serialize(file));
						}),
				);
			}
			const distinct = this.files.filter((file) => {
				const stored = incoming.get(file);
				return (
					stored !== undefined &&
					!newFiles.some(
						(previous) =>
							previous.name === file.name &&
							this.serializeLoaded(previous)?.data === stored.data,
					)
				);
			});
			this.files = [...distinct, ...newFiles];
		} catch (e) {
			// A failed read is not permission to erase the archive. Keep stored bytes
			// and any import already in memory, then disable destructive replacement.
			this.disabled = true;

			if (!(e instanceof Error)) return;

			let msg = e.message; // Default to the error message

			// Incognito mode on WebKit causes IndexedDB to error
			if (e instanceof DOMException && e.name === "AbortError") {
				msg = "Backups are disabled. Are you in Incognito/Private mode?";

				// Disable further attempts to save
				this.disabled = true;
			}

			// Notify the user of the error
			this.toast?.add(new Toast(msg, "failure"));

			console.warn(new Error("Failed to load backups", { cause: e }));
		} finally {
			db?.close();
			this.loaded = true;
		}
	}

	/**
	 * Saves the current files to IndexedDB.
	 *
	 * This is triggered via `$effect` when `this.files` updates.
	 * If any errors occur during saving, a toast notification is triggered.
	 */
	private async save(files: readonly File[]) {
		let db: Awaited<ReturnType<typeof openDB>> | undefined;
		try {
			// This store is shared with the v2 editor. Only delete keys this manager
			// loaded or created, and never rewrite retained records or clear the store.
			const removed = [...this.persisted].filter(
				([file]) => !files.includes(file),
			);
			const added = files.filter((file) => !this.persisted.has(file)).reverse();
			if (!removed.length && !added.length) return;
			// File reads happen before opening a write transaction. A rejected read
			// leaves the archive untouched and cannot outlive an IDB transaction.
			const serialized = await Promise.all(
				added.map(async (file) => ({
					file,
					stored: await this.serialize(file),
				})),
			);
			db = await openDB("backups", 1);
			const transaction = db.transaction("files", "readwrite");
			try {
				const [keys] = await Promise.all([
					Promise.all(
						serialized.map(async ({ file, stored }) => ({
							file,
							key: await transaction.store.add(stored),
						})),
					),
					Promise.all(removed.map(([, key]) => transaction.store.delete(key))),
					transaction.done,
				]);
				// Publish ownership only after commit; a failed transaction can be retried.
				for (const [file] of removed) this.persisted.delete(file);
				for (const { file, key } of keys) this.persisted.set(file, key);
			} catch (error) {
				// Request creation can throw synchronously too. Explicitly abort so
				// other queued additions/deletions cannot commit a partial revision.
				try {
					transaction.abort();
				} catch {
					/* Already aborted by IndexedDB. */
				}
				await transaction.done.catch(() => {});
				throw error;
			}
		} catch (e) {
			// Generate a consistent error message based on error
			// For now, the only error we've encountered is a generic IDB WebKit bug:
			// > Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
			const msg = "Failed to backup save. Please try reloading the page.";

			// Prevent spam
			if (this.toast?.toasts?.some((t) => t.message === msg)) return;

			try {
				// Since saving happens inside of an effect, there's no way to
				// Bubble an error up to the caller
				this.toast?.add(new Toast(msg, "failure"));
			} finally {
				console.error(new Error("Failed to save backups", { cause: e }));
			}
		} finally {
			db?.close();
		}
	}
}
