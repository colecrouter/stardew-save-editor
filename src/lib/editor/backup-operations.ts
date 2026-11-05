import { Data, Effect, Result, Schema } from "effect";
import {
	openOriginalBackupStore,
	restoreOriginal,
	storedOriginalSchema,
} from "../saveBackups.ts";
import { downloadSave } from "../downloadSave.ts";
import type { CommandResult } from "./command-result.ts";
import { runEntryCommand } from "./entry-operations.ts";

/** Archive/browser failures leave both the stored originals and editor sessions intact. */
export class BackupUnavailable extends Data.TaggedError("BackupUnavailable")<{
	readonly message: string;
}> {}
const decodeStored = Schema.decodeUnknownResult(storedOriginalSchema);
export interface OriginalBackup {
	/** Existing shared archives use auto-incremented numeric keys. Unknown keys remain read-only. */
	readonly key?: number;
	readonly rowId: string;
	readonly name: string;
	readonly lastModified?: number;
	readonly size?: number;
	readonly file?: File;
	readonly reason?: string;
}
const unavailable = (message: string) => new BackupUnavailable({ message });
// DOMExceptions can cross browser/test realms; their standard tag preserves
// that classification without treating ordinary Error/TypeError as storage denials.
const browserFailure = (cause: unknown) =>
	cause instanceof DOMException ||
	Object.prototype.toString.call(cause) === "[object DOMException]";
const expectedBrowserFailure = (message: string) =>
	Effect.catchDefect((cause) =>
		browserFailure(cause)
			? Effect.fail(unavailable(message))
			: Effect.die(cause),
	);
const request = <A>(message: string, run: () => Promise<A>) =>
	Effect.promise(run).pipe(expectedBrowserFailure(message));

/** Automatic import backup uses the same browser-failure classification as archive actions.
 * The injected writer preserves the caller's exact File and existing retention policy. */
export const writeOriginalBackup = (
	file: File,
	write: (file: File) => Promise<void>,
) =>
	request(
		"The original file could not be backed up. Keep a separate copy before exporting.",
		() => write(file),
	);

/** Read keys and values in one transaction; invalid entries remain visible without clearing the archive. */
export const readOriginalBackups = Effect.fn("Backups.readOriginals")(
	function* () {
		const records = yield* request(
			"Backups could not be read. Browser storage may be unavailable.",
			async () => {
				const db = await openOriginalBackupStore();
				try {
					const transaction = db.transaction("files", "readonly");
					const [keys, values] = await Promise.all([
						transaction.store.getAllKeys(),
						transaction.store.getAll(),
					]);
					await transaction.done;
					return keys.map((key, index) => ({ key, value: values[index] }));
				} finally {
					db.close();
				}
			},
		);
		const rows: OriginalBackup[] = [];
		for (const [index, entry] of records.entries()) {
			const key =
				typeof entry.key === "number" && Number.isSafeInteger(entry.key)
					? entry.key
					: undefined;
			const decoded = decodeStored(entry.value);
			if (Result.isFailure(decoded)) {
				rows.push({
					key,
					rowId:
						key === undefined ? `unsupported-backup:${index}` : `backup:${key}`,
					name: "Unreadable backup",
					reason:
						"This stored entry has unsupported metadata. Its original data has been retained.",
				});
				continue;
			}
			// Invalid base64 is imported archive data, not a reason to erase other backups.
			const restored = yield* Effect.result(
				Effect.sync(() => restoreOriginal(decoded.success)).pipe(
					expectedBrowserFailure(
						"This backup's stored bytes could not be restored.",
					),
				),
			);

			rows.push({
				key,
				rowId:
					key === undefined ? `unsupported-backup:${index}` : `backup:${key}`,
				name: decoded.success.name,
				lastModified: decoded.success.lastModified,
				size: Result.isSuccess(restored)
					? restored.success.size
					: decoded.success.size,
				file: Result.isSuccess(restored) ? restored.success : undefined,
				reason: Result.isFailure(restored)
					? restored.failure.message
					: key === undefined
						? "This stored entry has an unsupported archive key."
						: undefined,
			});
		}
		// Store keys encode import order, while original modification dates can be old.
		// Reverse that order to show the latest backup first without rewriting metadata.
		return rows.reverse();
	},
);

/** Delete exactly the confirmed archive key; concurrent imports and other records are unaffected. */
export const deleteOriginalBackup = Effect.fn("Backups.deleteOriginal")(
	function* (key: number | undefined) {
		if (typeof key !== "number" || !Number.isSafeInteger(key) || key < 0)
			return yield* unavailable("Choose a supported backup entry.");
		yield* request(
			"This backup could not be deleted. Please try again.",
			async () => {
				const db = await openOriginalBackupStore();
				try {
					const transaction = db.transaction("files", "readwrite");
					await transaction.store.delete(key);
					await transaction.done;
				} finally {
					db.close();
				}
			},
		);
	},
);
/** Download the restored original itself; never serialize a current edited model in its place. */
export const downloadOriginalBackup = Effect.fn("Backups.downloadOriginal")(
	function* (file: File, signal?: AbortSignal) {
		return yield* request(
			"The original backup could not be downloaded. Please try again.",
			() => downloadSave(file, file.name, signal),
		);
	},
);

/** Upload-screen runtime boundary: expected storage failures stay typed; defects report once and do not reject UI events. */
export async function runBackupCommand<A, E>(
	program: Effect.Effect<A, E>,
	reportDefect: (message: string) => void,
): Promise<CommandResult<A, E>> {
	return runEntryCommand(program, reportDefect, {
		context: "backup",
		message: "The backup action could not be completed. Please try again.",
	});
}
