// Generated from catalog format 3 for "Example.Arrays". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly Nodes: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: ReadonlyArray<Object0 | null>;
			}>
		>
	>;
};

type Object0 = { readonly type: "Example.Node" } & Preserved<Object0Value>;

type Object1Value = {
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
				readonly value: ReadonlyArray<Object0 | null>;
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
};

type Object1 = { readonly type: "Example.Arrays" } & Preserved<Object1Value>;

// Payload of concrete CLR type "Example.Node".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
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
						Xml.nullable(Xml.value(Schema.suspend(() => Object0Schema))),
						"Node",
					),
					true,
				),
			),
		),
	},
	{ allowType: true },
);

const Object0Schema: Schema.Codec<Object0, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Node",
			{ name: "Node", namespace: "" },
			Object0ValueSchema,
			true,
		),
);

// Payload of concrete CLR type "Example.Arrays".
const Object1ValueSchema: Schema.Codec<
	Preserved<Object1Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object1Value> } = Xml.structure(
	{
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
						Xml.nullable(Xml.value(Schema.suspend(() => Object0Schema))),
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
	},
	{ allowType: true },
);

const Object1Schema: Schema.Codec<Object1, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Arrays",
			{ name: "Arrays", namespace: "" },
			Object1ValueSchema,
			true,
		),
);

export const FragmentSchema = Xml.named("Arrays", Object1Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
