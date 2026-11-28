import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { Schema } from "effect";

// Runtime checks consume committed codecs. Only explicit maintenance and the
// compiler CI job rebuild them, so routine linting never requires the .NET SDK.
const check = process.argv.includes("--check");
/** @param {string} command @param {string[]} args */
function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stdout + result.stderr);
	return result.stdout;
}
const destination = resolve("tools/game-data/tests/generated");
mkdirSync(destination, { recursive: true });
// Verification generates into a sibling directory at the same depth, so the
// emitted runtime imports match the committed fixtures, and it never overwrites
// a committed fixture, including when generation fails.
const verify = resolve("tools/game-data/tests/.verify");
/**
 * Every file of one generated fixture: its entry module plus the namespace
 * modules in the directory named after it, as paths relative to `root`.
 * @param {string} root @param {string} name
 */
function fixtureFiles(root, name) {
	const directory = join(root, name);
	const modules = existsSync(directory)
		? readdirSync(directory).map((file) =>
				relative(root, join(directory, file)),
			)
		: [];
	return [`${name}.ts`, ...modules].sort();
}
// Git may check out CRLF on Windows; only source content is significant.
const normalize = (/** @type {string} */ text) => text.replaceAll("\r\n", "\n");
run("dotnet", ["build", "tools/game-data", "--nologo", "--verbosity", "quiet"]);
const cli = resolve("tools/game-data/bin/Debug/net10.0/GameData.dll");
const fixtures = resolve("tools/game-data/tests/fixtures");
for (const filename of readdirSync(fixtures).filter((name) =>
	name.endsWith(".catalog.json"),
)) {
	const input = resolve(fixtures, filename);
	// Fixture selection only needs these catalog fields; validate them before
	// trusting JSON input to choose the generated root.
	const catalog = Schema.decodeUnknownSync(
		Schema.Struct({
			roots: Schema.optional(Schema.Array(Schema.String)),
			types: Schema.Array(
				Schema.Struct({
					id: Schema.String,
					kind: Schema.String,
					customXml: Schema.optional(Schema.Boolean),
				}),
			),
		}),
	)(JSON.parse(readFileSync(input, "utf8")));
	// Explicit roots take precedence; older single-root fixtures use their first object.
	const root =
		catalog.roots?.[0] ??
		catalog.types.find(
			(type) => type.kind === "object" && type.customXml !== true,
		)?.id;
	if (root === undefined || root.length === 0)
		throw new Error(`No fixture root in ${filename}`);
	const name = filename.replace(".catalog.json", "");
	try {
		run("dotnet", [
			cli,
			"generate",
			"--catalog",
			input,
			"--type",
			root,
			"--output",
			resolve(check ? verify : destination, `${name}.ts`),
		]);
		if (check) {
			// The fixture is stale if any module was added, removed or changed.
			const generated = fixtureFiles(verify, name);
			const stale =
				generated.join() !== fixtureFiles(destination, name).join() ||
				generated.some(
					(file) =>
						normalize(readFileSync(join(verify, file), "utf8")) !==
						normalize(readFileSync(join(destination, file), "utf8")),
				);
			if (stale)
				throw new Error(
					`Stale codec fixture: ${name}. Run npm run game-data:fixtures.`,
				);
		}
	} finally {
		if (check) rmSync(verify, { recursive: true, force: true });
	}
}
