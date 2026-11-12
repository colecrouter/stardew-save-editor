import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import {
	FragmentSchema,
	FragmentXmlSchema,
} from "./tests/fixtures/wrapped-null.generated.ts";
import * as Xml from "./xml-codecs.ts";

const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));
const source =
	'<Paint xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><ColorName mod="wrapper"><string i:nil="1" mod="slot"><!-- nil note --></string><future>keep</future></ColorName><NonNullableName/><Targets><Node><Name>target</Name><future-node>keep</future-node></Node><Node i:nil="true"/></Targets><Numbers><int>1</int></Numbers><Points><Point><X>1</X></Point></Points></Paint>';

test("wrapped reference items decode nil slots while keeping scalar and struct items non-null", async () => {
	const data = decode(source);
	const names: readonly (string | null)[] | undefined = data.value.ColorName;
	const plain: readonly string[] | undefined = data.value.NonNullableName;
	assert.deepEqual(names, [null]);
	assert.deepEqual(plain, []);
	assert.deepEqual(data.value.DirectName, []);
	assert.equal(data.value.Targets?.[0]?.value.Name, "target");
	assert.equal(data.value.Targets?.[1], null);
	assert.deepEqual(data.value.Numbers, [1]);
	assert.equal(data.value.Points?.[0]?.value.X, 1);
	assert.deepEqual(await parse(encode(data)), await parse(source));
});

test("wrapped strings transition between null and text without losing slot provenance", async () => {
	const data = decode(source);
	const output = encode({
		...data,
		value: { ...data.value, ColorName: ["paint"] },
	});
	assert.match(output, /<string mod="slot"><!-- nil note -->paint<\/string>/);
	assert.match(output, /<future>keep<\/future>/);
	assert.deepEqual(decode(output).value.ColorName, ["paint"]);
	const nil = encode({
		...decode(output),
		value: { ...decode(output).value, ColorName: [null] },
	});
	assert.deepEqual(decode(nil).value.ColorName, [null]);
	assert.match(nil, /mod="slot"/);
	assert.match(nil, /<!-- nil note -->/);
	const cleared = encode({ ...data, value: { ...data.value, ColorName: [] } });
	assert.deepEqual(decode(cleared).value.ColorName, []);
	assert.deepEqual(decode("<Paint/>").value.ColorName, undefined);
});

test("null slots count toward the NetField bound on decode and encode", () => {
	assert.throws(() =>
		decode(source.replace('<string i:nil="1"', '<string/><string i:nil="1"')),
	);
	const data = decode(source);
	assert.throws(() =>
		encode({ ...data, value: { ...data.value, ColorName: [null, "second"] } }),
	);
});

test("nil is rejected for repeated elements, explicit non-null items and value types", () => {
	for (const xml of [
		'<Paint xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><name i:nil="true"/></Paint>',
		source.replace(
			"<NonNullableName/>",
			'<NonNullableName><string i:nil="true"/></NonNullableName>',
		),
		source.replace("<int>1</int>", '<int i:nil="true"/>'),
		source.replace("<Point><X>1</X></Point>", '<Point i:nil="true"/>'),
		source.replace("<!-- nil note -->", "not empty"),
	])
		assert.throws(() => decode(xml));
});

test("nullable wrapped objects retain their own trees when moved across null slots", () => {
	const data = decode(source);
	const target = data.value.Targets?.[0];
	assert.ok(target);
	const output = encode({
		...data,
		value: { ...data.value, Targets: [null, target, target] },
	});
	const values = decode(output).value.Targets;
	assert.equal(values?.length, 3);
	assert.equal(values?.[0], null);
	assert.equal(values?.[1]?.value.Name, "target");
	assert.equal(
		(output.match(/<future-node>keep<\/future-node>/g) ?? []).length,
		2,
	);
});

test("real save ColorName nil strings round-trip through the generated wrapped mapping", async () => {
	const text = await readFile(
		new URL("../../../tests/TestSave", import.meta.url),
		"utf8",
	);
	const save = await parse(
		text
			.trimStart()
			.replace(/^<\?xml[^?]*\?>/, "")
			.trim(),
	);
	let color: Xml.XmlElement | undefined;
	function find(node: Xml.XmlElement) {
		if (node.name === "ColorName") color ??= node;
		for (const child of node.children)
			if (child._tag === "Element") find(child);
	}
	find(save);
	assert.ok(color);
	// Preserve inherited namespace context while narrowing this large save to
	// the field under review. The root name belongs to the regression fixture.
	const original: Xml.XmlElement = {
		_tag: "Element",
		name: "Paint",
		attributes: {},
		children: [color],
		...(color.namespaces ? { namespaces: color.namespaces } : {}),
	};
	const data = Schema.decodeSync(FragmentSchema)(original);
	assert.deepEqual(data.value.ColorName, [null]);
	assert.deepEqual(Schema.encodeSync(FragmentSchema)(data), original);
});
