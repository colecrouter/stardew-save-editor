import { describe, expect, it } from "vitest";
import { XMLCodec } from "../src/lib/xmlCodec.ts";

const codec = new XMLCodec();
const roundTrip = (xml: string) => {
	const document = codec.parse(xml);
	return codec.parse(
		new TextDecoder().decode(codec.stringify(structuredClone(document))),
	);
};

describe("save XML representation", () => {
	it("preserves opaque fields, identifiers, attributes and significant text", () => {
		const xml =
			'<?xml version="1.0" encoding="utf-8"?><SaveGame xmlns:xsi="urn:test"><mod field="007"><name>007</name><hex>0x1F</hex><scientific>1e3</scientific><id>18446744073709551615</id><space>  </space><escaped>&amp;&lt;&gt;&quot;&apos;&#13;</escaped><nil xsi:nil="true"/><empty/><number>1.25</number><bool>true</bool></mod></SaveGame>';
		const document = codec.parse(xml);
		expect(roundTrip(xml)).toEqual(document);
		expect(document).toMatchObject({
			SaveGame: {
				mod: {
					name: "007",
					hex: "0x1F",
					scientific: "1e3",
					id: "18446744073709551615",
					space: "  ",
					number: 1.25,
					bool: true,
				},
			},
		});
	});
	it("joins text across CDATA and comments and handles repeated/singleton arrays", () => {
		const xml =
			"<SaveGame><name>a<![CDATA[<&]]><!-- ignored -->b</name><items><Item>one</Item></items><custom>x</custom><custom>y</custom></SaveGame>";
		expect(codec.parse(xml)).toEqual({
			SaveGame: { name: "a<&b", items: { Item: ["one"] }, custom: ["x", "y"] },
		});
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
	});
	it("formats element-only content without changing meaningful spaces", () => {
		const document = codec.parse(
			"<SaveGame><name>  Farm  </name><empty/></SaveGame>",
		);
		const pretty = new TextDecoder().decode(
			codec.stringify(structuredClone(document), true),
		);
		expect(pretty).toContain("\n    <name>  Farm  </name>");
		expect(codec.parse(pretty)).toEqual(document);
	});
	it("preserves text and entities across parser input chunk boundaries", () => {
		// Place an astral character and an entity across separate 64 Ki code-unit boundaries.
		const prefix = "x".repeat(65536 - "<SaveGame><name>".length - 1);
		const text = `${prefix}🌱${"y".repeat(65533)}&amp;done`;
		const xml = `<SaveGame><name>${text}</name></SaveGame>`;
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
		expect(codec.parse(xml)).toEqual({
			SaveGame: { name: text.replace("&amp;", "&") },
		});
	});
	it("retains the declaration's optional fields without inventing an encoding", () => {
		const xml = '<?xml version="1.0" standalone="yes"?><SaveGame />';
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
	});

	it("preserves opaque processing instructions before and inside game data", () => {
		const xml =
			'<?mod-tool arbitrary data?><SaveGame><?mod-field x="007"?><name>Farm</name></SaveGame>';
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
	});

	it("preserves imprecise decimals with long internal zero runs", () => {
		// This remains a string: rounding away the final digit would lose mod data.
		const value = `0.5${"0".repeat(65536)}1`;
		const xml = `<SaveGame><opaque>${value}</opaque></SaveGame>`;
		expect(codec.parse(xml)).toEqual({ SaveGame: { opaque: value } });
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
	});

	it("accepts opaque mod values beyond the parser's default token cap", () => {
		const value = "x".repeat(10 * 1024 * 1024 + 1);
		expect(
			codec.parse(`<SaveGame><modData>${value}</modData></SaveGame>`),
		).toEqual({ SaveGame: { modData: value } });
	});

	it("retains tiny nonzero decimals that would underflow to zero", () => {
		const value = `0.${"0".repeat(400)}1`;
		expect(
			codec.parse(`<SaveGame><opaque>${value}</opaque></SaveGame>`),
		).toEqual({ SaveGame: { opaque: value } });
	});

	it("preserves slash/greater-than sequences inside unknown attributes", () => {
		// Empty-element formatting must not rewrite the same characters in data.
		const xml =
			'<SaveGame opaque="a/&gt;"><empty opaque="b/&gt;" /></SaveGame>';
		expect(roundTrip(xml)).toEqual(codec.parse(xml));
	});

	it.each([
		"<a><b></a>",
		'<a x="1" x="2"/>',
		"<a>&missing;</a>",
		"<a/><b/>",
		"<a>\u0000</a>",
	])("rejects malformed XML: %s", (xml) => {
		expect(() => codec.parse(xml)).toThrow();
	});
	it("keeps prototype-like unknown element names as ordinary saved data", () => {
		const document = codec.parse(
			"<SaveGame><__proto__><value>safe</value></__proto__><constructor>mod</constructor></SaveGame>",
		);
		expect(
			roundTrip(
				"<SaveGame><__proto__><value>safe</value></__proto__><constructor>mod</constructor></SaveGame>",
			),
		).toEqual(document);
		expect(
			Object.hasOwn((document as { SaveGame: object }).SaveGame, "__proto__"),
		).toBe(true);
	});
});
