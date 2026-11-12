// Generated from catalog format 3 for "Example.Container". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Cat".
const Object0ValueSchema = Xml.structure(
	{
		Lives: Xml.field("Lives", Xml.scalarValues["System.Int32"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Concrete CLR type "Example.Dog".
const Object1ValueSchema = Xml.structure(
	{
		BarkCount: Xml.field("BarkCount", Xml.scalarValues["System.Int32"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

// Concrete CLR type "Example.Animal".
const Object2ValueSchema = Xml.structure(
	{
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object2Schema = Schema.Union([
	Xml.variant(
		"Example.Animal",
		{ name: "Animal", namespace: "" },
		Object2ValueSchema,
		true,
	),
	Xml.variant(
		"Example.Cat",
		{ name: "Kitten", namespace: "" },
		Object0ValueSchema,
		false,
	),
	Xml.variant(
		"Example.Dog",
		{ name: "Hound", namespace: "urn:pets" },
		Object1ValueSchema,
		false,
	),
]);

// Concrete CLR type "Example.Holder".
const Object3ValueSchema = Xml.structure(
	{
		Note: Xml.field("Note", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object3Schema = Xml.variant(
	"Example.Holder",
	{ name: "Holder", namespace: "" },
	Object3ValueSchema,
	true,
);

// Concrete CLR type "Example.Container".
const Object4ValueSchema = Xml.structure(
	{
		Animals: Xml.field(
			"Animals",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"Animal",
					Object2Schema,
					true,
				),
			),
		),
		Holder: Xml.field("Holder", Xml.value(Object3Schema)),
		Labels: Xml.field(
			"Labels",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"string",
					Xml.scalars["System.String"].codec,
					false,
				),
			),
		),
		Pet: Xml.field("Pet", Xml.value(Object2Schema)),
		Pets: Xml.list("Pets", "Animal", Xml.value(Object2Schema)),
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
