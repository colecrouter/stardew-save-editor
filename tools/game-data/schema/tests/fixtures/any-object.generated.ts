// Generated from catalog format 3 for "Example.DescriptionElement". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
};

type Object1Value = Record<string, never>;

type Object1 =
	| ({ readonly type: "Example.DescriptionElement" } & Preserved<Object2Value>)
	| ({ readonly type: "Example.Object" } & Preserved<Object0Value>)
	| ({ readonly type: "System.Object" } & Preserved<Object1Value>)
	| Xml.ScalarObject;

type Object2Value = {
	readonly param: ReadonlyArray<Object1>;
	readonly xmlKey: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
};

type Object2 = {
	readonly type: "Example.DescriptionElement";
} & Preserved<Object2Value>;

// Payload of concrete CLR type "Example.Object".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
	{
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Payload of concrete CLR type "System.Object".
const Object1ValueSchema: Schema.Codec<
	Preserved<Object1Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object1Value> } = Xml.structure(
	{},
	{ allowType: true },
);

const Object1Schema: Schema.Codec<Object1, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.anyObject(
			Schema.Union([
				Xml.variant(
					"Example.DescriptionElement",
					{ name: "DescriptionElement", namespace: "" },
					Object2ValueSchema,
					false,
				),
				Xml.variant(
					"Example.Object",
					{ name: "Object", namespace: "" },
					Object0ValueSchema,
					false,
				),
				Xml.variant(
					"System.Object",
					{ name: "anyType", namespace: "http://www.w3.org/2001/XMLSchema" },
					Object1ValueSchema,
					true,
				),
			]),
		),
);

// Payload of concrete CLR type "Example.DescriptionElement".
const Object2ValueSchema: Schema.Codec<
	Preserved<Object2Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object2Value> } = Xml.structure(
	{
		param: Xml.repeatedValues(
			"param",
			Xml.value(Schema.suspend(() => Object1Schema)),
		),
		xmlKey: Xml.field("xmlKey", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object2Schema: Schema.Codec<Object2, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.DescriptionElement",
			{ name: "DescriptionElement", namespace: "" },
			Object2ValueSchema,
			true,
		),
);

export const FragmentSchema = Xml.named("DescriptionElement", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
