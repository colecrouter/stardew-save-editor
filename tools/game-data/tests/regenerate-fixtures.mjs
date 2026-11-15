import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

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
	const committed = resolve(destination, `${name}.ts`);
	// A sibling output keeps the emitted runtime import identical to the snapshot.
	// Verification never overwrites a committed fixture, including when generation fails.
	const output = check ? resolve(destination, `${name}.verify.ts`) : committed;
	try {
		run("dotnet", [
			cli,
			"generate",
			"--catalog",
			input,
			"--type",
			root,
			"--output",
			output,
		]);
		if (check) {
			// Git may check out CRLF on Windows; only source content is significant.
			const normalize = (/** @type {string} */ text) =>
				text.replaceAll("\r\n", "\n");
			if (
				normalize(readFileSync(output, "utf8")) !==
				normalize(readFileSync(committed, "utf8"))
			)
				throw new Error(
					`Stale codec fixture: ${committed}. Run npm run game-data:fixtures.`,
				);
		}
	} finally {
		if (check) rmSync(output, { force: true });
	}
}
