// Generated from catalog format 3 for "Example.Map". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Microsoft.Xna.Framework.Vector2".
const Object0ValueSchema = Xml.structure(
	{
		X: Xml.field("X", Xml.scalarValues["System.Single"]),
		Y: Xml.field("Y", Xml.scalarValues["System.Single"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Microsoft.Xna.Framework.Vector2",
	{ name: "Vector2", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "Example.Entry".
const Object1ValueSchema = Xml.structure(
	{
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object1Schema = Xml.variant(
	"Example.Entry",
	{ name: "Entry", namespace: "" },
	Object1ValueSchema,
	true,
);

// Concrete CLR type "Example.Map".
const Object2ValueSchema = Xml.structure(
	{
		objects: Xml.field(
			"objects",
			Xml.value(
				Xml.dictionary(
					"Vector2",
					Object0Schema,
					"Entry",
					Object1Schema,
					true,
					"Microsoft.Xna.Framework.Vector2",
				),
			),
		),
		Position: Xml.field("Position", Xml.value(Object0Schema)),
	},
	{ allowType: true },
);

const Object2Schema = Xml.variant(
	"Example.Map",
	{ name: "Map", namespace: "" },
	Object2ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Map", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
