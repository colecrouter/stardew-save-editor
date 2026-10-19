import { type IDBPDatabase, openDB } from "idb";
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
	/** Saving waits for load() so it can't clear backups before they're read */
	#loaded = $state(false);
	/** The latest save; each one waits for the one before */
	#saving: Promise<void> = Promise.resolve();

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
			if (this.disabled || !this.#loaded) return;

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
		let db: IDBPDatabase | undefined;
		try {
			// Get the backup files from local storage (opening it can fail too,
			// e.g. in a private window)
			db = await openDB("backups", 1, {
				upgrade: (db) => db.createObjectStore("files", { autoIncrement: true }),
			});
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
			// Keep any save uploaded while loading, as the newest backup
			this.files = [...this.files, ...newFiles];
		} catch (e) {
			// Empty the database
			await db?.clear("files").catch(() => {});

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
			this.#loaded = true;
		}
	}

	/**
	 * Saves the current files to IndexedDB.
	 *
	 * This is triggered via `$effect` when `this.files` updates.
	 * If any errors occur during saving, a toast notification is triggered.
	 */
	private save() {
		// Copy the list now, so the effect tracks every file. Saves run one at a
		// time, in order, so the last one written is always the latest list.
		const files = [...this.files];
		this.#saving = this.#saving.then(() => this.write(files)).catch(() => {});
	}

	private async write(files: File[]) {
		try {
			const serializedFiles: SerializedFile[] = [];
			for (const file of files) {
				serializedFiles.unshift({
					name: file.name,
					data: await file.text(),
					lastModified: file.lastModified,
					size: file.size,
					type: "text/text",
				});
			}

			const db = await openDB("backups", 1);
			// Clear and add in one transaction, so the store never holds half a list
			const tx = db.transaction("files", "readwrite");
			await Promise.all([
				tx.store.clear(),
				...serializedFiles.map((file) => tx.store.add(file)),
				tx.done,
			]);
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
