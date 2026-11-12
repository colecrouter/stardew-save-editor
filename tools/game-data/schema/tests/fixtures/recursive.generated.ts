// Generated from catalog format 3 for "Example.Node". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly Label: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly Parent: ReadonlyArray<Object2>;
};

type Object0 = { readonly type: "Example.Branch" } & Preserved<Object0Value>;

type Object1Value = {
	readonly Branches: ReadonlyArray<Object0>;
	readonly Children: ReadonlyArray<Object2>;
	readonly Depth: (typeof Xml.scalars)["System.Int32"]["codec"]["Type"];
	readonly heldObject: ReadonlyArray<Object2>;
	readonly Links: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: Object2;
			}>
		>
	>;
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
};

type Object2Value = {
	readonly Branches: ReadonlyArray<Object0>;
	readonly Children: ReadonlyArray<Object2>;
	readonly heldObject: ReadonlyArray<Object2>;
	readonly Links: Preserved<
		ReadonlyArray<
			Preserved<{
				readonly key: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
				readonly value: Object2;
			}>
		>
	>;
	readonly Name: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
};

type Object2 =
	| ({ readonly type: "Example.Derived" } & Preserved<Object1Value>)
	| ({ readonly type: "Example.Node" } & Preserved<Object2Value>);

// Payload of concrete CLR type "Example.Branch".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
	{
		Label: Xml.field("Label", Xml.scalarValues["System.String"]),
		Parent: Xml.repeatedValues(
			"Parent",
			Xml.value(Schema.suspend(() => Object2Schema)),
			1,
		),
	},
	{ allowType: true },
);

const Object0Schema: Schema.Codec<Object0, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Branch",
			{ name: "Branch", namespace: "" },
			Object0ValueSchema,
			true,
		),
);

// Payload of concrete CLR type "Example.Derived".
const Object1ValueSchema: Schema.Codec<
	Preserved<Object1Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object1Value> } = Xml.structure(
	{
		Branches: Xml.list(
			"Branches",
			"Branch",
			Xml.value(Schema.suspend(() => Object0Schema)),
		),
		Children: Xml.list(
			"Children",
			"Node",
			Xml.value(Schema.suspend(() => Object2Schema)),
		),
		Depth: Xml.field("Depth", Xml.scalarValues["System.Int32"]),
		heldObject: Xml.repeatedValues(
			"heldObject",
			Xml.value(Schema.suspend(() => Object2Schema)),
			1,
		),
		Links: Xml.field(
			"Links",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"Node",
					Schema.suspend(() => Object2Schema),
					true,
				),
			),
		),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Payload of concrete CLR type "Example.Node".
const Object2ValueSchema: Schema.Codec<
	Preserved<Object2Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object2Value> } = Xml.structure(
	{
		Branches: Xml.list(
			"Branches",
			"Branch",
			Xml.value(Schema.suspend(() => Object0Schema)),
		),
		Children: Xml.list(
			"Children",
			"Node",
			Xml.value(Schema.suspend(() => Object2Schema)),
		),
		heldObject: Xml.repeatedValues(
			"heldObject",
			Xml.value(Schema.suspend(() => Object2Schema)),
			1,
		),
		Links: Xml.field(
			"Links",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"Node",
					Schema.suspend(() => Object2Schema),
					true,
				),
			),
		),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object2Schema: Schema.Codec<Object2, Xml.XmlElement> = Schema.suspend(
	() =>
		Schema.Union([
			Xml.variant(
				"Example.Derived",
				{ name: "Derived", namespace: "" },
				Object1ValueSchema,
				false,
			),
			Xml.variant(
				"Example.Node",
				{ name: "Node", namespace: "" },
				Object2ValueSchema,
				true,
			),
		]),
);

export const FragmentSchema = Xml.named("Node", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
