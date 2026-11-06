import { openDB } from "idb";
import { Effect, Result, Schema } from "effect";

export interface StoredOriginal {
	name: string;
	data: string;
	lastModified: number;
	size: number;
	type: string;
	encoding?: "base64";
}

// Archive metadata is untrusted persisted input. A malformed record remains in
// the archive, but cannot suppress a new valid backup as an alleged duplicate.
export const storedOriginalSchema = Schema.Struct({
	name: Schema.String,
	data: Schema.String,
	lastModified: Schema.Number.check(
		Schema.isFinite(),
		Schema.isGreaterThanOrEqualTo(0),
	),
	size: Schema.Number.check(
		Schema.isFinite(),
		Schema.isGreaterThanOrEqualTo(0),
	),
	type: Schema.String,
	encoding: Schema.optionalKey(Schema.Literal("base64")),
});
const decodeStored = Schema.decodeUnknownResult(storedOriginalSchema);

// Use the same bounded byte representation for new binary originals and old
// UTF-8 text entries. Comparison must not coerce compressed data through text.
function encodeBytes(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 8192)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
	return btoa(binary);
}

/** Same farm filename and exact bytes mean the original is already protected. */
function matchesOriginal(value: unknown, incoming: StoredOriginal): boolean {
	const decoded = decodeStored(value);
	if (Result.isFailure(decoded) || decoded.success.name !== incoming.name)
		return false;
	const candidate = decoded.success;
	if (candidate.encoding !== "base64")
		return (
			encodeBytes(new TextEncoder().encode(candidate.data)) === incoming.data
		);
	// Newly stored canonical bytes can match directly, without decoding the save again.
	if (candidate.data === incoming.data) return true;
	// Existing base64 may contain whitespace or omitted padding. Canonicalize
	// valid bytes; invalid archive data stays untouched rather than failing import.
	const canonical = Effect.runSync(
		Effect.result(
			Effect.sync(() => btoa(atob(candidate.data))).pipe(
				Effect.catchDefect((cause) =>
					cause instanceof DOMException ||
					Object.prototype.toString.call(cause) === "[object DOMException]"
						? Effect.fail("Invalid stored base64")
						: Effect.die(cause),
				),
			),
		),
	);
	return Result.isSuccess(canonical) && canonical.success === incoming.data;
}

// Existing backups store XML text. New binary originals carry an explicit encoding
// so compressed saves round-trip intact while older entries remain readable.
export function restoreOriginal(file: StoredOriginal): File {
	const data =
		file.encoding === "base64"
			? Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0))
			: file.data;
	return new File([data], file.name, {
		lastModified: file.lastModified,
		type: file.type,
	});
}

/** Encode exact source bytes for IndexedDB, preserving compressed saves and file metadata. */
export async function serializeOriginal(file: File): Promise<StoredOriginal> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	// Persist exact source bytes, never an edited draft. Chunking in encodeBytes
	// avoids spreading a whole multi-megabyte save into browser argument limits.
	const stored: StoredOriginal = {
		name: file.name,
		data: encodeBytes(bytes),
		encoding: "base64",
		lastModified: file.lastModified,
		size: file.size,
		type: file.type,
	};
	return stored;
}

/** Open the shared store without altering existing archive records. Each caller closes its connection. */
export const openOriginalBackupStore = () =>
	openDB("backups", 1, {
		upgrade: (db) => {
			db.createObjectStore("files", { autoIncrement: true });
		},
	});

/**
 * Preserve each distinct original under its filename and retain the newest five.
 * Append/pruning share one transaction. Rejections let the caller warn that the
 * backup failed without treating the editing session itself as unusable.
 */
export async function saveOriginalBackup(file: File): Promise<void> {
	const stored = await serializeOriginal(file);
	const db = await openOriginalBackupStore();
	try {
		// Serialize duplicate checking with append/prune, including concurrent imports.
		// An identical upload must not evict a different original or rewrite its key,
		// timestamp or opaque wrapper fields; changed bytes under the same name remain.
		const transaction = db.transaction("files", "readwrite");
		const originals: unknown[] = await transaction.store.getAll();
		if (originals.some((value) => matchesOriginal(value, stored))) {
			await transaction.done;
			return;
		}
		await transaction.store.add(stored);
		const keys = await transaction.store.getAllKeys();
		for (const key of keys.slice(0, Math.max(0, keys.length - 5)))
			await transaction.store.delete(key);
		await transaction.done;
	} finally {
		db.close();
	}
}
