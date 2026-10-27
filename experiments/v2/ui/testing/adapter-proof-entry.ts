// Import through Vite so the harness and package hooks use precisely the same
// Svelte runtime as the app, rather than mounting with another package's runtime.
export { mount, unmount } from "svelte";
export { openEditor, editorResources } from "../../editor-model.ts";
export { default as AdapterLifecycleProbe } from "./AdapterLifecycleProbe.svelte";
