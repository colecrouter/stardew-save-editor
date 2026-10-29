import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@vitejs/plugin-legacy"));
// Exercise every copy the application or Vite can load. A future dependency-layout
// change must not silently leave an unpatched nested copy in the production build.
const paths = [
	...new Set([
		require.resolve("core-js/modules/web.structured-clone.js"),
		pluginRequire.resolve("core-js/modules/web.structured-clone.js"),
	]),
];

for (const path of paths) {
	describe(`installed core-js clone policy: ${path}`, () => {
		const source = readFileSync(path, "utf8");
		const detector = source.match(
			/var checkErrorsCloning = (function [\s\S]*?\n});/,
		);
		const policy = source.match(/var FORCED_REPLACEMENT = ([\s\S]*?);/);
		if (!detector || !policy)
			throw new Error("Installed clone detection changed; review the patch");

		// Execute the installed detection and decision together, rather than restating
		// their implementation. Proposed AggregateError support deliberately fails here.
		const forced = (clone?: (value: { a: Error; b: Error }) => unknown) =>
			runInNewContext(
				`var checkErrorsCloning = ${detector[1]}; (${policy[1]})`,
				{
					IS_PURE: false,
					Error,
					DOMException,
					nativeStructuredClone: clone,
					checkNewErrorsCloningSemantic: () => false,
					fails: (run: () => unknown) => {
						try {
							return Boolean(run());
						} catch {
							return true;
						}
					},
				},
			);
		const clone =
			(preserveErrorStack = true, preserveType = true, preserveAlias = true) =>
			({ a }: { a: Error; b: Error }) => {
				const copy = Object.create(
					preserveType ? Object.getPrototypeOf(a) : Object.prototype,
				);
				// Model the observed browser: ordinary Error stacks survive; the stack added
				// by core-js to DOMException does not. These are separate policy decisions.
				if (preserveErrorStack && !(a instanceof DOMException))
					copy.stack = a.stack;
				return { a: copy, b: preserveAlias ? copy : {} };
			};

		it("keeps native cloning despite AggregateError and DOMException stack limitations", () => {
			expect(forced(clone())).toBe(false);
		});

		it("still repairs missing native cloning, Error stacks, types and shared references", () => {
			expect(forced()).toBe(true);
			expect(forced(clone(false))).toBe(true);
			expect(forced(clone(true, false))).toBe(true);
			expect(forced(clone(true, true, false))).toBe(true);
		});
	});
}
