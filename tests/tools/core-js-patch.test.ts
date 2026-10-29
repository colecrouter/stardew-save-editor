import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { patchClonePolicy } from "../../tools/patch-core-js.mts";

const original = `return !(test && test.a === test.b && test.a instanceof $Error && test.a.stack === error.stack);
var FORCED_REPLACEMENT = IS_PURE
  || !checkErrorsCloning(nativeStructuredClone, Error)
  || !checkErrorsCloning(nativeStructuredClone, DOMException)
  || !checkNewErrorsCloningSemantic(nativeStructuredClone);`;

describe("core-js clone replacement policy", () => {
	it("accepts AggregateError and DOMException stack limitations while retaining other checks", () => {
		// Keep surrounding detection and fallback source byte-for-byte: only this
		// replacement policy belongs to the application.
		const source = `before\n${original}\nafter`;
		const patched = patchClonePolicy(source, "3.46.0");
		expect(patched).toContain(
			"!checkErrorsCloning(nativeStructuredClone, Error)",
		);
		expect(patched).toContain(
			"!checkErrorsCloning(nativeStructuredClone, DOMException);",
		);
		expect(patched).not.toContain("|| !checkNewErrorsCloningSemantic");
		expect(patched).toContain("test.a === test.b && test.a instanceof $Error");
		expect(patched).toContain(
			"($Error === DOMException || test.a.stack === error.stack)",
		);
		expect(() =>
			patchClonePolicy(
				patched.replace(
					"($Error === DOMException || test.a.stack === error.stack)",
					"test.a.stack === error.stack",
				),
				"3.46.0",
			),
		).toThrow("source changed");
		expect(() =>
			patchClonePolicy(
				original.replace(
					"test.a.stack === error.stack",
					"($Error === DOMException || test.a.stack === error.stack)",
				),
				"3.46.0",
			),
		).toThrow("source changed");
		expect(patched.startsWith("before\n")).toBe(true);
		expect(patched.endsWith("\nafter")).toBe(true);
		expect(patchClonePolicy(patched, "3.46.0")).toBe(patched);
	});

	it("requires explicit review when the dependency or expected source changes", () => {
		expect(() => patchClonePolicy(original, "3.47.0")).toThrow(
			"Review core-js",
		);
		expect(() =>
			patchClonePolicy(original.replace("IS_PURE", "true"), "3.46.0"),
		).toThrow("source changed");
		expect(() => patchClonePolicy(original + original, "3.46.0")).toThrow(
			"source changed",
		);
	});

	it("still rejects broken type, aliasing and Error stacks, accepting only DOMException stack loss", () => {
		const require = createRequire(import.meta.url);
		const source = readFileSync(
			require.resolve("core-js/modules/web.structured-clone.js"),
			"utf8",
		);
		const detector = source.match(
			/var checkErrorsCloning = (function [\s\S]*?\n});/,
		);
		if (!detector) throw new Error("Installed clone detector changed");
		// Execute the installed detector with controlled clone behavior. The missing
		// DOMException stack must be the only formerly failing condition now accepted.
		const check = runInNewContext(`(${detector[1]})`, {
			DOMException,
			fails: (run: () => unknown) => {
				try {
					return Boolean(run());
				} catch {
					return true;
				}
			},
		}) as (
			clone: (value: { a: Error; b: Error }) => unknown,
			type: typeof Error | typeof DOMException,
		) => boolean;
		const clone =
			(preserveStack: boolean, preserveType = true, preserveAlias = true) =>
			({ a }: { a: Error; b: Error }) => {
				const copy = Object.create(
					preserveType ? Object.getPrototypeOf(a) : Object.prototype,
				);
				if (preserveStack) copy.stack = a.stack;
				return { a: copy, b: preserveAlias ? copy : {} };
			};
		expect(check(clone(false), DOMException)).toBe(true);
		expect(check(clone(false), Error)).toBe(false);
		expect(check(clone(true), Error)).toBe(true);
		expect(check(clone(false, false), DOMException)).toBe(false);
		expect(check(clone(false, true, false), DOMException)).toBe(false);
	});

	it("the install lifecycle patches the copy used to generate production polyfills", () => {
		// This exercises the installed package, rather than merely a synthetic fixture.
		const require = createRequire(import.meta.url);
		const pluginRequire = createRequire(
			require.resolve("@vitejs/plugin-legacy"),
		);
		const path = pluginRequire.resolve(
			"core-js/modules/web.structured-clone.js",
		);
		const source = readFileSync(path, "utf8");
		expect(source).toContain("// Application policy: proposed AggregateError");
		expect(patchClonePolicy(source, "3.46.0")).toBe(source);
	});
});
