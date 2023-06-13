import { writable } from "svelte/store";

export const SaveGame = writable<SaveFile | undefined>();