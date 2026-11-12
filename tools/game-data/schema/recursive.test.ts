import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/recursive.generated.ts";
import { parseFragment } from "./xml-codecs.ts";
const xml = await readFile(
	new URL("./tests/fixtures/recursive.xml", import.meta.url),
	"utf8",
);
const decode = (input: string) =>
	Effect.runPromise(Schema.decodeEffect(FragmentXmlSchema)(input));
const encode = (value: typeof FragmentXmlSchema.Type) =>
	Effect.runPromise(Schema.encodeEffect(FragmentXmlSchema)(value));
const parse = (input: string) => Effect.runPromise(parseFragment(input));

// Mutating a discriminated envelope requires narrowing its selected CLR case.
async function readRoot() {
	const root = await decode(xml);
	if (root.type !== "Example.Node") throw new Error("Expected Node root");
	return root;
}

test("recursive codecs initialize and infer finite direct, mutual, dictionary and polymorphic references", async () => {
	const node = await readRoot();
	const child = node.value.heldObject[0];
	assert.ok(child);
	assert.equal(child.type, "Example.Derived");
	if (child.type !== "Example.Derived")
		throw new Error("Expected derived child");
	const depth: number = child.value.Depth;
	const leafName: string | undefined = child.value.heldObject[0]?.value.Name;
	assert.equal(depth, 2);
	assert.equal(leafName, "leaf");
	assert.equal(node.value.Branches[0]?.value.Parent[0]?.value.Name, "leaf");
	assert.equal(node.value.Links.value[0]?.value.value.value.Name, "leaf");
	assert.equal(node.value.Children[0]?.value.heldObject.length, 0);
	assert.deepEqual(await parse(await encode(node)), await parse(xml));
});

test("nested recursive edits preserve unknown XML and discriminator spelling", async () => {
	const node = await readRoot();
	const child = node.value.heldObject[0];
	assert.ok(child);
	if (child.type !== "Example.Derived")
		throw new Error("Expected derived child");
	const leaf = child.value.heldObject[0];
	assert.ok(leaf);
	if (leaf.type !== "Example.Node") throw new Error("Expected Node leaf");
	const output = await encode({
		...node,
		value: {
			...node.value,
			heldObject: [
				{
					...child,
					value: {
						...child.value,
						heldObject: [{ ...leaf, value: { ...leaf.value, Name: "edited" } }],
					},
				},
			],
		},
	});
	assert.match(output, /<Name>edited<\/Name>/);
	assert.match(output, /<future>keep<\/future>/);
	assert.match(output, /<heldObject i:type="Derived" mod="child">/);
	assert.match(output, /<!-- sibling -->/);
	assert.equal(
		(await decode(output)).value.heldObject[0]?.value.heldObject[0]?.value.Name,
		"edited",
	);
});

test("NetField references accept zero/one values and reject a second on decode and encode", async () => {
	const node = await readRoot();
	const child = node.value.heldObject[0];
	assert.ok(child);
	await assert.rejects(
		encode({ ...node, value: { ...node.value, heldObject: [child, child] } }),
		/length|Length|1/,
	);
	const duplicate =
		"<heldObject><Name>extra</Name><Children/><Links/><Branches/></heldObject>";
	await assert.rejects(
		decode(xml.replace("<!-- sibling -->", `${duplicate}<!-- sibling -->`)),
		/length|Length|1/,
	);
	const cleared = await encode({
		...node,
		value: { ...node.value, heldObject: [] },
	});
	assert.equal((await decode(cleared)).value.heldObject.length, 0);
	assert.match(cleared, /<!-- sibling -->/);
	// Ordinary list collections remain unrestricted by the NetField constraint.
	const ordinary = await encode({
		...node,
		value: { ...node.value, Children: [child, child] },
	});
	assert.equal((await decode(ordinary)).value.Children.length, 2);
});

test("recursive generation is deterministic and retains closed-type validation", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/recursive.catalog.json", import.meta.url),
			"utf8",
		),
	);
	const output = generate(catalog, "Example.Node");
	assert.equal(output, generate(catalog, "Example.Node"));
	assert.match(output, /Schema.suspend/);
	assert.match(output, /Schema.Codec/);
	await assert.rejects(
		decode(xml.replace('i:type="Derived"', 'i:type="Unknown"')),
	);
	const bad = structuredClone(catalog);
	bad.types[3].maxItems = -1;
	assert.throws(() => generate(bad, "Example.Node"));
});

test("fresh recursive modules initialize with an abstract base and a concrete variant", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/recursive.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types[0].isAbstract = true;
	const directory = await mkdtemp(
		fileURLToPath(new URL("./.recursive-test-", import.meta.url)),
	);
	try {
		const file = join(directory, "generated.ts");
		await writeFile(
			file,
			generate(catalog, "Example.Node", "../xml-codecs.ts"),
		);
		const module = await import(pathToFileURL(file).href);
		// Dynamic imports have no compile-time module identity; generated codecs
		// require no Effect services and encode XML text at this public boundary.
		const schema: Schema.Codec<unknown, string> = module.FragmentXmlSchema;
		const source =
			'<Node xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="Derived"><Name>root</Name><Depth>1</Depth><Children/><Links/><Branches/><heldObject i:type="Derived"><Name>leaf</Name><Depth>0</Depth><Children/><Links/><Branches/></heldObject></Node>';
		const decoded = await Effect.runPromise(
			Schema.decodeEffect(schema)(source),
		);
		const output = await Effect.runPromise(
			Schema.encodeEffect(schema)(decoded),
		);
		assert.deepEqual(await parse(String(output)), await parse(source));
		await assert.rejects(
			Effect.runPromise(
				Schema.decodeEffect(schema)(source.replace(' i:type="Derived"', "")),
			),
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
