import { downloadSave } from "./downloadSave";
import { error } from "@sveltejs/kit";
import * as Comlink from "comlink";
import pako from "pako";
import { getContext, setContext } from "svelte";
import { dev } from "$app/environment";
import { BackupManager } from "$lib/BackupManager.svelte";
import { Dispose } from "$lib/proxies";
import { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import {
	describeProblems,
	type SaveValidation,
	SUPPORTED_VERSIONS,
	validateSave,
} from "$lib/saveValidation";
import type { XMLManager } from "$lib/workers/xml";
import { nestedArrayTags } from "./workers/jank";

const SAVE_KEY = Symbol("saveManager");

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

/** Thrown by download() when the exported save fails validation */
export class SaveValidationError extends Error {
	constructor(readonly validation: SaveValidation) {
		super(`Save file not downloaded: ${describeProblems(validation.errors)}`);
	}
}

export class SaveManager {
	save = $state<SaveProxy>();
	filename = "";
	/** Validation of the save as it was uploaded */
	loadValidation = $state<SaveValidation>();
	backups = new BackupManager();
	private disposeSave?: () => void;
	// Route teardown invalidates work already waiting on files, workers or pickers.
	private generation = 0;
	private downloads = new AbortController();

	constructor() {
		if (dev) $effect(() => this.loadDevState());
	}

	private loadDevState() {
		const saveData = localStorage.getItem("save");
		const filename = localStorage.getItem("filename");
		if (!saveData || !filename) return;

		const parsed = JSON.parse(saveData);
		if (!isSaveFile(parsed)) return;

		const cleanup = $effect.root(() => {
			const save = new SaveProxy(parsed);
			this.save = save;
			return () => save[Dispose]();
		});
		this.disposeSave = cleanup;
		this.filename = filename;
		return cleanup;
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

	async import(file: File) {
		const generation = ++this.generation;
		this.downloads.abort();
		this.downloads = new AbortController();
		try {
			const buf = await file.arrayBuffer();
			if (generation !== this.generation) return false;
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
			const json = await xmlManager.parse(decompressedContent);
			if (generation !== this.generation) return false;

			if (!isSaveFile(json)) {
				throw new Error("Invalid save file");
			}

			if (!isValidGameVersion(json.SaveGame.gameVersion as string)) {
				throw new Error(
					`Unsupported game version: ${json.SaveGame.gameVersion}`,
				);
			}

			// Checked before the editor touches anything, so it reflects the uploaded file
			const validation = validateSave(json);

			await this.handleBackup(file);
			if (generation !== this.generation) return false;

			// I hate that I have to do this
			function fixEmpty(obj: unknown) {
				if (typeof obj !== "object" || obj === null) return;
				for (const [child, parents] of nestedArrayTags.entries()) {
					for (const parent of parents) {
						// @ts-expect-error
						if (parent in obj && obj[parent] === "") {
							// @ts-expect-error
							obj[parent] = { [child]: [] };
							// console.debug(
							// 	`Fixed empty "${parent}" tag by converting to object with empty "${child}" array`,
							// );
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

			// Replace current save with a fresh proxy inside an effect root
			// and capture cleanup to avoid memory leaks when replacing or resetting.
			if (this.disposeSave) {
				try {
					this.disposeSave();
				} catch (e) {
					console.warn("Previous save cleanup failed", e);
				} finally {
					this.disposeSave = undefined;
				}
			}

			const cleanup = $effect.root(() => {
				const save = new SaveProxy(json);
				this.save = save;
				// Factory-created items have independent roots. Their inventory owner
				// releases them alongside the enclosing save, even before an effect flush.
				return () => save[Dispose]();
			});
			this.disposeSave = cleanup;

			this.filename = file.name;
			this.loadValidation = validation;
			return true;
		} catch (cause) {
			// A departed screen must not navigate or toast on a late failure.
			if (generation !== this.generation) return false;
			throw cause;
		}
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

	/**
	 * Export the save, then read the exported file back and validate it, so
	 * what's checked is exactly what would be written.
	 */
	async validatedExport() {
		const blob = await this.export();
		const xmlManager = await getXmlManager();
		let validation: SaveValidation;
		try {
			validation = validateSave(await xmlManager.parse(await blob.text()));
		} catch (e) {
			validation = {
				valid: false,
				errors: [`The exported file couldn't be read back (${e})`],
				warnings: [],
			};
		}
		return { blob, validation };
	}

	/** Download the save if it passes validation; throws SaveValidationError if not */
	async download() {
		const generation = this.generation;
		const filename = this.filename;
		const signal = this.downloads.signal;
		try {
			const { blob, validation } = await this.validatedExport();
			if (generation !== this.generation) return;
			if (!validation.valid) throw new SaveValidationError(validation);
			if (!(await downloadSave(blob, filename, signal))) return;
			if (generation !== this.generation) return;
			return validation;
		} catch (cause) {
			if (generation !== this.generation) return;
			throw cause;
		}
	}

	async export(pretty = false) {
		if (!this.save) throw new Error("No save file provided");
		const xmlManager = await getXmlManager();
		const bytes = await xmlManager.stringify(
			/* 
                DON'T REMOVE THESE

                This fails because comlink fails to clone the object for whatever reason.
                I couldn't get comlink working with vitest, so removing this will pass the tests, but it will break the app.
            */
			JSON.parse(JSON.stringify(this.save.raw)),
			pretty,
		);
		// Save files intentionally have no extension. Treat them as generic binary
		// data so browsers do not infer an XML- or platform-specific extension.
		return new Blob([bytes.buffer], { type: "application/octet-stream" });
	}

	reset() {
		this.generation++;
		this.downloads.abort();
		this.downloads = new AbortController();
		// Dispose reactive effects created for the current save
		try {
			this.disposeSave?.();
		} finally {
			this.disposeSave = undefined;
		}
		this.save = undefined;
		this.filename = "";
		this.loadValidation = undefined;
		this.saveDevState();
	}
}

// Context helpers
export const setSaveManager = () => setContext(SAVE_KEY, new SaveManager());
export const getSaveManager = () =>
	getContext<SaveManager>(SAVE_KEY) ?? error(500, "No save manager found");
export const setSaveManagerContext = (s: SaveManager) =>
	new Map([[SAVE_KEY, s]]);
