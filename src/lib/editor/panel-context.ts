import { createContext, onDestroy } from "svelte";
import { SvelteMap, type SvelteSet } from "svelte/reactivity";

import type { RouteId } from "$app/types";

import type { EditorModel } from "./editor-model.ts";

// Read predicates at navigation time so even an edit and navigation in the
// same browser task are guarded. Each registration lives as long as its draft.
export function createPanelDrafts() {
	const drafts = new SvelteMap<() => boolean, boolean>();
	return {
		register(isDirty: () => boolean, blocksExport: boolean) {
			drafts.set(isDirty, blocksExport);
			return () => {
				drafts.delete(isDirty);
			};
		},
		get dirty() {
			return [...drafts.keys()].some((isDirty) => isDirty());
		},
		get exportBlocked() {
			return [...drafts].some(
				([isDirty, blocksExport]) => blocksExport && isDirty(),
			);
		},
	};
}

export type PanelDrafts = ReturnType<typeof createPanelDrafts>;
const [getDrafts, setDrafts, hasDrafts] = createContext<PanelDrafts>();
export { setDrafts as setPanelDrafts };

export function getPanelDrafts() {
	return hasDrafts() ? getDrafts() : undefined;
}

export type EditorPanelPath = Extract<RouteId, `/editor/${string}`>;

export function trackPanelDraft(isDirty: () => boolean, blocksExport = false) {
	// Standalone components can still edit without a routed navigation guard.
	if (hasDrafts()) onDestroy(getDrafts().register(isDirty, blocksExport));
}

export const [getEditorPanel, setEditorPanel] = createContext<{
	model: EditorModel;
	reconstructionSteps: SvelteSet<string>;
}>();
