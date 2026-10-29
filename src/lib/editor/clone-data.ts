const nativeCloneKey = Symbol.for("stardew-save-editor.nativeStructuredClone");
type CloneHost = typeof globalThis & {
	readonly [nativeCloneKey]?: typeof structuredClone;
};

/**
 * Detach editor-owned plain data without paying for unrelated compatibility fixes.
 * Callers retain their JSON validation and ownership boundaries: this helper is
 * not a decoder, and must not clone Errors, host objects or transferables.
 *
 * The HTML bootstrap captures and binds a browser intrinsic before polyfills can
 * replace it to repair Error/DOMException semantics. Leave that global replacement
 * intact for general application code. Older browsers without an intrinsic use
 * the installed compatibility implementation; native Node uses its normal global.
 * Unexpected clone exceptions stay defects at the existing Effect boundary.
 */
export function cloneEditorData<T>(value: T): T {
	// This symbol is written only by the early HTML bootstrap. Its narrow host
	// assertion keeps the browser handoff out of editor data representations.
	const nativeClone = (globalThis as CloneHost)[nativeCloneKey];
	if (typeof nativeClone === "function") return nativeClone(value);
	return globalThis.structuredClone(value);
}
