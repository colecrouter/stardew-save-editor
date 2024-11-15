import { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { XMLParser } from "fast-xml-parser";

// The XML parser has no idea what should be an array and what should be an object
// This isn't a huge deal, but we can make it a little easier to work with by
// supplying a list of things we want to be arrays
const arrayTags = new Set(["item", "GameLocations", "characters", "objects"]);

export const importSave = async (file: File) => {
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

const isSaveFile = (obj: unknown): obj is SaveFile => {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "SaveGame" in obj &&
        typeof obj.SaveGame === "object" &&
        obj.SaveGame !== null
    );
};

export class SaveManager {
    save = $state<SaveProxy>();
    filename = $state("");

    async import(file: File) {
        this.save = new SaveProxy(await importSave(file));
        this.filename = file.name;
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
}

export const saveManager = new SaveManager();
