// Generated from catalog format 3 for "Example.Lists". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly Count: (typeof Xml.scalars)["System.Int32"]["codec"]["Type"];
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly Nodes: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<Object1 | null>;
			}>
		>
	>;
};

type Object1Value = {
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly Nodes: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<Object1 | null>;
			}>
		>
	>;
};

type Object1 =
	| ({ readonly type: "Example.Node" } & Preserved<Object1Value>)
	| ({ readonly type: "Example.SpecialNode" } & Preserved<Object0Value>);

type Object2Value = {
	readonly bytes: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<
					(typeof Xml.scalars)["System.Byte"]["codec"]["Type"]
				>;
			}>
		>
	>;
	readonly matrix: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<ReadonlyArray<
					(typeof Xml.scalars)["System.Int32"]["codec"]["Type"]
				> | null>;
			}>
		>
	>;
	readonly nodes: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<Object1 | null>;
			}>
		>
	>;
	readonly stats: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<
					(typeof Xml.scalars)["System.Int32"]["codec"]["Type"]
				>;
			}>
		>
	>;
	readonly words: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<
					(typeof Xml.scalars)["System.String"]["codec"]["Type"] | null
				>;
			}>
		>
	>;
};

type Object2 = { readonly type: "Example.Lists" } & Preserved<Object2Value>;

// Payload of concrete CLR type "Example.SpecialNode".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
	{
		Count: Xml.field("Count", Xml.scalarValues["System.Int32"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
		Nodes: Xml.field(
			"Nodes",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfNode",
					Xml.array(
						Xml.nullable(Xml.value(Schema.suspend(() => Object1Schema))),
						"Node",
					),
					true,
				),
			),
		),
	},
	{ allowType: true },
);

// Payload of concrete CLR type "Example.Node".
const Object1ValueSchema: Schema.Codec<
	Preserved<Object1Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object1Value> } = Xml.structure(
	{
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
		Nodes: Xml.field(
			"Nodes",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfNode",
					Xml.array(
						Xml.nullable(Xml.value(Schema.suspend(() => Object1Schema))),
						"Node",
					),
					true,
				),
			),
		),
	},
	{ allowType: true },
);

const Object1Schema: Schema.Codec<Object1, Xml.XmlElement> = Schema.suspend(
	() =>
		Schema.Union([
			Xml.variant(
				"Example.Node",
				{ name: "Node", namespace: "" },
				Object1ValueSchema,
				true,
			),
			Xml.variant(
				"Example.SpecialNode",
				{ name: "SpecialNode", namespace: "" },
				Object0ValueSchema,
				false,
			),
		]),
);

// Payload of concrete CLR type "Example.Lists".
const Object2ValueSchema: Schema.Codec<
	Preserved<Object2Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object2Value> } = Xml.structure(
	{
		bytes: Xml.field(
			"bytes",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfUnsignedByte",
					Xml.array(Xml.scalarValues["System.Byte"], "unsignedByte"),
					true,
				),
			),
		),
		matrix: Xml.field(
			"matrix",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfArrayOfInt",
					Xml.array(
						Xml.nullable(Xml.array(Xml.scalarValues["System.Int32"], "int")),
						"ArrayOfInt",
					),
					true,
				),
			),
		),
		nodes: Xml.field(
			"nodes",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfNode",
					Xml.array(
						Xml.nullable(Xml.value(Schema.suspend(() => Object1Schema))),
						"Node",
					),
					true,
				),
			),
		),
		stats: Xml.field(
			"stats",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfInt",
					Xml.array(Xml.scalarValues["System.Int32"], "int"),
					true,
				),
			),
		),
		words: Xml.field(
			"words",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"ArrayOfString",
					Xml.array(Xml.nullable(Xml.scalarValues["System.String"]), "string"),
					true,
				),
			),
		),
	},
	{ allowType: true },
);

const Object2Schema: Schema.Codec<Object2, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Lists",
			{ name: "Lists", namespace: "" },
			Object2ValueSchema,
			true,
		),
);

export const FragmentSchema = Xml.named("Lists", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
