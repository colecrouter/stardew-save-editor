import { browser, dev } from "$app/environment";
import { BackupManager } from "$lib/BackupManager.svelte";
import { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { XMLManager } from "$lib/workers/xml";
import { error } from "@sveltejs/kit";
import * as Comlink from "comlink";
import { getContext, setContext } from "svelte";

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
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
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

        const xml = await file.text();
        const xmlManager = await getXmlManager();
        const json = await xmlManager.parse(xml);

        if (!isSaveFile(json)) {
            throw new Error("Invalid save file");
        }

        if (!isValidGameVersion(json.SaveGame.gameVersion as string)) {
            throw new Error(
                `Unsupported game version: ${json.SaveGame.gameVersion}`,
            );
        }

        await this.handleBackup(file);

        this.save = new SaveProxy(json);
        this.filename = file.name;
    }

    private async handleBackup(file: File) {
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
        return await xmlManager.stringify(this.save.raw);
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
