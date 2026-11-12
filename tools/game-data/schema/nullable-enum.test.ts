import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { nullableEnumText, parseFragment } from "./xml-codecs.ts";
import { FragmentXmlSchema } from "./tests/fixtures/nullable-enum.generated.ts";
import { FragmentXmlSchema as RecursiveSchema } from "./tests/fixtures/nullable-enum-recursive.generated.ts";

const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

test("nullable enum wrapper infers its full enum domain and preserves absent vs empty elements", async () => {
	const data = await decode("<Preserve><preserve>Jelly</preserve></Preserve>");
	const label:
		| "AgedRoe"
		| "Bait"
		| "DriedFruit"
		| "DriedMushroom"
		| "Honey"
		| "Jelly"
		| "Juice"
		| "Pickle"
		| "Roe"
		| "SmokedFish"
		| "Wine"
		| null
		| undefined = data.value.preserve[0];
	assert.equal(label, "Jelly");
	assert.deepEqual((await decode("<Preserve/>")).value.preserve, []);
	assert.deepEqual(
		(await decode("<Preserve><preserve/></Preserve>")).value.preserve,
		[null],
	);
	for (const xml of [
		"<Preserve/>",
		'<Preserve><preserve flag="keep"><!-- empty --></preserve><future>keep</future></Preserve>',
		"<Preserve><preserve>Wine</preserve></Preserve>",
	])
		assert.deepEqual(
			await parse(await encode(await decode(xml))),
			await parse(xml),
		);
});

test("nullable enum edits preserve attributes, comments and unknown siblings", async () => {
	const original = await decode(
		'<Preserve><preserve flag="keep">Jelly<!-- note --></preserve><future>keep</future></Preserve>',
	);
	const cleared = await encode({ ...original, value: { preserve: [null] } });
	assert.match(cleared, /<preserve flag="keep"><!-- note --><\/preserve>/);
	assert.deepEqual((await decode(cleared)).value.preserve, [null]);
	const changed = await encode({ ...original, value: { preserve: ["Wine"] } });
	assert.match(changed, /<preserve flag="keep">Wine<!-- note --><\/preserve>/);
	const removed = await encode({ ...original, value: { preserve: [] } });
	assert.doesNotMatch(removed, /<preserve[ >]/);
	assert.match(removed, /<future>keep<\/future>/);
	const empty = await decode("<Preserve><future>keep</future></Preserve>");
	assert.match(
		await encode({ ...empty, value: { preserve: ["Honey"] } }),
		/<future>keep<\/future><preserve>Honey<\/preserve>/,
	);
});

test("nullable enum rejects unknown labels, numeric aliases, nil, and multiple entries", async () => {
	for (const content of [
		"Unknown",
		"jelly",
		"0",
		" ",
		"Jelly, Wine",
		"<nested/>",
	])
		await assert.rejects(
			decode(`<Preserve><preserve>${content}</preserve></Preserve>`),
		);
	await assert.rejects(
		decode(
			'<Preserve xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><preserve i:nil="true"/></Preserve>',
		),
	);
	await assert.rejects(
		decode(
			"<Preserve><preserve>Jelly</preserve><preserve>Wine</preserve></Preserve>",
		),
	);
	const original = await decode("<Preserve/>");
	await assert.rejects(
		encode({ ...original, value: { preserve: ["Jelly", "Wine"] } }),
	);
});

test("nullable enum text codec rejects labels outside its supplied domain", () => {
	const codec = nullableEnumText(["saved-jelly", "Wine"]);
	assert.equal(Schema.decodeSync(codec)("saved-jelly"), "saved-jelly");
	assert.equal(Schema.decodeSync(codec)(""), null);
	assert.equal(Schema.encodeSync(codec)(null), "");
	assert.throws(() => Schema.decodeSync(codec)("Jelly"));
});

test("nullable enums remain typed inside recursive generated modules", async () => {
	const xml =
		"<Item><name>root</name><preserve>Jelly</preserve><next><name>child</name><preserve/></next></Item>";
	const decoded = await Effect.runPromise(
		Schema.decodeEffect(RecursiveSchema)(xml),
	);
	const value: string | null | undefined =
		decoded.value.next[0]?.value.preserve[0];
	assert.equal(value, null);
	assert.deepEqual(
		await parse(
			await Effect.runPromise(Schema.encodeEffect(RecursiveSchema)(decoded)),
		),
		await parse(xml),
	);
});

test("nullable enum wrapper requires current inspection metadata and an enum argument", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/nullable-enum.catalog.json", import.meta.url),
			"utf8",
		),
	);
	const old = structuredClone(catalog);
	old.types[2].elementType =
		"System.Nullable`1[StardewValley.Object+PreserveType]";
	assert.throws(() => generate(old, "Example.Preserve"), /reinspect the game/);
	const bad = structuredClone(catalog);
	bad.types[2].genericArguments = ["System.String"];
	assert.throws(() => generate(bad, "Example.Preserve"), /requires an enum/);

	const aliased = structuredClone(catalog);
	aliased.types[3].members.find(
		(member: { name: string }) => member.name === "Jelly",
	).attributes = [
		{
			type: "System.Xml.Serialization.XmlEnumAttribute",
			constructorArguments: [{ type: "System.String", value: "saved-jelly" }],
		},
	];
	// The wrapper serializes Enum.ToString, not the enum XmlSerializer's alias.
	const source = generate(aliased, "Example.Preserve");
	assert.match(source, /"Jelly"/);
	assert.doesNotMatch(source, /saved-jelly/);
	assert.equal(
		generate(catalog, "Example.Preserve"),
		generate(catalog, "Example.Preserve"),
	);
});
