import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import {
	FragmentSchema,
	FragmentXmlSchema,
} from "./tests/fixtures/profile.generated.ts";
import { FragmentSchema as WorldDateSchema } from "./tests/fixtures/world-date.generated.ts";
import { parseFragment, printFragment } from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/catalog.json", import.meta.url),
		"utf8",
	),
);
const xml = (
	await readFile(
		new URL("./tests/fixtures/profile.xml", import.meta.url),
		"utf8",
	)
).trim();
const parse = (xml: string) => Effect.runPromise(parseFragment(xml));
const print = (tree: Parameters<typeof printFragment>[0]) =>
	Effect.runPromise(printFragment(tree));
const decode = Schema.decodeUnknownSync(FragmentSchema);
const encode = Schema.encodeSync(FragmentSchema);

test("generated codec infers typed fields and decodes real XML text", async () => {
	const decoded = decode(await parse(xml));
	// These assignments are also compile-time assertions for the generated API.
	const count: number = decoded.value.Count;
	const enabled: boolean = decoded.value.Enabled;
	const season: "spring" | "winter" = decoded.value.Season;
	const tags: readonly string[] = decoded.value.Tags;
	assert.deepEqual(
		[count, enabled, season, tags],
		[7, true, "spring", ["one", "two"]],
	);
	assert.equal(decoded.value.Name, "A & B");
});

test("unedited round trips preserve the parsed tree and scalar spelling", async () => {
	const original = await parse(xml);
	assert.deepEqual(encode(decode(original)), original);
	assert.deepEqual(
		await parse(await print(encode(decode(original)))),
		original,
	);
});

test("editing one field preserves unknown nodes, attributes, comments, and PI", async () => {
	const original = await parse(xml);
	const decoded = decode(original);
	const edited = encode({ ...decoded, value: { ...decoded.value, Count: 8 } });
	const result = await print(edited);
	assert.match(result, /<Count>8<\/Count>/);
	assert.match(result, /<!-- preserve this comment -->/);
	assert.match(result, /<\?mod keep\?>/);
	assert.match(
		result,
		/<Unknown flag="yes"><nested>untouched<\/nested><\/Unknown>/,
	);
	assert.equal(edited.attributes.modded, "keep");
	assert.match(result, /<Enabled>1<\/Enabled>/);
	assert.equal(decode(original).value.Count, 7);
});

test("collection edits retain unknown wrapper children and item attributes", async () => {
	const decoded = decode(await parse(xml));
	const output = await print(
		encode({
			...decoded,
			value: { ...decoded.value, Tags: ["changed", "two", "three"] },
		}),
	);
	assert.match(
		output,
		/<tag code="x">changed<\/tag><future>keep<\/future><tag>two<\/tag><tag>three<\/tag>/,
	);
	assert.deepEqual(decode(await parse(output)).value.Tags, [
		"changed",
		"two",
		"three",
	]);
});

test("field codecs reject invalid and overflowing integers, boolean spellings, and enums", async () => {
	for (const invalid of [
		xml.replace("0007", "1.5"),
		xml.replace("0007", "2147483648"),
		xml.replace("<Enabled>1", "<Enabled>yes"),
		xml.replace("spring", "autumn"),
	]) {
		const tree = await parse(invalid);
		assert.throws(() => decode(tree), /Count|Enabled|Season/);
	}
});

test("ambiguous or missing known elements fail rather than choosing a value", async () => {
	for (const invalid of [
		xml.replace("<Count>0007</Count>", ""),
		xml.replace("<Count>0007</Count>", "<Count>1</Count><Count>2</Count>"),
	]) {
		const tree = await parse(invalid);
		assert.throws(() => decode(tree), /Count/);
	}
});

test("Effect rejects malformed XML and unsupported document declarations", async () => {
	await assert.rejects(parse("<Profile><Count></Profile>"));
	await assert.rejects(parse("<!DOCTYPE Profile><Profile/>"));
});

test("real game WorldDate sample uses the same generated codec helpers", async () => {
	const original = await parse(
		"<WorldDate><DayOfMonth>5</DayOfMonth><Season>spring</Season><Year>2</Year><mod>keep</mod></WorldDate>",
	);
	const value = Schema.decodeSync(WorldDateSchema)(original);
	assert.equal(value.value.Year, 2);
	const edited = Schema.encodeSync(WorldDateSchema)({
		...value,
		value: { ...value.value, Year: 3 },
	});
	assert.match(await print(edited), /<Year>3<\/Year><mod>keep<\/mod>/);
});

test("generation is deterministic and rejects unsupported mappings with a path", () => {
	assert.equal(
		generate(catalog, "Example.Profile"),
		generate(catalog, "Example.Profile"),
	);
	const unsupported = structuredClone(catalog);
	unsupported.types[0].members[0].type = "Netcode.NetString";
	assert.throws(
		() => generate(unsupported, "Example.Profile"),
		/Example.Profile.Version.*Netcode.NetString/,
	);
	const namespaced = structuredClone(catalog);
	namespaced.types[0].attributes[0].namedArguments.Namespace = {
		type: "System.String",
		value: "urn:save",
	};
	assert.throws(
		() => generate(namespaced, "Example.Profile"),
		/unsupported.*Namespace/,
	);
});

test("generated XML string codec uses Effect Schema for both directions", async () => {
	const decoded = await Effect.runPromise(
		Schema.decodeEffect(FragmentXmlSchema)(xml),
	);
	const output = await Effect.runPromise(
		Schema.encodeEffect(FragmentXmlSchema)({
			...decoded,
			value: { ...decoded.value, Name: "New <name>" },
		}),
	);
	assert.match(output, /<Name>New &lt;name&gt;<\/Name>/);
	assert.match(output, /<Count>0007<\/Count>/);
});

test("CLI generates an importable typed module and preserves output on failure", async () => {
	// Put the temporary module under the repository so its bare Effect import
	// resolves exactly as a user's generated application module would.
	const directory = await mkdtemp(join(import.meta.dirname, ".cli-test-"));
	try {
		const outputDirectory = join(directory, "nested");
		const output = join(outputDirectory, "generated.ts");
		const cli = join(import.meta.dirname, "cli.ts");
		const catalogPath = join(
			import.meta.dirname,
			"tests/fixtures/catalog.json",
		);
		const success = spawnSync(
			process.execPath,
			[
				cli,
				"--catalog",
				catalogPath,
				"--type",
				"Example.Profile",
				"--output",
				output,
			],
			{ encoding: "utf8" },
		);
		assert.equal(success.status, 0, success.stderr);
		const generated = await import(pathToFileURL(output).href);
		const codec = generated.FragmentXmlSchema as typeof FragmentXmlSchema;
		const decoded = await Effect.runPromise(Schema.decodeEffect(codec)(xml));
		assert.equal(decoded.value.Count, 7);
		// Output parents are created as needed and scoped staging directories are
		// gone before the command exits, leaving only the finished module.
		assert.deepEqual(await readdir(outputDirectory), ["generated.ts"]);
		await writeFile(output, "keep existing output");
		const failure = spawnSync(
			process.execPath,
			[
				cli,
				"--catalog",
				catalogPath,
				"--type",
				"Missing.Type",
				"--output",
				output,
			],
			{ encoding: "utf8" },
		);
		assert.equal(failure.status, 1);
		assert.match(failure.stderr, /Missing.Type/);
		assert.equal(await readFile(output, "utf8"), "keep existing output");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("known namespaced and nil elements aren't silently treated as plain values", async () => {
	for (const source of [
		xml.replace("<Profile version=", '<Profile xmlns="urn:other" version='),
		xml.replace("<Count>", '<Count xmlns="urn:other">'),
		xml.replace(
			"<Count>",
			'<Count xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true">',
		),
	]) {
		const tree = await parse(source);
		assert.throws(() => decode(tree), /unsupported/);
	}
});

test("Effect CLI provides help/version and rejects missing or unknown flags", () => {
	const cli = join(import.meta.dirname, "cli.ts");
	const run = (...args: string[]) =>
		spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
	const help = run("--help");
	assert.equal(help.status, 0, help.stderr);
	for (const flag of ["--catalog", "--type", "--output"])
		assert.match(help.stdout, new RegExp(flag));
	const version = run("--version");
	assert.equal(version.status, 0, version.stderr);
	assert.match(version.stdout, /0\.1\.0/);
	const missing = run();
	assert.equal(missing.status, 1);
	assert.match(missing.stdout + missing.stderr, /catalog/);
	const unknown = run("--not-a-flag", "value");
	assert.equal(unknown.status, 1);
	assert.match(unknown.stdout + unknown.stderr, /not-a-flag/);
});
