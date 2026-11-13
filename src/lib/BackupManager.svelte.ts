import {
	restoreOriginal,
	serializeOriginal,
	storedOriginalSchema,
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
	private persisted = new Map<File, IDBValidKey>();

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

			// Limit the number of backups
			this.files.length = Math.min(this.files.length, this.limit);

			// Capture each revision before awaiting I/O, then write in order so an
			// older slow file read cannot replace a newer backup list.
			const files = Array.from(this.files);
			this.pendingWrite = this.pendingWrite.then(() => this.save(files));
		});

		// load/save contain their error reporting because effects cannot await them.
		void this.load();
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
			}
			// Imports can arrive while IndexedDB opens. Keep those newly added
			// originals ahead of the previously persisted entries.
			this.files = [...this.files, ...newFiles];
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
					stored: await serializeOriginal(file),
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
