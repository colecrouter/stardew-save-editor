import { browser, dev } from "$app/environment";
import { BackupManager } from "$lib/BackupManager.svelte";
import { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { error } from "@sveltejs/kit";
import { XMLParser } from "fast-xml-parser";
import { getContext, setContext } from "svelte";

// The XML parser has no idea what should be an array and what should be an object
// This isn't a huge deal, but we can make it a little easier to work with by
// supplying a list of things we want to be arrays
const arrayTags = new Set([
    "item",
    "GameLocations",
    "characters",
    "objects",
    "Farmer",
]);

const importSave = async (file: File) => {
    if (!file) {
        throw new Error("No file provided");
    }

    const xml = await file.text();

    const parser = new XMLParser({
        ignoreAttributes: false,
        allowBooleanAttributes: true,
        isArray: (tagName) => arrayTags.has(tagName),
    });
    const json = parser.parse(xml) as unknown;
    if (!isSaveFile(json)) throw new Error("Invalid save file");

    const gameVersion = json.SaveGame.gameVersion as string | undefined;
    if (!["1.6"].some((v) => gameVersion?.startsWith(v)))
        throw new Error(`Unsupported game version: ${gameVersion}`);

    return json;
};

const downloadBlob = async (blob: Blob, filename: string) => {
    // If supported, use file picker
    if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
            types: [
                {
                    description: "Stardew Valley Save File",
                    accept: { "text/text": [] },
                },
            ],
            suggestedName: filename,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }

    // Otherwise just download the file to downloads
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
};

const isSaveFile = (obj: unknown): obj is SaveFile =>
    typeof obj === "object" &&
    obj !== null &&
    "SaveGame" in obj &&
    typeof obj.SaveGame === "object" &&
    obj.SaveGame !== null;

export class SaveManager {
    save = $state<SaveProxy>();
    filename = "";
    backups = new BackupManager();

    constructor() {
        if (!browser) return;

        // Add HMR handling for development
        if (dev) {
            const saveData = localStorage.getItem("save");
            const filename = localStorage.getItem("filename");
            if (!saveData || !filename) return;

            const parsed = JSON.parse(saveData);
            if (!isSaveFile(parsed)) return;

            this.save = new SaveProxy(parsed);
            this.filename = filename;
        }
    }

    private async flushToLocalStorage() {
        if (!this.save) {
            localStorage.removeItem("save");
            localStorage.removeItem("filename");
            return;
        }

        localStorage.setItem("save", JSON.stringify(this.save.raw));
        localStorage.setItem("filename", this.filename);
    }

    /** This must be called from a component lifecycle */
    async init() {
        if (dev) {
            $effect(() => {
                this.flushToLocalStorage();
            });
        }

        this.backups.init();
    }

    async import(file: File) {
        if (!this.backups.files) throw new Error("Missing call to init()");
        const data = await importSave(file);
        this.save = new SaveProxy(data);
        this.filename = file.name;

        // Backup the save file
        // First, check if the file exists already
        for (const backup of this.backups.files) {
            if (backup.name === file.name) return;
            const oldData = await backup.text();
            const newData = await file.text();
            if (oldData === newData) return;
        }
        this.backups.files.unshift(file);
    }

    async download() {
        if (!this.save) throw new Error("No save file provided");
        const blob = await this.save.toXML();
        return downloadBlob(blob, this.filename);
    }

    async export() {
        if (!this.save) throw new Error("No save file provided");
        const blob = await this.save.toXML();
        return blob;
    }

    reset() {
        this.save = undefined;
        this.filename = "";
        this.flushToLocalStorage();
    }
}

const SAVE_KEY = Symbol("saveManager");

export const setSaveManager = () => setContext(SAVE_KEY, new SaveManager());

export const getSaveManager = () =>
    getContext<SaveManager>(SAVE_KEY) ?? error(500, "No save manager found");
