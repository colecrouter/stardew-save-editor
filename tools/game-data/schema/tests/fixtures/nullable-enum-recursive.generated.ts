// Generated from catalog format 3 for "Example.Item". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly next: ReadonlyArray<Object0>;
	readonly preserve: ReadonlyArray<
		| "AgedRoe"
		| "Bait"
		| "DriedFruit"
		| "DriedMushroom"
		| "Honey"
		| "Jelly"
		| "Juice"
		| "Pickle"
		| "Roe"
		| "SmokedFish"
		| "Wine"
		| null
	>;
};

type Object0 = { readonly type: "Example.Item" } & Preserved<Object0Value>;

// Payload of concrete CLR type "Example.Item".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
	{
		name: Xml.field("name", Xml.scalarValues["System.String"]),
		next: Xml.repeatedValues(
			"next",
			Xml.value(Schema.suspend(() => Object0Schema)),
			1,
		),
		preserve: Xml.repeatedValues(
			"preserve",
			Xml.textValue(
				Xml.nullableEnumText([
					"AgedRoe",
					"Bait",
					"DriedFruit",
					"DriedMushroom",
					"Honey",
					"Jelly",
					"Juice",
					"Pickle",
					"Roe",
					"SmokedFish",
					"Wine",
				]),
			),
			1,
		),
	},
	{ allowType: true },
);

const Object0Schema: Schema.Codec<Object0, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Item",
			{ name: "Item", namespace: "" },
			Object0ValueSchema,
			true,
		),
);

export const FragmentSchema = Xml.named("Item", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
