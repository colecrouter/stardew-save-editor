import { browser } from "$app/environment";
import { get, writable } from "svelte/store";
import { openDB } from "idb";

const BACKUP_LIMIT = 5;

interface SerializedFile {
    name: string;
    data: string;
    lastModified: number;
    size: number;
    type: string;
}


// class BackupManager extends Array<File> {
//     constructor() {
//         super();
//         if (!browser) { return; }

//         // Get the backup files from local storage
//         const backupFiles = JSON.parse(localStorage.getItem("backups") ?? "[]") as Array<SerializedFile>;

//         for (const file of backupFiles) {
//             this.push(new File([file.data], file.name, { lastModified: file.lastModified, type: 'text/text' }));
//         }
//     }

//     private async update() {
//         let serialized: Array<SerializedFile> = [];
//         for (const file of this) {
//             serialized.push({
//                 name: file.name,
//                 data: await file.text(),
//                 lastModified: file.lastModified,
//                 size: file.size,
//                 type: 'text/text'
//             });
//         };

//         localStorage.setItem("backups", JSON.stringify(serialized));
//     }

//     public push(...files: File[]): number {
//         (async () => {
//             for (const file of files) {
//                 // Check if the file is the same as the last one, if so, replace it
//                 if (this.length > 0 && await this.last()?.text() === await file.text()) {
//                     this.pop();
//                 }

//                 // Add the file to the array
//                 super.push(file);

//                 // If we have too many files, remove the oldest one
//                 if (this.length > BACKUP_LIMIT) {
//                     super.shift();
//                 }
//             };

//             // Save the files to local storage
//             this.update();
//         })();

//         return 0;
//     }

//     public shift(): File | undefined {
//         // Remove the oldest file
//         const file = super.shift();

//         // Save the files to local storage
//         this.update();

//         return file;
//     }

//     public pop(): File | undefined {
//         // Remove the newest file
//         const file = super.pop();

//         // Save the files to local storage
//         this.update();

//         return file;
//     }

//     public last(): File | undefined {
//         return super.at(-1);
//     }
// }

class BackupController {
    public backups = writable<Array<File>>([]);

    constructor() {
        if (!browser) { return; }

        // Load the files from the database
        this.load();
    }

    private async load() {
        // Get the backup files from local storage
        const db = await openDB('backups', 1, { upgrade: (db) => db.createObjectStore('files', { autoIncrement: true }) });
        const backupFiles = await db.getAll('files') as Array<SerializedFile>;

        const newFiles = new Array<File>();
        for (const file of backupFiles) {
            newFiles.push(new File([file.data], file.name, { lastModified: file.lastModified, type: 'text/text' }));
        }

        this.backups.set(newFiles);
    }

    private async save() {
        let files: Array<SerializedFile> = [];
        for (const file of get(this.backups)) {
            files.push({
                name: file.name,
                data: await file.text(),
                lastModified: file.lastModified,
                size: file.size,
                type: 'text/text'
            });
        };

        const db = await openDB('backups', 1);
        await db.clear('files');
        for (const file of files) {
            await db.add('files', file);
        }
    }

    public async push(...files: File[]): Promise<number> {
        const backups = get(this.backups);

        for (const file of files) {
            // Check if the file is the same as the last one, if so, replace it
            if (backups.length > 0 && await backups.at(-1)?.text() === await file.text()) {
                backups.pop();
            }

            // Add the file to the array
            backups.push(file);

            // If we have too many files, remove the oldest one
            if (backups.length > BACKUP_LIMIT) {
                backups.shift();
            }
        };

        this.backups.set(backups);

        await this.save();

        return 0;
    }

    public async shift(): Promise<File | undefined> {
        const backups = get(this.backups);

        // Remove the oldest file
        const file = backups.shift();

        this.backups.set(backups);

        await this.save();

        return file;
    }

    public async pop(): Promise<File | undefined> {
        const backups = get(this.backups);

        // Remove the newest file
        const file = backups.pop();

        this.backups.set(backups);

        await this.save();

        return file;
    }

    public async splice(start: number, deleteCount?: number, ...items: File[]): Promise<File[]> {
        const backups = get(this.backups);

        // Remove the newest file
        const files = backups.splice(start, deleteCount ?? 1, ...items);

        this.backups.set(backups);

        await this.save();

        return files;
    }
}

export const BackupManager = new BackupController();