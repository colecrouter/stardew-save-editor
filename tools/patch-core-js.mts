import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const original = `var FORCED_REPLACEMENT = IS_PURE
  || !checkErrorsCloning(nativeStructuredClone, Error)
  || !checkErrorsCloning(nativeStructuredClone, DOMException)
  || !checkNewErrorsCloningSemantic(nativeStructuredClone);`;
const patched = `// Application policy: proposed AggregateError serialization alone must not
// replace native cloning. Keep Error stacks, DOMException type/alias repairs,
// and the missing-native fallback. DOMException stack loss alone is accepted.
var FORCED_REPLACEMENT = IS_PURE
  || !checkErrorsCloning(nativeStructuredClone, Error)
  || !checkErrorsCloning(nativeStructuredClone, DOMException);`;

const originalStack = "test.a.stack === error.stack";
const patchedStack =
	"($Error === DOMException || test.a.stack === error.stack)";

/** Apply only the reviewed replacement-policy changes; fail closed on upstream drift. */
export function patchClonePolicy(source: string, version: string): string {
	// A dependency update needs a fresh review of both detection and fallback behavior.
	if (version !== "3.46.0")
		throw new Error(`Review core-js clone patch for version ${version}`);
	// Treat the two edits as one policy. Accept only a pristine module or our fully
	// patched module; partially applied edits need review rather than silent repair.
	const fullyPatched =
		source.includes(patched) && source.includes(patchedStack);
	const pristine =
		source.split(original).length === 2 &&
		source.split(originalStack).length === 2 &&
		!source.includes(patched) &&
		!source.includes(patchedStack);
	if (
		fullyPatched &&
		!source.includes(original) &&
		source.split(patched).length === 2 &&
		source.split(patchedStack).length === 2 &&
		source.split(originalStack).length === 2
	)
		return source;
	if (!pristine || fullyPatched)
		throw new Error(
			"core-js structuredClone source changed; review the clone policy patch",
		);
	// core-js adds DOMException.stack in another shim. Native cloning may omit that
	// added stack; accept this while retaining type/alias checks and Error stacks.
	return source.replace(original, patched).replace(originalStack, patchedStack);
}

export function patchInstalledCoreJs() {
	const require = createRequire(import.meta.url);
	// Vite resolves core-js from plugin-legacy. Patch that copy as well as the
	// direct dependency if npm installs them separately; never assume hoisting.
	const pluginRequire = createRequire(require.resolve("@vitejs/plugin-legacy"));
	const paths = new Set([
		require.resolve("core-js/modules/web.structured-clone.js"),
		pluginRequire.resolve("core-js/modules/web.structured-clone.js"),
	]);
	// Validate every copy before writing any of them, so version drift does not
	// leave an install partly patched. Repeated installs accept our exact patch.
	const updates = [...paths].map((path) => {
		const localRequire = createRequire(path);
		const version = localRequire("../package.json").version as string;
		const source = readFileSync(path, "utf8");
		return { path, source, result: patchClonePolicy(source, version) };
	});
	for (const { path, source, result } of updates) {
		if (result !== source) writeFileSync(path, result);
	}
}

// Importing the pure patch function in tests must not modify installed packages.
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	patchInstalledCoreJs();
}
