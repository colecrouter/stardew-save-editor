import { browser, dev } from "$app/environment";
import { BackupManager } from "$lib/BackupManager.svelte";
import { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { XMLManager } from "$lib/workers/xml";
import { error } from "@sveltejs/kit";
import * as Comlink from "comlink";
import pako from "pako";
import { getContext, setContext } from "svelte";
import { nestedArrayTags } from "./workers/jank";

const SAVE_KEY = Symbol("saveManager");
const SUPPORTED_VERSIONS = ["1.6"];

// XML Manager singleton
let xmlManager: Comlink.Remote<XMLManager> | XMLManager | undefined;

const getXmlManager = async () => {
    if (xmlManager) return xmlManager;
    if (import.meta.env.TEST) {
        const manager = await import("$lib/workers/xml");
        xmlManager = new manager.XMLManager();
    } else {
        const { default: worker } = await import("$lib/workers/xml.ts?worker");
        const wrapped = Comlink.wrap<{ new (): XMLManager }>(new worker());
        xmlManager = await new wrapped();
    }
    return xmlManager;
};

// Type guards and validators
const isSaveFile = (obj: unknown): obj is SaveFile =>
    typeof obj === "object" &&
    obj !== null &&
    "SaveGame" in obj &&
    typeof obj.SaveGame === "object" &&
    obj.SaveGame !== null;

const isValidGameVersion = (version: string | undefined): boolean =>
    SUPPORTED_VERSIONS.some((v) => version?.startsWith(v));

// File handling utilities
const downloadFile = async (blob: Blob, filename: string) => {
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

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Some browsers (Safari/WebKit, some Edge builds) can truncate downloads
    // if the Object URL is revoked synchronously after click. Append to DOM
    // and delay revocation to ensure the download stream is established.
    // TODO https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 1000);
};

export class SaveManager {
    save = $state<SaveProxy>();
    filename = "";
    backups = new BackupManager();

    constructor() {
        if (browser && dev) {
            this.loadDevState();
        }
    }

    private loadDevState() {
        const saveData = localStorage.getItem("save");
        const filename = localStorage.getItem("filename");
        if (!saveData || !filename) return;

        const parsed = JSON.parse(saveData);
        if (!isSaveFile(parsed)) return;

        this.save = new SaveProxy(parsed);
        this.filename = filename;
    }

    private saveDevState() {
        if (!this.save) {
            localStorage.removeItem("save");
            localStorage.removeItem("filename");
            return;
        }
        localStorage.setItem("save", JSON.stringify(this.save.raw));
        localStorage.setItem("filename", this.filename);
    }

    async init() {
        if (dev) {
            $effect(() => this.saveDevState());
        }
        this.backups.init();
    }

    async import(file: File) {
        if (!this.backups.files) throw new Error("Missing call to init()");

        const buf = await file.arrayBuffer();
        const content = new Uint8Array(buf);

        let decompressedContent: string;

        if (content[0] === 120) {
            // This is also how vanilla checks if a save is compressed. Around SaveGame.cs Line 671
            // File is zlib compressed
            const decompressed = pako.inflate(content);
            decompressedContent = new TextDecoder().decode(decompressed);
        } else {
            // File is not compressed
            decompressedContent = new TextDecoder().decode(content);
        }

        const xmlManager = await getXmlManager();
        // @ts-ignore Not sure why svelte-check doesn't like this line
        const json = await xmlManager.parse(decompressedContent);

        if (!isSaveFile(json)) {
            throw new Error("Invalid save file");
        }

        if (!isValidGameVersion(json.SaveGame.gameVersion as string)) {
            throw new Error(
                `Unsupported game version: ${json.SaveGame.gameVersion}`,
            );
        }

        await this.handleBackup(file);

        // I hate that I have to do this
        function fixEmpty(obj: unknown) {
            if (typeof obj !== "object" || obj === null) return;
            for (const [child, parents] of nestedArrayTags.entries()) {
                for (const parent of parents) {
                    // @ts-ignore
                    if (parent in obj && obj[parent] === "") {
                        // @ts-ignore
                        obj[parent] = { [child]: [] };
                        console.debug(
                            `Fixed empty "${parent}" tag by converting to object with empty "${child}" array`,
                        );
                    }
                }
            }
        }

        fixEmpty(json.SaveGame.player);
        if (json.SaveGame.farmhands !== "") {
            for (const farmer of json.SaveGame.farmhands.Farmer) {
                fixEmpty(farmer);
            }
        }

        this.save = new SaveProxy(json);
        this.filename = file.name;
    }

    private async handleBackup(file: File) {
        if (!this.backups.files) return;
        for (const backup of this.backups.files) {
            if (backup.name === file.name) return;
            const oldData = await backup.text();
            const newData = await file.text();
            if (oldData === newData) return;
        }
        this.backups.files.unshift(file);
    }

    async download() {
        const blob = await this.export();
        return downloadFile(blob, this.filename);
    }

    async export() {
        if (!this.save) throw new Error("No save file provided");
        const xmlManager = await getXmlManager();
        return await xmlManager.stringify(
            /* 
                DON'T REMOVE THESE

                This fails because comlink fails to clone the object for whatever reason.
                I couldn't get comlink working with vitest, so removing this will pass the tests, but it will break the app.
            */
            JSON.parse(JSON.stringify(this.save.raw)),
        );
    }

    reset() {
        this.save = undefined;
        this.filename = "";
        this.saveDevState();
    }
}

// Context helpers
export const setSaveManager = () => setContext(SAVE_KEY, new SaveManager());
export const getSaveManager = () =>
    getContext<SaveManager>(SAVE_KEY) ?? error(500, "No save manager found");
export const setSaveManagerContext = (s: SaveManager) =>
    new Map([[SAVE_KEY, s]]);
