import { openDB } from "idb";

export interface StoredOriginal {
	name: string;
	data: string;
	lastModified: number;
	size: number;
	type: string;
	encoding?: "base64";
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

export async function serializeOriginal(file: File): Promise<StoredOriginal> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	// Bound each conversion chunk; spreading a whole multi-megabyte save exceeds
	// browser argument limits. Persist the exact source bytes, never an edited draft.
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 8192)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
	const stored: StoredOriginal = {
		name: file.name,
		data: btoa(binary),
		encoding: "base64",
		lastModified: file.lastModified,
		size: file.size,
		type: file.type,
	};
	return stored;
}

export async function saveOriginalBackup(file: File): Promise<void> {
	const stored = await serializeOriginal(file);
	const db = await openDB("backups", 1, {
		upgrade: (db) => {
			db.createObjectStore("files", { autoIncrement: true });
		},
	});
	try {
		// Append and prune in one transaction so another import never sees half a list.
		const transaction = db.transaction("files", "readwrite");
		await transaction.store.add(stored);
		const keys = await transaction.store.getAllKeys();
		for (const key of keys.slice(0, Math.max(0, keys.length - 5)))
			await transaction.store.delete(key);
		await transaction.done;
	} finally {
		db.close();
	}
}
