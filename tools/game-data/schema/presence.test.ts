import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Effect, Schema } from "effect";
import { generate } from "./generate.ts";
import { FragmentXmlSchema } from "./tests/fixtures/presence.generated.ts";
import * as Xml from "./xml-codecs.ts";

const decode = Schema.decodeSync(FragmentXmlSchema);
const encode = Schema.encodeSync(FragmentXmlSchema);
const parse = (xml: string) => Effect.runPromise(Xml.parseFragment(xml));
const source =
	'<Save xmlns:i="http://www.w3.org/2001/XMLSchema-instance" version="0001"><count i:nil="true"/><values><int>0003</int><future-list>keep</future-list></values><Child><Name>present</Name></Child><tag>one</tag><!-- note --><future>keep</future></Save>';

test("generated members distinguish absent, nil and present values without guessing defaults", async () => {
	const data = decode(source);
	const label: string | undefined = data.value.gameVersionLabel;
	const count: number | null | undefined = data.value.count;
	const number: number | undefined = data.value.Number;
	assert.equal(label, undefined);
	assert.equal(number, undefined);
	assert.equal(count, null);
	assert.equal(Object.hasOwn(data.value, "gameVersionLabel"), false);
	assert.equal(Object.hasOwn(data.value, "Number"), false);
	assert.equal(Object.hasOwn(data.value.Child?.value ?? {}, "Child"), false);
	assert.deepEqual(await parse(encode(data)), await parse(source));
	// Missing wrapped collections stay absent; repeated siblings retain their
	// established zero-occurrence array representation.
	const empty = decode("<Save/>");
	assert.deepEqual(empty.value, { tags: [] });
	assert.deepEqual(await parse(encode(empty)), await parse("<Save/>"));
	const zero = decode(
		"<Save><Number>0</Number><count>0</count><gameVersionLabel/></Save>",
	);
	assert.equal(zero.value.Number, 0);
	assert.equal(zero.value.count, 0);
	assert.equal(zero.value.gameVersionLabel, "");
});

test("assigning absent scalar, attribute and collection members inserts their slots", async () => {
	const data = decode("<Save><future>keep</future></Save>");
	const output = encode({
		...data,
		value: {
			...data.value,
			gameVersionLabel: "edited",
			Number: 0,
			version: 2,
			values: [1, 2],
		},
	});
	const edited = decode(output);
	assert.equal(edited.value.gameVersionLabel, "edited");
	assert.equal(edited.value.Number, 0);
	assert.equal(edited.value.version, 2);
	assert.deepEqual(edited.value.values, [1, 2]);
	assert.match(output, /<future>keep<\/future>/);
	assert.equal(data.value.gameVersionLabel, undefined);
	assert.deepEqual(
		await parse(encode(data)),
		await parse("<Save><future>keep</future></Save>"),
	);
});

test("removing optional properties deletes their owned slots and preserves siblings", async () => {
	const data = decode(source);
	const {
		count: _count,
		values: _values,
		version: _version,
		...remaining
	} = data.value;
	const output = encode({ ...data, value: remaining });
	assert.deepEqual(
		await parse(output),
		await parse(
			source
				.replace(' version="0001"', "")
				.replace('<count i:nil="true"/>', "")
				.replace(
					"<values><int>0003</int><future-list>keep</future-list></values>",
					"",
				),
		),
	);
});

test("optional nullable members can move among absence, nil and a value", () => {
	const data = decode(
		'<Save xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>',
	);
	const nil = encode({ ...data, value: { ...data.value, count: null } });
	assert.equal(decode(nil).value.count, null);
	const populated = encode({
		...decode(nil),
		value: { ...decode(nil).value, count: 7 },
	});
	assert.equal(decode(populated).value.count, 7);
	assert.doesNotMatch(populated, /i:nil/);
});

test("optional objects use a preserved template and retain recursive edits", () => {
	const template = decode(source).value.Child;
	assert.ok(template);
	const empty = decode("<Save/>");
	const output = encode({
		...empty,
		value: {
			...empty.value,
			Child: { ...template, value: { ...template.value, Child: template } },
		},
	});
	assert.equal(decode(output).value.Child?.value.Child?.value.Name, "present");
});

test("optional fields still reject duplicates, malformed values and explicit undefined", () => {
	for (const xml of [
		"<Save><Number>1</Number><Number>2</Number></Save>",
		"<Save><Number>bad</Number></Save>",
		"<Save><count>bad</count></Save>",
		'<Save version="bad"/>',
	])
		assert.throws(() => decode(xml));
	const data = decode("<Save/>");
	assert.throws(() =>
		Schema.encodeUnknownSync(FragmentXmlSchema)({
			...data,
			value: { ...data.value, Number: undefined },
		}),
	);
	assert.throws(() => Xml.optional(Xml.repeatedValues("tag", Xml.String)));
});

test("inferred nonrecursive generation applies the same ordinary member presence policy", async () => {
	const catalog = JSON.parse(
		await readFile(
			new URL("./tests/fixtures/presence.catalog.json", import.meta.url),
			"utf8",
		),
	);
	catalog.types[0].members = catalog.types[0].members.filter(
		(member: { name: string }) => member.name !== "Child",
	);
	const source = generate(catalog, "Example.Save");
	assert.match(source, /gameVersionLabel: Xml.optional\(Xml.field/);
	assert.match(source, /values: Xml.optional\(Xml.list/);
	assert.match(source, /tags: Xml.repeatedValues/);
	assert.doesNotMatch(source, /Schema.suspend/);
});

test("an absent member named __proto__ stays absent until explicitly assigned", async () => {
	const schema = Xml.fromXml(
		Xml.structure({
			["__proto__"]: Xml.optional(Xml.field("__proto__", Xml.String)),
		}),
	);
	const data = Schema.decodeSync(schema)("<Root/>");
	assert.equal(Object.hasOwn(data.value, "__proto__"), false);
	assert.deepEqual(
		await parse(Schema.encodeSync(schema)(data)),
		await parse("<Root/>"),
	);
	const changed = Schema.encodeSync(schema)({
		...data,
		value: { ["__proto__"]: "saved" },
	});
	assert.deepEqual(
		await parse(changed),
		await parse("<Root><__proto__>saved</__proto__></Root>"),
	);
});
