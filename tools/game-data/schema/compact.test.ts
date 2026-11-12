import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { decodeCatalog } from "./compiler/catalog.ts";
import { resolveContract } from "./compiler/contract.ts";
import { recursiveObjects } from "./compiler/graph.ts";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/compact.generated.ts";
import * as Xml from "./xml-codecs.ts";

const catalog = JSON.parse(
	await readFile(
		new URL("./tests/fixtures/compact.catalog.json", import.meta.url),
		"utf8",
	),
);
const source = generate(catalog, "Example.Root");
const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));
const xml =
	'<Root xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Animal i:type="Derived" mod="animal"><Name>base name</Name><Mode>Quiet</Mode><Count>2</Count><future>keep</future></Animal><Changed><caption>0007</caption><Mode>Loud</Mode><Next><caption>8</caption></Next></Changed><Removed><Name>local</Name><Mode>unknown extension</Mode></Removed><Left><Name>left</Name><Mode>Loud</Mode><Next><Name>nested</Name></Next><Children><Node i:nil="true"/></Children></Left><Right><Name>other namespace</Name></Right><Position><X>0001</X><Y>2</Y></Position><Labels><item><key><string>key</string></key><value><string>value</string></value></item></Labels><OtherLabels/><Children/><!-- keep --></Root>';

test("compact emission shares inherited fields without losing overrides or ignored members", async () => {
	assert.match(source, /const DerivedFields = \{\s*\.\.\.BaseFields,/);
	assert.match(source, /const ChangedFields = \{\s*\.\.\.BaseFields,/);
	assert.match(source, /type ChangedValue = Omit<BaseValue, "Name">/);
	assert.doesNotMatch(
		source.match(/const RemovedFields = \{[\s\S]*?\n\};/)?.[0] ?? "",
		/\.\.\.BaseFields/,
	);
	const data = decode(xml);
	assert.equal(data.value.Animal?.type, "Example.Derived");
	assert.equal(data.value.Animal?.value.Name, "base name");
	const changed: number | undefined = data.value.Changed?.value.Name;
	assert.equal(changed, 7);
	assert.equal(data.value.Changed?.value.Next?.value.Name, 8);
	// Removed.Mode is an unknown saved extension, not an inherited enum slot.
	assert.deepEqual(data.value.Removed?.value, { Name: "local" });
	assert.deepEqual(await parse(encode(data)), await parse(xml));
});

test("recursive groups are annotated while acyclic parents and leaf types remain inferred", () => {
	const recursive = recursiveObjects(
		resolveContract(decodeCatalog(catalog), "Example.Root"),
	);
	assert.deepEqual([...recursive].sort(), [
		"Example.Changed",
		"Example.Derived",
		"Example.Grandchild",
		"Example.Marker",
		"Example.Node",
	]);
	assert.match(source, /const ExampleNodeSchema: Schema.Codec/);
	assert.match(source, /const ChangedSchema: Schema.Codec/);
	assert.match(source, /const RootValueSchema = Xml.structure/);
	assert.match(source, /const RootSchema = Xml.variant/);
	assert.match(source, /const PointValueSchema = Xml.structure/);
	assert.doesNotMatch(source, /type RootValue =|type PointValue =/);
	// Inferred acyclic fields still expose concrete types across cycle boundaries.
	const data = decode(xml);
	const x: number | undefined = data.value.Position?.value.X;
	const next: string | undefined = data.value.Left?.value.Next?.value.Name;
	assert.deepEqual([x, next], [1, "nested"]);
});

test("repeated enum and dictionary definitions are emitted once", () => {
	assert.equal((source.match(/Xml\.enumeration\(/g) ?? []).length, 1);
	assert.equal((source.match(/Xml\.dictionary\(/g) ?? []).length, 2);
	assert.match(source, /const ModeCodec = Xml.enumeration/);
	assert.match(source, /const StringToStringDictionaryCodec =/);
	assert.match(source, /const StringToStringDictionaryIgnoringCaseCodec =/);
});

test("meaningful names disambiguate namespaces and generated suffix families deterministically", () => {
	assert.match(source, /const ExampleNodeFields =/);
	assert.match(source, /const OtherNodeFields =/);
	assert.doesNotMatch(source, /\bObject\d+(?:Schema|Value|Fields)?\b/);
	const reversed = structuredClone(catalog);
	reversed.types.reverse();
	assert.equal(source, generate(reversed, "Example.Root"));
	const collision = structuredClone(catalog);
	collision.types[0].members.push({
		name: "Extra",
		type: "Example.RootSchema",
	});
	collision.types.push({
		id: "Example.RootSchema",
		kind: "object",
		members: [{ name: "Name", type: "System.String" }],
	});
	assert.match(
		generate(collision, "Example.Root"),
		/const RootSchema2Fields =/,
	);
	const keyword = structuredClone(catalog);
	keyword.types[0].members.push({ name: "Keyword", type: "Example.class" });
	keyword.types.push({
		id: "Example.class",
		kind: "object",
		members: [{ name: "Next", type: "Example.class" }],
	});
	assert.match(generate(keyword, "Example.Root"), /const class2Schema:/);
});

test("shared bindings retain provenance during edits and do not leak between instances", async () => {
	const data = decode(xml);
	const changed = data.value.Changed;
	const animal = data.value.Animal;
	assert.ok(changed && animal && animal.type === "Example.Derived");
	const output = encode({
		...data,
		value: {
			...data.value,
			Animal: { ...animal, value: { ...animal.value, Name: "edited" } },
			Changed: { ...changed, value: { ...changed.value, Name: 9 } },
		},
	});
	assert.deepEqual(
		await parse(output),
		await parse(xml.replace("base name", "edited").replace("0007", "9")),
	);
	assert.deepEqual(await parse(encode(data)), await parse(xml));
});

test("shared concrete variants retain each declared base's discriminator policy", () => {
	assert.equal((source.match(/const GrandchildVariant =/g) ?? []).length, 1);
	assert.match(
		source,
		/type GrandchildInstance = Variant<"Example.Grandchild", GrandchildValue>/,
	);
	const data = decode(
		xml.replace(
			"</Root>",
			'<Other i:type="Grandchild"><Name>derived</Name><Count>3</Count><Extra>true</Extra></Other><Last><Extra>false</Extra></Last></Root>',
		),
	);
	assert.ok(data.value.Other?.type === "Example.Grandchild");
	assert.equal(data.value.Other.value.Extra, true);
	assert.equal(data.value.Last?.value.Extra, false);
	// A declared Derived may omit xsi:type, even though its shared Grandchild
	// alternative still requires one. Unknown fields must not select a subtype.
	assert.equal(
		decode("<Root><Other><Extra>true</Extra></Other></Root>").value.Other?.type,
		"Example.Derived",
	);
});

test("empty inherited extensions reuse the base payload without forbidding inherited values", () => {
	assert.match(source, /type MarkerValue = DerivedValue;/);
	const marker = decode(
		"<Root><Marker><Name>marker</Name><Count>4</Count></Marker></Root>",
	).value.Marker;
	assert.equal(marker?.value.Name, "marker");
	assert.equal(marker?.value.Count, 4);
});

test("codec sharing keeps distinct dictionary comparer contracts separate", () => {
	const entries =
		"<item><key><string>key</string></key><value><string>value</string></value></item><item><key><string>KEY</string></key><value><string>other</string></value></item>";
	assert.equal(
		decode(`<Root><Labels>${entries}</Labels></Root>`).value.Labels?.value
			.length,
		2,
	);
	assert.throws(
		() => decode(`<Root><CaseLabels>${entries}</CaseLabels></Root>`),
		/Duplicate dictionary key/,
	);
});
