import { createContext, runInContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import template from "../../src/app.html?raw";
import { cloneEditorData } from "../../src/lib/editor/clone-data.ts";

const nativeCloneKey = Symbol.for("stardew-save-editor.nativeStructuredClone");
const originalDescriptor = Object.getOwnPropertyDescriptor(
	globalThis,
	nativeCloneKey,
);
const intrinsic = globalThis.structuredClone.bind(globalThis);
const script = template.match(
	/<script data-editor-native-clone>([\s\S]*?)<\/script>/,
)?.[1];
if (!script) throw new Error("Missing early native-clone bootstrap");

// Every case owns the handoff and global stubs, so selection tests cannot alter
// another editor suite's clone behavior in the same worker.
afterEach(() => {
	vi.unstubAllGlobals();
	if (originalDescriptor)
		Object.defineProperty(globalThis, nativeCloneKey, originalDescriptor);
	else Reflect.deleteProperty(globalThis, nativeCloneKey);
});
// This deliberately untyped host handoff matches the HTML/bootstrap boundary.
// Selection must inspect the runtime value, not trust a test-only callable type.
const capture = (clone: unknown) =>
	Object.defineProperty(globalThis, nativeCloneKey, {
		value: clone,
		configurable: true,
	});

it("prefers the captured plain-data clone without changing the global compatibility implementation", () => {
	const native = vi.fn(intrinsic);
	const compatibility = vi.fn(intrinsic);
	capture(native);
	vi.stubGlobal("structuredClone", compatibility);
	const source = {
		nested: [{ opaque: "007", unicode: "農場" }],
		negativeZero: -0,
	};
	const copy = cloneEditorData(source);
	expect(native).toHaveBeenCalledWith(source);
	expect(compatibility).not.toHaveBeenCalled();
	expect(globalThis.structuredClone).toBe(compatibility);
	expect(copy).toEqual(source);
	expect(copy.nested).not.toBe(source.nested);
	expect(copy.nested[0]).not.toBe(source.nested[0]);
	expect(Object.is(copy.negativeZero, -0)).toBe(true);
});

it("uses the current global fallback when the browser had no intrinsic", () => {
	capture(undefined);
	const compatibility = vi.fn(function (
		this: typeof globalThis,
		value: unknown,
	) {
		expect(this).toBe(globalThis);
		return intrinsic(value);
	});
	vi.stubGlobal("structuredClone", compatibility);
	const source = { saved: ["kept"] };
	const copy = cloneEditorData(source);
	copy.saved[0] = "consumer edit";
	expect(source.saved).toEqual(["kept"]);
	expect(compatibility).toHaveBeenCalledOnce();
});

it("propagates clone defects without retrying another implementation", () => {
	const defect = new Error("Unexpected clone implementation failure");
	const compatibility = vi.fn(intrinsic);
	capture(() => {
		throw defect;
	});
	vi.stubGlobal("structuredClone", compatibility);
	expect(() => cloneEditorData({ value: 1 })).toThrow(defect);
	expect(compatibility).not.toHaveBeenCalled();
	capture(undefined);
	vi.stubGlobal("structuredClone", () => {
		throw defect;
	});
	expect(() => cloneEditorData({ value: 1 })).toThrow(defect);
});

it("captures before SvelteKit bootstrap and preserves the intrinsic receiver", () => {
	expect(template.indexOf("<script data-editor-native-clone>")).toBeLessThan(
		template.indexOf("%sveltekit.head%"),
	);
	const context = createContext({});
	runInContext(
		`globalThis.structuredClone = function(value) {
		if (this !== globalThis) throw new Error("Wrong receiver");
		return { copied: value };
	};`,
		context,
	);
	runInContext(script, context);
	// The compatibility layer may replace the global after capture; the original
	// still has its own realm's receiver even when the editor invokes it elsewhere.
	runInContext(
		'globalThis.structuredClone = function() { throw new Error("Compatibility clone used"); };',
		context,
	);
	const clone: typeof structuredClone | undefined = Reflect.get(
		context,
		nativeCloneKey,
	);
	expect(clone).toBeTypeOf("function");
	capture(clone);
	expect(cloneEditorData("saved value")).toEqual({ copied: "saved value" });
});

it("records missing native support once so later bootstrap keeps using fallback", () => {
	const context = createContext({});
	runInContext(script, context);
	expect(Object.hasOwn(context, nativeCloneKey)).toBe(true);
	expect(Reflect.get(context, nativeCloneKey)).toBeUndefined();
	runInContext(
		"globalThis.structuredClone = function(value) { return value; };",
		context,
	);
	runInContext(script, context);
	expect(Reflect.get(context, nativeCloneKey)).toBeUndefined();
});
