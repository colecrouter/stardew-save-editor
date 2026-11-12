import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Cause, Effect, Exit, Schema } from "effect";
import * as Xml from "../../../src/lib/save-format/index.ts";
import { attach } from "../../../src/lib/save-format/events.ts";
import type { Frame } from "../../../src/lib/save-format/events.ts";
import { XmlSchema, type Value } from "./generated/inventory.ts";

const decode = Schema.decodeUnknownSync(XmlSchema);
const encode = Schema.encodeSync(XmlSchema);

test("expected XML failures remain typed and retain their field path", async () => {
	const codec = Xml.object({
		count: { xmlName: "Count", codec: Xml.scalar("System.Int32") },
	});
	for (const source of [
		"<Root><Count>bad</Count></Root>",
		"<Wrong/>",
		"<Root/>",
	]) {
		const result = await Effect.runPromiseExit(
			Xml.decodeChunks("Root", codec, [source]),
		);
		assert.ok(Exit.isFailure(result));
		assert.ok(Cause.hasFails(result.cause));
		assert.equal(Cause.hasDies(result.cause), false);
	}
	assert.throws(
		() =>
			Schema.decodeSync(Xml.document("Root", codec))(
				"<Root><Count>bad</Count></Root>",
			),
		/Root.*Count/s,
	);
});

test("reader bugs stay defects through every frame operation and the document codec", async () => {
	for (const operation of ["open", "child", "text", "finish"] as const) {
		const bug = new TypeError(`bug in ${operation}`);
		const crash = Effect.sync(() => {
			throw bug;
		});
		const leaf: Frame = {
			text: () => Effect.void,
			child: () => Effect.die("unexpected child"),
			finish: () => Effect.succeed({}),
		};
		const codec = attach(
			Schema.Unknown,
			() =>
				operation === "open"
					? crash
					: Effect.succeed({
							text: () => (operation === "text" ? crash : Effect.void),
							child: () =>
								operation === "child" ? crash : Effect.succeed(leaf),
							finish: () =>
								operation === "finish" ? crash : Effect.succeed({}),
						}),
			function* () {},
		);
		const source =
			operation === "child"
				? "<Root><Child/></Root>"
				: operation === "text"
					? "<Root>value</Root>"
					: "<Root/>";
		// The low-level reader and the public Schema boundary must both preserve
		// the actual exception, without relabeling it as malformed uploaded XML.
		const reads: readonly Effect.Effect<unknown, unknown>[] = [
			Xml.decodeChunks("Root", codec, [source]),
			Schema.decodeUnknownEffect(Xml.document("Root", codec))(source),
		];
		for (const read of reads) {
			const result = await Effect.runPromiseExit(read);
			assert.ok(Exit.isFailure(result));
			assert.equal(Cause.hasFails(result.cause), false);
			assert.ok(
				result.cause.reasons.some(
					(reason) => Cause.isDieReason(reason) && reason.defect === bug,
				),
			);
		}
	}
});

test("plain generated values support creation, cloning, reordering and automatic nil/type output", () => {
	const imported =
		decode(`<?xml version="1.0"?><Container xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:p="urn:pets">
		<Items><Item i:type="p:Hound"><Name>007</Name><BarkCount>0007</BarkCount><Mod flag="yes"><entry>A</entry><entry>B</entry></Mod></Item><Item i:nil="true"/></Items>
		<Future enabled="yes" i:type="p:Extension">custom</Future>
	</Container>`);
	assert.equal(imported.Items?.[0]?.Name, "007");
	// Compile-time assertions exercise the generated public API, not an envelope.
	const dog = imported.Items?.[0];
	assert.ok(dog?.$type === "Example.Dog");
	const barkCount: number | undefined = dog.BarkCount;
	assert.equal(barkCount, 7);
	const edited: Value = {
		...structuredClone(imported),
		Items: [
			null,
			{ ...dog, BarkCount: 8 },
			{ $type: "Example.Cat", Name: "new", Lives: 9 },
		],
	};
	const xml = encode(edited);
	assert.match(xml, /xsi:nil="true"/);
	assert.match(xml, /xsi:type="[^"]*:Hound"/);
	assert.match(xml, /xsi:type="Kitten"/);
	const result = decode(xml);
	assert.equal(result.Items?.length, 3);
	assert.equal(result.Items?.[0], null);
	assert.equal(result.Items?.[1]?.BarkCount, 8);
	assert.equal(result.Items?.[2]?.Name, "new");
	assert.deepEqual(result.Items?.[1]?.Mod, dog.Mod);
	assert.deepEqual(result.Future, imported.Future);
	assert.equal(imported.Items?.[0]?.BarkCount, 7);
	// Ordinary concrete roots can be created without an application discriminator.
	assert.deepEqual(decode(encode({ Items: [] })).Items, []);
});

test("plain fields retain unknown properties while owning renamed values and presence", () => {
	const schema = Xml.document(
		"Root",
		Xml.object({
			name: { xmlName: "Name", codec: Xml.scalar("System.String") },
			count: {
				xmlName: "Count",
				codec: Xml.scalar("System.Int64"),
				optional: true,
			},
			maybe: {
				xmlName: "Maybe",
				codec: Xml.nullable(Xml.scalar("System.Int32")),
				optional: true,
			},
			flag: { xmlName: "@_flag", codec: Xml.scalar("System.Boolean") },
		}),
	);
	const read = Schema.decodeUnknownSync(schema),
		write = Schema.encodeSync(schema);
	const value = read(
		'<Root flag="1"><Name>1e3</Name><Count>9007199254740993</Count><Maybe xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/><unknown a="b">keep</unknown></Root>',
	);
	assert.equal(value.count, 9007199254740993n);
	assert.equal(value.name, "1e3");
	assert.equal(value.maybe, null);
	assert.equal(value.flag, true);
	const { count: _, ...withoutCount } = value;
	const output = read(write({ ...withoutCount, maybe: 5 }));
	assert.equal(Object.hasOwn(output, "count"), false);
	assert.equal(output.maybe, 5);
	assert.deepEqual(output.unknown, value.unknown);
	assert.throws(
		() => read('<Root flag="true"><Name>ok</Name><Count>bad</Count></Root>'),
		/Count/,
	);
	assert.throws(
		() =>
			read('<Root flag="true"><Name>ok</Name><name>collision</name></Root>'),
		/collides/,
	);
});

test("plain codecs reject invalid known values and unsupported loss of metadata", () => {
	assert.throws(
		() =>
			decode(
				'<Container><Items><Item xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Kitten"><Lives>1.5</Lives></Item></Items></Container>',
			),
		/Lives/,
	);
	assert.throws(
		() => decode("<Container><Items><future>keep</future></Items></Container>"),
		/collection/,
	);
	assert.throws(
		() =>
			decode(
				'<Container><Items><Item xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"><Name>invalid</Name></Item></Items></Container>',
			),
		/Nil/,
	);
	assert.throws(
		() =>
			Schema.decodeSync(Xml.document("Text", Xml.scalar("System.String")))(
				'<Text mod="keep">name</Text>',
			),
		/metadata/,
	);
	assert.throws(
		() =>
			decode(
				'<Container><Pet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="missing:Unknown"/></Container>',
			),
		/Unbound/,
	);
});

test("plain sequences handle singleton arrays, bounds and absent repetitions", () => {
	const schema = Xml.document(
		"Root",
		Xml.object({
			values: {
				xmlName: "Value",
				codec: Xml.sequence(Xml.scalar("System.Int32"), 1),
				repeated: true,
			},
		}),
	);
	const read = Schema.decodeUnknownSync(schema),
		write = Schema.encodeSync(schema);
	assert.deepEqual(read("<Root/>"), { values: [] });
	assert.deepEqual(read("<Root><Value>007</Value></Root>"), { values: [7] });
	assert.throws(() => write({ values: [1, 2] }));
	assert.throws(() => read("<Root><Value>1</Value><Value>2</Value></Root>"));
});

test("plain dictionary entries support creation and enforce reviewed key equality", () => {
	const schema = Xml.document(
		"Dictionary",
		Xml.dictionary(
			Xml.scalar("System.String"),
			"string",
			Xml.scalar("System.Int32"),
			"int",
			"ordinalIgnoreCase",
		),
	);
	const read = Schema.decodeUnknownSync(schema),
		write = Schema.encodeSync(schema);
	const value = [{ key: "key", value: 5, Mod: "keep" }];
	assert.deepEqual(read(write(value)), value);
	assert.throws(() => write([...value, { key: "KEY", value: 6 }]), /Duplicate/);
});

test("generated recursive contracts initialize and round-trip without envelopes", async () => {
	const { XmlSchema } = await import("./generated/recursive.ts");
	const source = await readFile(
		new URL("./fixtures/recursive.xml", import.meta.url),
		"utf8",
	);
	const decoded = Schema.decodeSync(XmlSchema)(source);
	const output = Schema.encodeSync(XmlSchema)(decoded);
	assert.deepEqual(Schema.decodeSync(XmlSchema)(output), decoded);
});

test("concrete equipment and inventory references share semantic type identity", () => {
	const payload = Xml.object({
		name: { xmlName: "name", codec: Xml.scalar("System.String") },
	});
	const variants = [
		{ id: "Item", name: "Item", namespace: "", codec: payload },
		{ id: "Boots", name: "Boots", namespace: "", codec: payload },
	];
	const schema = Xml.document(
		"Root",
		Xml.object({
			equipped: {
				xmlName: "equipped",
				codec: Xml.nullable(Xml.polymorphic("Boots", [variants[1]!], true)),
			},
			items: {
				xmlName: "items",
				codec: Xml.wrapped(Xml.polymorphic("Item", variants), "Item"),
			},
		}),
	);
	const decoded = Schema.decodeSync(schema)(
		"<Root><equipped><name>Sneakers</name></equipped><items/></Root>",
	);
	assert.deepEqual(decoded.equipped, { name: "Sneakers", $type: "Boots" });
	const moved = { equipped: null, items: [decoded.equipped] };
	const xml = Schema.encodeSync(schema)(moved);
	assert.match(xml, /xsi:nil="true"/);
	assert.match(xml, /xsi:type="Boots"/);
	assert.deepEqual(Schema.decodeSync(schema)(xml), moved);
});

test("unrecognized subclasses retain opaque fields and namespace identity", () => {
	const schema = Xml.document(
		"Root",
		Xml.polymorphic("Base", [
			{ id: "Base", name: "Base", namespace: "", codec: Xml.object({}) },
			{ id: "Known", name: "Known", namespace: "", codec: Xml.object({}) },
		]),
	);
	const value = Schema.decodeSync(schema)(
		'<Root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:mod="urn:mod" xsi:type="mod:Custom"><name>0007</name><extra flag="true">value</extra></Root>',
	);
	assert.deepEqual(value, {
		$type: "$unknown",
		$xmlType: { name: "Custom", namespace: "urn:mod" },
		name: "0007",
		extra: { "@_flag": "true", "#text": "value" },
	});
	assert.deepEqual(
		Schema.decodeSync(schema)(Schema.encodeSync(schema)(value)),
		value,
	);
	// Opaque custom serializers can also be text-only or empty objects.
	for (const text of ["0007", ""]) {
		const opaque = Schema.decodeSync(schema)(
			`<Root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Custom">${text}</Root>`,
		);
		assert.ok(
			opaque !== null && typeof opaque === "object" && "#text" in opaque,
		);
		assert.equal(opaque["#text"], text);
		assert.deepEqual(
			Schema.decodeSync(schema)(Schema.encodeSync(schema)(opaque)),
			opaque,
		);
	}
});

test("document codecs reject extra roots and surrounding non-XML text", () => {
	const read = Schema.decodeSync(Xml.document("Root", Xml.object({})));
	assert.throws(() => read("<Root/><Root/>"));
	assert.throws(() => read("text<Root/>"));
	assert.deepEqual(
		read('<?xml version="1.0"?><!-- note --><Root/><!-- end -->'),
		{},
	);
});
