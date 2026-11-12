import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { inventory, structure, element, parseFragment } from "./xml-codecs.ts";
import { FragmentXmlSchema } from "./tests/fixtures/inventory.generated.ts";
const xml = await readFile(
	new URL("./tests/fixtures/inventory.xml", import.meta.url),
	"utf8",
);
const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

test("Inventory infers polymorphic items and preserves null slot indices and no-op XML", async () => {
	const data = await decode(xml);
	const slots = data.value.Items.value;
	assert.equal(slots.length, 3);
	assert.equal(slots[0]?.value?.type, "Example.Dog");
	assert.equal(slots[1]?.value, null);
	assert.equal(slots[2]?.value?.type, "Example.Cat");
	assert.deepEqual(await parse(await encode(data)), await parse(xml));
});

test("Inventory occupied-slot edits preserve other slots and unknown XML", async () => {
	const data = await decode(xml);
	const slot = data.value.Items.value[0];
	assert.ok(slot);
	const dog = slot.value;
	assert.ok(dog);
	if (dog.type !== "Example.Dog") throw new Error("Expected Dog fixture");
	const output = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [
					{ ...slot, value: { ...dog, value: { ...dog.value, BarkCount: 4 } } },
					...data.value.Items.value.slice(1),
				],
			},
		},
	});
	assert.match(
		output,
		/<BarkCount>4<\/BarkCount><unknown-item>keep<\/unknown-item>/,
	);
	assert.match(
		output,
		/<Item i:nil="1" mod="empty"><!-- empty note --><\/Item>/,
	);
	assert.match(output, /<future-inventory>keep<\/future-inventory>/);
	assert.equal((await decode(output)).value.Items.value[1]?.value, null);
});

test("Inventory clearing and filling slots preserves positions without stale type or nil attributes", async () => {
	const data = await decode(xml);
	const [occupied, empty, last] = data.value.Items.value;
	assert.ok(occupied && empty && last);
	const cleared = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [{ ...occupied, value: null }, empty, last],
			},
		},
	});
	const clearedData = await decode(cleared);
	assert.equal(clearedData.value.Items.value.length, 3);
	assert.equal(clearedData.value.Items.value[0]?.value, null);
	assert.doesNotMatch(
		cleared.match(/<Items[\s\S]*?<\/Items>/)?.[0] ?? "",
		/p:Hound/,
	);
	const filled = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [occupied, { ...empty, value: occupied.value }, last],
			},
		},
	});
	assert.deepEqual(
		(await decode(filled)).value.Items.value.map((slot) => slot.value?.type),
		["Example.Dog", "Example.Dog", "Example.Cat"],
	);
});

test("Inventory moves null slots with their provenance and handles empty inventories", async () => {
	const data = await decode(xml);
	const empty = data.value.Items.value[1];
	assert.ok(empty);
	const reordered = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [
					empty,
					...data.value.Items.value.filter((slot) => slot !== empty),
					empty,
				],
			},
		},
	});
	assert.deepEqual(
		(await decode(reordered)).value.Items.value.map(
			(slot) => slot.value?.type ?? null,
		),
		[null, "Example.Dog", "Example.Cat", null],
	);
	assert.equal((reordered.match(/mod="empty"/g) ?? []).length, 2);
	const cleared = await encode({
		...data,
		value: { ...data.value, Items: { ...data.value.Items, value: [] } },
	});
	assert.deepEqual((await decode(cleared)).value.Items.value, []);
	assert.match(
		cleared,
		/<Items mod="inventory"><future-inventory>keep<\/future-inventory><\/Items>/,
	);
});

test("Inventory nil parsing recognizes expanded names and rejects malformed or ambiguous slots", async () => {
	const alias = xml
		.replaceAll("xmlns:i=", "xmlns:instance=")
		.replaceAll("i:type=", "instance:type=")
		.replaceAll("i:nil=", "instance:nil=");
	assert.equal((await decode(alias)).value.Items.value[1]?.value, null);
	for (const replacement of [
		'i:nil="maybe"',
		'i:nil="1" j:nil="true" xmlns:j="http://www.w3.org/2001/XMLSchema-instance"',
		'bad:nil="true" xmlns:bad="urn:wrong"',
	])
		await assert.rejects(decode(xml.replace('i:nil="1"', replacement)));
	await assert.rejects(
		decode(xml.replace("<!-- empty note -->", "<Name>invalid</Name>")),
	);
	await assert.rejects(
		decode(xml.replace('i:nil="1"', 'i:nil="1" i:type="Kitten"')),
	);
	await assert.rejects(
		decode(
			xml.replace('i:type="p:Hound" mod="dog"', 'i:type="Unknown" mod="dog"'),
		),
	);
});

test("real save Inventory projection retains all twelve slots, including seven nulls", async () => {
	const save = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	// Parse the document fragment before selecting the inventory so namespace
	// bindings inherited from SaveGame remain available to its xsi:type/nil nodes.
	const root = await parse(
		save
			.trimStart()
			.replace(/^<\?xml[^?]*\?>/, "")
			.trim(),
	);
	const player = root.children.find(
		(node) => node._tag === "Element" && node.name === "player",
	);
	assert.ok(player?._tag === "Element");
	const tree = player.children.find(
		(node) => node._tag === "Element" && node.name === "items",
	);
	assert.ok(tree?._tag === "Element");
	// Project only the name field; full Item validation remains the generator's
	// responsibility. This checks actual slot/null layout without claiming full-save support.
	const codec = inventory(
		structure({ name: element("name", Schema.String) }, { allowType: true }),
	);

	const data = await Effect.runPromise(Schema.decodeEffect(codec)(tree));
	assert.equal(data.value.length, 12);
	assert.equal(data.value.filter((slot) => slot.value === null).length, 7);
	assert.equal(data.value[0]?.value?.value.name, "Rusty Sword");
	const output = await Effect.runPromise(Schema.encodeEffect(codec)(data));
	assert.deepEqual(output, tree);
});

test("fresh recursive Inventory modules initialize through Item variants", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/inventory.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types
		.find((type: { id: string }) => type.id === "Example.Dog")
		.members.push({ name: "Bag", type: "StardewValley.Inventories.Inventory" });
	const directory = await mkdtemp(
		fileURLToPath(new URL("./.inventory-test-", import.meta.url)),
	);
	try {
		const file = join(directory, "generated.ts");
		await writeFile(
			file,
			generate(catalog, "Example.Container", "../xml-codecs.ts"),
		);
		const module = await import(pathToFileURL(file).href);
		// Dynamic module loading loses static identity; this public codec requires
		// no Effect services and encodes XML text in both generation paths.
		const schema: Schema.Codec<unknown, string> = module.FragmentXmlSchema;
		const source = xml.replaceAll(
			"<BarkCount>0003</BarkCount>",
			'<BarkCount>0003</BarkCount><Bag><Item i:nil="true"/></Bag>',
		);
		const data = await Effect.runPromise(Schema.decodeEffect(schema)(source));
		assert.deepEqual(
			await parse(await Effect.runPromise(Schema.encodeEffect(schema)(data))),
			await parse(source),
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("Inventory nil writes avoid rebinding prefixes used by unknown XML", async () => {
	const conflict = xml.replace(
		"<Container ",
		'<Container xmlns:xsi="urn:unrelated" ',
	);
	const data = await decode(conflict);
	const first = data.value.Items.value[0];
	assert.ok(first);
	const cleared = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [{ ...first, value: null }, ...data.value.Items.value.slice(1)],
			},
		},
	});
	assert.match(
		cleared,
		/xmlns:xsi1="http:\/\/www.w3.org\/2001\/XMLSchema-instance" xsi1:nil="true"/,
	);
	assert.equal((await decode(cleared)).value.Items.value[0]?.value, null);
	// A selected item may come from an XML tree where the old nil prefix has
	// another meaning. Moving it must not introduce duplicate type attributes.
	const source = await decode(
		xml
			.replace(
				'xmlns:i="http://www.w3.org/2001/XMLSchema-instance"',
				'xmlns:i="urn:other" xmlns:q="http://www.w3.org/2001/XMLSchema-instance"',
			)
			.replaceAll("i:type=", "q:type=")
			.replaceAll("i:nil=", "q:nil="),
	);
	const replacement = source.value.Items.value[0]?.value;
	const last = data.value.Items.value[2];
	assert.ok(replacement && last);
	const replaced = await encode({
		...data,
		value: {
			...data.value,
			Items: {
				...data.value.Items,
				value: [
					...data.value.Items.value.slice(0, 2),
					{ ...last, value: replacement },
				],
			},
		},
	});
	assert.equal(
		(await decode(replaced)).value.Items.value[2]?.value?.type,
		"Example.Dog",
	);
	assert.match(replaced, /i1:nil="0"/);
});
