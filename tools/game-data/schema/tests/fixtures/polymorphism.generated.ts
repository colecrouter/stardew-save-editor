// Generated from catalog format 3 for "Example.Container". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Holder".
const Object0ValueSchema = Xml.structure(
	{
		Note: Xml.field("Note", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Holder",
	{ name: "Holder", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "Example.Cat".
const Object1ValueSchema = Xml.structure(
	{
		Lives: Xml.field("Lives", Xml.scalarValues["System.Int32"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Concrete CLR type "Example.Dog".
const Object2ValueSchema = Xml.structure(
	{
		BarkCount: Xml.field("BarkCount", Xml.scalarValues["System.Int32"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Concrete CLR type "Example.Animal".
const Object3ValueSchema = Xml.structure(
	{
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object3Schema = Schema.Union([
	Xml.variant(
		"Example.Animal",
		{ name: "Animal", namespace: "" },
		Object3ValueSchema,
		true,
	),
	Xml.variant(
		"Example.Cat",
		{ name: "Kitten", namespace: "" },
		Object1ValueSchema,
		false,
	),
	Xml.variant(
		"Example.Dog",
		{ name: "Hound", namespace: "urn:pets" },
		Object2ValueSchema,
		false,
	),
]);

// Concrete CLR type "Example.Container".
const Object4ValueSchema = Xml.structure(
	{
		Holder: Xml.field("Holder", Xml.value(Object0Schema)),
		Pet: Xml.field("Pet", Xml.value(Object3Schema)),
		Pets: Xml.list("Pets", "Animal", Xml.value(Object3Schema)),
	},
	{ allowType: true },
);

const Object4Schema = Xml.variant(
	"Example.Container",
	{ name: "Container", namespace: "" },
	Object4ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Container", Object4Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
