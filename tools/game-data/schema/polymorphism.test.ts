import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { decodeCatalog } from "./compiler/catalog.ts";
import { resolveContract } from "./compiler/contract.ts";
import { FragmentXmlSchema } from "./tests/fixtures/polymorphism.generated.ts";
import { parseFragment } from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/polymorphism.catalog.json", import.meta.url),
		"utf8",
	),
);
const xml = await readFile(
	new URL("./tests/fixtures/polymorphism.xml", import.meta.url),
	"utf8",
);
const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

test("XmlInclude on unrelated owners enables only assignable variants", async () => {
	const contract = resolveContract(decodeCatalog(catalog), "Example.Container");
	assert.deepEqual(contract.root.variants, ["Example.Container"]);
	assert.deepEqual(
		contract.objects.find((type) => type.clrType === "Example.Animal")
			?.variants,
		["Example.Animal", "Example.Cat", "Example.Dog"],
	);
	assert.ok(!contract.objects.some((type) => type.clrType === "Example.Bird"));
	const result = await decode(xml);
	const pet = result.value.Pet;
	// Compile-time narrowing is part of the generated API, not just runtime dispatch.
	assert.equal(pet.type, "Example.Dog");
	if (pet.type === "Example.Dog") {
		const barkCount: number = pet.value.BarkCount;
		assert.equal(barkCount, 3);
	}
	assert.equal(result.value.Pets[0]?.type, "Example.Cat");
	assert.equal(result.value.Pets[1]?.type, "Example.Animal");
});

test("inherited namespace bindings and original discriminator spelling survive no-op export", async () => {
	assert.deepEqual(
		await parse(await encode(await decode(xml))),
		await parse(xml),
	);
});

test("editing a derived field preserves unknown XML and type aliases", async () => {
	const result = await decode(xml);
	const pet = result.value.Pet;
	assert.equal(pet.type, "Example.Dog");
	if (pet.type !== "Example.Dog") throw new Error("Expected dog");
	const output = await encode({
		...result,
		value: {
			...result.value,
			Pet: { ...pet, value: { ...pet.value, BarkCount: 4 } },
		},
	});
	assert.match(output, /i:type="p:Hound"/);
	assert.match(
		output,
		/<BarkCount>4<\/BarkCount><!-- keep --><future>unknown<\/future>/,
	);
	assert.equal((await decode(output)).value.Pet.type, "Example.Dog");
});

test("unknown, unrelated, unbound and wrong-namespace type names fail closed", async () => {
	for (const type of ["Missing", "Bird", "missing:Hound", "i:Hound"]) {
		await assert.rejects(
			decode(xml.replace('i:type="p:Hound"', `i:type="${type}"`)),
			/xsi:type|prefix/,
		);
	}
	await assert.rejects(
		decode(
			xml.replace(
				'xmlns:i="http://www.w3.org/2001/XMLSchema-instance"',
				'xmlns:i="urn:not-xsi"',
			),
		),
	);
});

test("moving a derived object to a conflicting namespace scope retains its identity", async () => {
	const result = await decode(
		xml.replace("<Pets>", '<Pets xmlns:p="urn:other">'),
	);
	const output = await encode({
		...result,
		value: { ...result.value, Pets: [result.value.Pet] },
	});
	const moved = (await decode(output)).value.Pets[0];
	assert.equal(moved?.type, "Example.Dog");
	assert.match(output, /xmlns:p="urn:pets"/);
});

test("encoding a selected derived case writes its type discriminator", async () => {
	const result = await decode(xml);
	const pet = result.value.Pet;
	assert.equal(pet.type, "Example.Dog");
	if (pet.type !== "Example.Dog") throw new Error("Expected dog");
	const attributes = { ...pet.original.attributes };
	delete attributes["i:type"];
	const output = await encode({
		...result,
		value: {
			...result.value,
			Pet: { ...pet, original: { ...pet.original, attributes } },
		},
	});
	assert.equal((await decode(output)).value.Pet.type, "Example.Dog");
	assert.match(output, /:type="[^"]*Hound"/);
});

test("type annotation errors identify missing, malformed and ambiguous includes", () => {
	const missing = structuredClone(catalog);
	missing.types[0].attributes[0].constructorArguments[0].value = "Missing.Type";
	assert.throws(
		() => generate(missing, "Example.Container"),
		/included type is missing.*Missing.Type/,
	);
	const malformed = structuredClone(catalog);
	malformed.types[0].attributes[0].constructorArguments[0].type =
		"System.String";
	assert.throws(
		() => generate(malformed, "Example.Container"),
		/XmlInclude requires one System.Type/,
	);
	const ambiguous = structuredClone(catalog);
	ambiguous.types[4].attributes = structuredClone(
		ambiguous.types[3].attributes,
	);
	assert.throws(
		() => generate(ambiguous, "Example.Container"),
		/ambiguous XML type/,
	);
});

test("abstract bases require an explicit known concrete type", async () => {
	const abstract = structuredClone(catalog);
	abstract.types[2].isAbstract = true;
	const directory = await mkdtemp(
		join(import.meta.dirname, ".polymorphism-test-"),
	);
	try {
		const file = join(directory, "generated.ts");
		await writeFile(
			file,
			generate(abstract, "Example.Container", "../xml-codecs.ts"),
		);
		const generated = await import(pathToFileURL(file).href);
		const codec = generated.FragmentXmlSchema as typeof FragmentXmlSchema;
		const valid = xml.replace(
			"<Animal><Name>Base</Name></Animal>",
			'<Animal i:type="Kitten"><Name>Cat</Name><Lives>8</Lives></Animal>',
		);
		await Effect.runPromise(Schema.decodeEffect(codec)(valid));
		await assert.rejects(
			Effect.runPromise(Schema.decodeEffect(codec)(xml)),
			/xsi:type/,
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("namespace prefixes are literal keys, including JavaScript prototype names", async () => {
	const aliased = xml
		.replaceAll("xmlns:p=", "xmlns:__proto__=")
		.replaceAll("p:Hound", "__proto__:Hound");
	const result = await decode(aliased);
	assert.equal(result.value.Pet.type, "Example.Dog");
	assert.equal(
		(await decode(await encode(result))).value.Pet.type,
		"Example.Dog",
	);
});
