import { openDB } from "idb";
import {
	getToastManager,
	Toast,
	type ToastManager,
} from "./ToastManager.svelte";

const BACKUP_LIMIT = 5;

interface SerializedFile {
	name: string;
	data: string;
	lastModified: number;
	size: number;
	type: string;
}

const isSerializedFile = (obj: unknown): obj is SerializedFile =>
	typeof obj === "object" &&
	obj !== null &&
	"name" in obj &&
	"data" in obj &&
	"lastModified" in obj &&
	"size" in obj &&
	"type" in obj;

const isSerializedFileArray = (obj: unknown): obj is Array<SerializedFile> =>
	Array.isArray(obj) && obj.every(isSerializedFile);

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
			if (!this.disabled) return;

			// Limit the number of backups
			this.files.length = Math.min(this.files.length, this.limit);

			// Save the files when backups change
			this.save();
		});

		this.load();
	}

	/**
	 * Populates the backup manager from IndexedDB.
	 *
	 * If any invalid data/errors are encountered, the database is cleared.
	 */
	private async load() {
		// Get the backup files from local storage
		const db = await openDB("backups", 1, {
			upgrade: (db) => db.createObjectStore("files", { autoIncrement: true }),
		});

		try {
			const backupFiles = await db.getAll("files");
			if (!isSerializedFileArray(backupFiles)) throw new Error("Invalid data");

			const newFiles: File[] = [];
			for (const file of backupFiles) {
				newFiles.unshift(
					new File([file.data], file.name, {
						lastModified: file.lastModified,
						type: "text/text",
					}),
				);
			}
			this.files = newFiles;
		} catch (e) {
			// Empty the database, clear the files
			await db.clear("files").catch(() => {});
			this.files = [];

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
		}
	}

	/**
	 * Saves the current files to IndexedDB.
	 *
	 * This is triggered via `$effect` when `this.files` updates.
	 * If any errors occur during saving, a toast notification is triggered.
	 */
	private async save() {
		const serializedFiles: SerializedFile[] = [];

		// Iterate through our updated
		for (const file of this.files) {
			serializedFiles.unshift({
				name: file.name,
				data: await file.text(),
				lastModified: file.lastModified,
				size: file.size,
				type: "text/text",
			});
		}

		try {
			const db = await openDB("backups", 1);
			await db.clear("files").catch(() => {});
			for (const file of serializedFiles) {
				await db.add("files", file);
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
		}
	}
}
