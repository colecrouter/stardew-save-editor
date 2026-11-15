import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { Schema } from "effect";

const cli = resolve("tools/game-data/bin/Debug/net10.0/GameData.dll");
const fixtures = resolve("tools/game-data/tests/fixtures");
const run = (...args: string[]) =>
	spawnSync("dotnet", [cli, ...args], { encoding: "utf8" });

void test("coverage consumes the same resolved contract as generation", () => {
	// The descriptive command name and its compatibility alias must report the
	// same coverage, so existing automation can migrate without a behavior change.
	for (const command of ["coverage", "validate"]) {
		const result = run(
			command,
			"--catalog",
			join(fixtures, "fixture.catalog.json"),
			"--save",
			join(fixtures, "fixture.xml"),
		);
		assert.equal(result.status, 0, result.stderr);
		// Validate the CLI report envelope before comparing its coverage results.
		const report = Schema.decodeUnknownSync(
			Schema.Struct({
				files: Schema.Array(
					Schema.Struct({
						issues: Schema.Array(Schema.Unknown),
						unchecked: Schema.Array(Schema.Unknown),
						matchedElements: Schema.Finite,
					}),
				),
			}),
		)(JSON.parse(result.stdout));
		assert.deepEqual(report.files[0]?.issues, []);
		assert.deepEqual(report.files[0]?.unchecked, []);
		assert.ok((report.files[0]?.matchedElements ?? 0) > 0);
	}
});

void test("generation reports invalid contracts without replacing an existing module", async () => {
	const directory = await mkdtemp(join(tmpdir(), "game-data-"));
	try {
		const input = join(directory, "catalog.json"),
			output = join(directory, "generated.ts");
		const base = {
			formatVersion: 3,
			diagnostics: [],
			types: [{ id: "Example.Root", kind: "object", members: [] }],
		};
		// Each corruption would otherwise silently narrow or ambiguously interpret
		// the codec. The CLI must fail before publishing output in every case.
		for (const catalog of [
			{ ...base, formatVersion: 2 },
			{ ...base, diagnostics: ["loader failure"] },
			{ ...base, types: [...base.types, ...base.types] },
			{
				...base,
				types: [
					{
						...base.types[0],
						members: [{ name: "Future", type: "Unsupported.Type" }],
					},
				],
			},
		]) {
			await writeFile(input, JSON.stringify(catalog));
			await writeFile(output, "keep existing output");
			const result = run(
				"generate",
				"--catalog",
				input,
				"--type",
				"Example.Root",
				"--output",
				output,
			);
			assert.equal(result.status, 1);
			assert.notEqual(result.stderr.trim(), "");
			assert.equal(await readFile(output, "utf8"), "keep existing output");
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
