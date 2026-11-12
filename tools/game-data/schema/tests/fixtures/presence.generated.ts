// Generated from catalog format 3 for "Example.Save". Do not edit.
// Explicit envelope types and suspended references permit finite recursive XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Object0Value = {
	readonly Child?: Object0;
	readonly Name?: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
};

type Object0 = { readonly type: "Example.Node" } & Preserved<Object0Value>;

type Object1Value = {
	readonly Child?: Object0;
	readonly count?: (typeof Xml.scalars)["System.Int32"]["codec"]["Type"] | null;
	readonly gameVersionLabel?: (typeof Xml.scalars)["System.String"]["codec"]["Type"];
	readonly Number?: (typeof Xml.scalars)["System.Int32"]["codec"]["Type"];
	readonly tags: ReadonlyArray<
		(typeof Xml.scalars)["System.String"]["codec"]["Type"]
	>;
	readonly values?: ReadonlyArray<
		(typeof Xml.scalars)["System.Int32"]["codec"]["Type"]
	>;
	readonly version?: (typeof Xml.scalars)["System.Int32"]["codec"]["Type"];
};

type Object1 = { readonly type: "Example.Save" } & Preserved<Object1Value>;

// Payload of concrete CLR type "Example.Node".
const Object0ValueSchema: Schema.Codec<
	Preserved<Object0Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object0Value> } = Xml.structure(
	{
		Child: Xml.optional(
			Xml.field("Child", Xml.value(Schema.suspend(() => Object0Schema))),
		),
		Name: Xml.optional(Xml.field("Name", Xml.scalarValues["System.String"])),
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

// Payload of concrete CLR type "Example.Save".
const Object1ValueSchema: Schema.Codec<
	Preserved<Object1Value>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<Object1Value> } = Xml.structure(
	{
		Child: Xml.optional(
			Xml.field("Child", Xml.value(Schema.suspend(() => Object0Schema))),
		),
		count: Xml.optional(
			Xml.field("count", Xml.nullable(Xml.scalarValues["System.Int32"])),
		),
		gameVersionLabel: Xml.optional(
			Xml.field("gameVersionLabel", Xml.scalarValues["System.String"]),
		),
		Number: Xml.optional(Xml.field("Number", Xml.scalarValues["System.Int32"])),
		tags: Xml.repeatedValues("tag", Xml.scalarValues["System.String"]),
		values: Xml.optional(
			Xml.list("values", "int", Xml.scalarValues["System.Int32"]),
		),
		version: Xml.optional(
			Xml.attribute("version", Xml.scalarValues["System.Int32"]),
		),
	},
	{ allowType: true },
);

const Object1Schema: Schema.Codec<Object1, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Save",
			{ name: "Save", namespace: "" },
			Object1ValueSchema,
			true,
		),
);

export const FragmentSchema = Xml.named("Save", Object1Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
