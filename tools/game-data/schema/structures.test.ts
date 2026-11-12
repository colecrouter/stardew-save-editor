import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import {
	FragmentSchema,
	FragmentXmlSchema,
} from "./tests/fixtures/order.generated.ts";
import { parseFragment } from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/order.catalog.json", import.meta.url),
		"utf8",
	),
);
const xml = (
	await readFile(new URL("./tests/fixtures/order.xml", import.meta.url), "utf8")
).trim();
const decode = Schema.decodeEffect(FragmentXmlSchema);
const encode = Schema.encodeEffect(FragmentXmlSchema);
const read = () => Effect.runPromise(decode(xml));
const parse = (source: string) => Effect.runPromise(parseFragment(source));

test("generated structures infer nested fields and exact Int64 IDs", async () => {
	const order = await read();
	const city: string = order.value.Shipping.value.City;
	const id: bigint = order.value.OrderId;
	assert.equal(city, "Town");
	assert.equal(id, 9007199254740993n);
	assert.equal(order.value.Billing.value.City, "Farm");
	assert.equal(order.value.Lines[0]?.value.Destination.value.Zip, 7);
	// XmlRoot describes a document name, not aliases of a child object.
	assert.equal(order.value.Shipping.original.name, "Shipping");
	assert.equal(order.value.Billing.original.name, "Billing");
});

test("nested no-op round trip retains all original XML and numeric spellings", async () => {
	const order = await read();
	const output = await Effect.runPromise(encode(order));
	assert.deepEqual(await parse(output), await parse(xml));
	assert.match(output, /<Zip>0007<\/Zip>/);
	assert.match(output, /<Quantity>0002<\/Quantity>/);
	assert.match(output, /9007199254740993/);
});

test("editing a child preserves its unknown XML and other aliases of the same type", async () => {
	const order = await read();
	const shipping = order.value.Shipping;
	const edited = {
		...order,
		value: {
			...order.value,
			Shipping: { ...shipping, value: { ...shipping.value, City: "Island" } },
		},
	};
	const output = await Effect.runPromise(encode(edited));
	assert.match(
		output,
		/<Shipping flag="ship"><City>Island<\/City><Zip>0007<\/Zip><!-- shipping note --><future>keep<\/future><\/Shipping>/,
	);
	assert.match(
		output,
		/<Billing flag="bill"><City>Farm<\/City><Zip>8<\/Zip><\/Billing>/,
	);
	assert.equal((await read()).value.Shipping.value.City, "Town");
});

test("nested fields inside collection objects preserve wrappers, comments and unknown children", async () => {
	const order = await read();
	const first = order.value.Lines[0];
	assert.ok(first);
	const destination = first.value.Destination;
	const line = {
		...first,
		value: {
			...first.value,
			Destination: {
				...destination,
				value: { ...destination.value, City: "Desert" },
			},
		},
	};
	const edited = {
		...order,
		value: { ...order.value, Lines: [line, ...order.value.Lines.slice(1)] },
	};
	const output = await Effect.runPromise(encode(edited));
	assert.match(
		output,
		/<Destination flag="dest"><City>Desert<\/City><Zip>0007<\/Zip><mod>keep<\/mod><\/Destination>/,
	);
	assert.match(output, /<Quantity>0002<\/Quantity>/);
	assert.match(output, /<!-- between items -->/);
	assert.match(output, /<future-wrapper>keep<\/future-wrapper>/);
	assert.match(output, /<unknown>line data<\/unknown>/);
});

test("object collection insertion and removal keep each object's own provenance", async () => {
	const order = await read();
	const first = order.value.Lines[0];
	const second = order.value.Lines[1];
	assert.ok(first && second);
	const added = {
		...first,
		value: { ...first.value, Sku: "pickaxe", Quantity: 4 },
	};
	const edited = {
		...order,
		value: { ...order.value, Lines: [second, added] },
	};
	const output = await Effect.runPromise(encode(edited));
	const decoded = await Effect.runPromise(decode(output));
	assert.deepEqual(
		decoded.value.Lines.map((line) => line.value.Sku),
		["axe", "pickaxe"],
	);
	assert.equal(decoded.value.Lines[0]?.original.attributes.mod, undefined);
	assert.equal(decoded.value.Lines[1]?.original.attributes.mod, "line");
	assert.match(output, /<future-wrapper>keep<\/future-wrapper>/);
});

test("empty object wrappers keep unknown content and accept a new preserved object", async () => {
	const order = await read();
	const cleared = await Effect.runPromise(
		encode({ ...order, value: { ...order.value, Lines: [] } }),
	);
	const empty = await Effect.runPromise(decode(cleared));
	assert.equal(empty.value.Lines.length, 0);
	assert.match(cleared, /<future-wrapper>keep<\/future-wrapper>/);
	const first = order.value.Lines[0];
	assert.ok(first);
	const restored = await Effect.runPromise(
		encode({ ...empty, value: { ...empty.value, Lines: [first] } }),
	);
	assert.equal(
		(await Effect.runPromise(decode(restored))).value.Lines.length,
		1,
	);
});

test("scalar registry adds Int64 without losing precision or accepting overflow", async () => {
	for (const value of ["-9223372036854775808", "9223372036854775807"]) {
		const order = await Effect.runPromise(
			decode(xml.replace("9007199254740993", value)),
		);
		assert.equal(order.value.OrderId, BigInt(value));
	}
	for (const value of ["9223372036854775808", "-9223372036854775809", "1.5"]) {
		await assert.rejects(
			Effect.runPromise(decode(xml.replace("9007199254740993", value))),
			/OrderId/,
		);
	}
	const order = await read();
	const changed = await Effect.runPromise(
		encode({
			...order,
			value: { ...order.value, OrderId: order.value.OrderId + 1n },
		}),
	);
	assert.match(changed, /9007199254740994/);
});

test("structural resolution retains cycles and rejects objects mapped to XML attributes", () => {
	const recursive = structuredClone(catalog);
	recursive.types[1].members.push({ name: "Parent", type: "Example.Order" });
	assert.match(generate(recursive, "Example.Order"), /Schema.suspend/);
	const invalid = structuredClone(catalog);
	invalid.types[0].members[0].attributes = [
		{ type: "System.Xml.Serialization.XmlAttributeAttribute" },
	];
	assert.throws(
		() => generate(invalid, "Example.Order"),
		/Example.Order.Shipping.*objects cannot be XML attributes/,
	);
});

test("reusable object codecs validate child values and preserve error paths", async () => {
	const tree = await parse(
		xml.replace("<Quantity>0002</Quantity>", "<Quantity>bad</Quantity>"),
	);
	assert.throws(
		() => Schema.decodeSync(FragmentSchema)(tree),
		/Lines.*Quantity/s,
	);
	// The structure name comes from the field, so swapping a child's element
	// name fails selection instead of interpreting the wrong subtree.
	await assert.rejects(
		Effect.runPromise(decode(xml.replaceAll("Shipping", "WrongShipping"))),
		/Shipping/,
	);
});

test("freshly emitted nested modules initialize dependencies and decode XML", async () => {
	const directory = await mkdtemp(
		join(import.meta.dirname, ".structures-test-"),
	);
	try {
		const output = join(directory, "generated.ts");
		await writeFile(
			output,
			generate(catalog, "Example.Order", "../xml-codecs.ts"),
		);
		const generated = await import(pathToFileURL(output).href);
		const schema = generated.FragmentXmlSchema as typeof FragmentXmlSchema;
		const order = await Effect.runPromise(Schema.decodeEffect(schema)(xml));
		assert.equal(order.value.Shipping.value.City, "Town");
		assert.equal(order.value.Billing.value.Zip, 8);
		assert.equal(order.value.Lines[0]?.value.Destination.value.City, "Town");
		assert.equal(order.value.OrderId, 9007199254740993n);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
