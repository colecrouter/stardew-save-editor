import { browser } from "$app/environment";
import { openDB } from "idb";

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

export class BackupManager {
    files = $state<Array<File>>();
    readonly limit: number;

    constructor(limit = BACKUP_LIMIT) {
        this.limit = limit;
        if (!browser) return;
    }

    init() {
        $effect(() => {
            if (!this.files) return;

            // Limit the number of backups
            this.files.length = Math.min(this.files.length, this.limit);

            // Save the files when backups change
            this.save();
        });

        this.load();
    }

    private async load() {
        // Get the backup files from local storage
        const db = await openDB("backups", 1, {
            upgrade: (db) =>
                db.createObjectStore("files", { autoIncrement: true }),
        });

        try {
            const backupFiles = await db.getAll("files");
            if (!isSerializedFileArray(backupFiles))
                throw new Error("Invalid data");

            const newFiles = new Array<File>();
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
            // TODO investigate
            console.warn("IndexedDB limit was exceeded");

            // Empty the database
            await db.clear("files");

            this.files = [];
        }
    }

    private async save() {
        if (!this.files) throw new Error("Missing call to init()");
        const serializedFiles = new Array<SerializedFile>();

        for (const file of this.files) {
            serializedFiles.unshift({
                name: file.name,
                data: await file.text(),
                lastModified: file.lastModified,
                size: file.size,
                type: "text/text",
            });
        }

        const db = await openDB("backups", 1);
        await db.clear("files");
        for (const file of serializedFiles) {
            await db.add("files", file);
        }
    }
}
