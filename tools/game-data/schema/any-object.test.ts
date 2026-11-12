import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import {
	FragmentSchema,
	FragmentXmlSchema,
} from "./tests/fixtures/any-object.generated.ts";
import * as Xml from "./xml-codecs.ts";
import { FragmentXmlSchema as AnyRootSchema } from "./tests/fixtures/any-object-root.generated.ts";

const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));
const scope =
	'xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://www.w3.org/2001/XMLSchema"';
const wrap = (params: string) =>
	`<DescriptionElement ${scope}><xmlKey>key</xmlKey>${params}</DescriptionElement>`;

test("acyclic System.Object roots infer tagged scalar types and use the anyType root name", () => {
	const data = Schema.decodeSync(AnyRootSchema)(
		`<anyType ${scope} i:type="s:double">1.5</anyType>`,
	);
	assert.equal(data.type, "System.Double");
	if (data.type === "System.Double") {
		const value: number = data.value;
		assert.equal(value, 1.5);
	}
	assert.throws(() => Schema.decodeSync(AnyRootSchema)("<Object/>"));
});

test("object substitutions distinguish scalars, the game Object and bare System.Object", async () => {
	const xml = wrap(
		'<param i:type="s:int" mod="keep">0014<!-- number --></param><param i:type="s:string">text</param><param i:type="Object"><Name>Stone</Name></param><param/><param i:type="s:anyType"/>',
	);
	const data = decode(xml);
	assert.deepEqual(
		data.value.param.map((entry) => entry.type),
		[
			"System.Int32",
			"System.String",
			"Example.Object",
			"System.Object",
			"System.Object",
		],
	);
	const integer = data.value.param[0];
	assert.ok(integer && integer.type === "System.Int32");
	const count: number = integer.value;
	assert.equal(count, 14);
	assert.deepEqual(await parse(encode(data)), await parse(xml));
	const edited = encode({
		...data,
		value: {
			...data.value,
			param: data.value.param.map((entry) =>
				entry.type === "System.Int32" ? { ...entry, value: 15 } : entry,
			),
		},
	});
	assert.deepEqual(await parse(edited), await parse(xml.replace("0014", "15")));
});

test("object substitutions reject unknown QNames and invalid scalar contents", () => {
	for (const param of [
		'<param i:type="s:unknown">1</param>',
		'<param xmlns:other="urn:other" i:type="other:int">1</param>',
		'<param i:type="unbound:int">1</param>',
		'<param i:type="s:int">2147483648</param>',
		'<param i:type="s:int"><child>1</child></param>',
		'<param i:type="s:int" i:nil="true"/>',
	])
		assert.throws(() => decode(wrap(param)), param);
});

test("scalar object variants use all registered scalar codecs and XML namespaces", () => {
	const xml = wrap(
		'<param i:type="s:long">9223372036854775807</param><param i:type="s:float">INF</param><param i:type="s:boolean">1</param><param xmlns:g="http://microsoft.com/wsdl/types/" i:type="g:guid">FF46EAA0-A819-4C7E-B09F-8BBD2442209F</param>',
	);
	const data = decode(xml);
	assert.deepEqual(
		data.value.param.map((entry) => entry.value),
		[
			9223372036854775807n,
			Infinity,
			true,
			"ff46eaa0-a819-4c7e-b09f-8bbd2442209f",
		],
	);
	assert.throws(() =>
		decode(
			wrap(
				'<param i:type="s:guid">ff46eaa0-a819-4c7e-b09f-8bbd2442209f</param>',
			),
		),
	);
});

test("real save substitutions decode nested owners and integers with inherited namespace scope", async () => {
	const text = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const tree = await parse(
		text
			.trimStart()
			.replace(/^<\?xml[^?]*\?>/, "")
			.trim(),
	);
	const owners: Xml.XmlElement[] = [];
	function visit(node: Xml.XmlElement) {
		if (
			node.children.some(
				(child) => child._tag === "Element" && child.name === "param",
			)
		)
			owners.push(node);
		for (const child of node.children)
			if (child._tag === "Element") visit(child);
	}
	visit(tree);
	assert.equal(owners.length, 2);
	const values = owners.map((original) => {
		// The generated root boundary uses the declared root name; saved members
		// alias it as objective. Keep the inherited xsi/xsd scope when adapting it.
		const element = { ...original, name: "DescriptionElement" };
		const data = Schema.decodeSync(FragmentSchema)(element);
		assert.deepEqual(Schema.encodeSync(FragmentSchema)(data), element);
		return data.value.param;
	});
	assert.equal(values[0]?.[0]?.type, "Example.DescriptionElement");
	assert.deepEqual(
		values[1]?.map((entry) => entry.value),
		[14, 28],
	);
});

test("scalar and object QName collisions fail generation", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/any-object.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types.find(
		(type: { id: string }) => type.id === "Example.Object",
	).attributes = [
		{
			type: "System.Xml.Serialization.XmlTypeAttribute",
			namedArguments: {
				TypeName: { type: "System.String", value: "int" },
				Namespace: {
					type: "System.String",
					value: "http://www.w3.org/2001/XMLSchema",
				},
			},
		},
	];
	assert.throws(
		() => generate(catalog, "Example.DescriptionElement"),
		/ambiguous XML type int/,
	);
});
