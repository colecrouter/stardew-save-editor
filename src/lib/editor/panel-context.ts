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

export const [getEditorPanel, setEditorPanel, hasEditorPanel] = createContext<{
	model: EditorModel;
	reconstructionSteps: SvelteSet<string>;
	// Panel UI state (selections, inner tabs) that should outlive one panel
	// mount. The workspace owns it, so it lasts exactly as long as the open save.
	panelMemory: SvelteMap<string, unknown>;
}>();

/**
 * A piece of panel UI state that survives leaving and reopening the panel.
 *
 * Only the active panel is mounted, so plain component state resets every time
 * the user navigates away and back. Values kept here return the user to the
 * same selection or inner tab instead. Unsaved drafts must not use this: the
 * navigation guard discards those on purpose.
 *
 * Call it while the component initializes, like other context reads. Outside a
 * workspace (standalone panel tests) the value lives only as long as the caller.
 */
export function rememberPanelState<T>(key: string, initial: T) {
	const memory = hasEditorPanel()
		? getEditorPanel().panelMemory
		: new SvelteMap<string, unknown>();
	return {
		get current(): T {
			// An unset key means the panel has not changed it during this session.
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Each key is written only through this accessor, with its caller's T.
			return memory.has(key) ? (memory.get(key) as T) : initial;
		},
		set current(value: T) {
			memory.set(key, value);
		},
	};
}
