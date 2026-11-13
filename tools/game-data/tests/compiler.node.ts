import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { XmlSchema, ValueSchema } from "./generated/fixture.ts";
import { decodeChunks } from "../../../src/lib/save-format/index.ts";

const cli = resolve("tools/game-data/bin/Debug/net10.0/GameData.dll");
const generated = resolve("tools/game-data/tests/generated");
const run = (...args: string[]) =>
	spawnSync("dotnet", [cli, ...args], { encoding: "utf8" });

// Node owns completion and failure reporting for registered tests. Let module
// initialization finish rather than awaiting a case before later helpers exist.
void test("event codecs consume arbitrarily split text without collecting a source tree", async () => {
	const xml = await readFile(join(generated, "fixture.xml"), "utf8");
	const chunks = function* () {
		// Split names, entities and attribute values too; transport chunk boundaries
		// must not change the typed result or truncate a final element.
		for (let offset = 0; offset < xml.length; offset += 7)
			yield xml.slice(offset, offset + 7);
	};
	assert.deepEqual(
		await Effect.runPromise(decodeChunks("SaveGame", ValueSchema, chunks())),
		Schema.decodeSync(XmlSchema)(xml),
	);
	await assert.rejects(
		Effect.runPromise(
			decodeChunks("SaveGame", ValueSchema, ["<SaveGame><Money>1"]),
		),
	);
});

void test("inspection and generated codecs agree with .NET XmlSerializer after creation and reordering", async () => {
	const original = Schema.decodeSync(XmlSchema)(
		await readFile(join(generated, "fixture.xml"), "utf8"),
	);
	assert.equal(original.FarmerId, 9007199254740993n);
	assert.equal(original.Name, "007");
	assert.equal(original.Day, null);
	assert.equal(original.Status, "Ready");
	assert.equal(original.Equipped?.$type, "StardewValley.Tool");
	assert.throws(() =>
		Schema.decodeUnknownSync(ValueSchema)({ ...original, Money: "invalid" }),
	);
	const edited = {
		...structuredClone(original),
		Money: 42,
		Status: "Done",
		Equipped: null,
		Day: 19,
		Items: [
			null,
			{ $type: "StardewValley.Tool" as const, Name: "new", Level: 4 },
			...(original.Items ?? []).filter((item) => item !== null),
		],
	};
	const xml = Schema.encodeSync(XmlSchema)(edited);
	const result = spawnSync(
		"dotnet",
		[join(generated, "game/Stardew Valley.dll"), "read"],
		{ encoding: "utf8", input: xml },
	);
	assert.equal(result.status, 0, result.stderr);
	const data = JSON.parse(result.stdout);
	assert.equal(data.Money, 42);
	assert.equal(data.Day, 19);
	assert.equal(data.Status, "Done");
	assert.equal(data.Equipped, null);
	assert.doesNotMatch(xml, /<Equipped/);
	assert.equal(Schema.decodeSync(XmlSchema)(xml).Equipped, null);
	assert.equal(data.Name, "007");
	assert.deepEqual(data.Items, [
		null,
		{ Type: "Tool", Name: "new", Level: 4 },
		{ Type: "Tool", Name: "Axe", Level: 2 },
	]);
});

void test("coverage consumes the same resolved contract as generation", () => {
	// The descriptive command name and its compatibility alias must report the
	// same coverage, so existing automation can migrate without a behavior change.
	for (const command of ["coverage", "validate"]) {
		const result = run(
			command,
			"--catalog",
			join(generated, "fixture.catalog.json"),
			"--save",
			join(generated, "fixture.xml"),
		);
		assert.equal(result.status, 0, result.stderr);
		const report = JSON.parse(result.stdout);
		assert.deepEqual(report.files[0].issues, []);
		assert.deepEqual(report.files[0].unchecked, []);
		assert.ok(report.files[0].matchedElements > 0);
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
			assert.ok(result.stderr.trim());
			assert.equal(await readFile(output, "utf8"), "keep existing output");
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
