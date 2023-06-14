import { writable } from "svelte/store";

export const SaveGame = writable<SaveFile | undefined>();
export const FileName = writable<string | undefined>();