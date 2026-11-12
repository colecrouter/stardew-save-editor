// Generated from catalog format 3 for "Example.Stats". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Stats".
const Object0ValueSchema = Xml.structure(
	{
		specificMonstersKilled: Xml.field(
			"specificMonstersKilled",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"int",
					Xml.scalars["System.Int32"].codec,
					false,
					"ordinalIgnoreCase",
				),
			),
		),
		Values: Xml.field(
			"Values",
			Xml.value(
				Xml.dictionary(
					"string",
					Xml.scalars["System.String"].codec,
					"unsignedInt",
					Xml.scalars["System.UInt32"].codec,
					false,
					"ordinalIgnoreCase",
				),
			),
		),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Stats",
	{ name: "Stats", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Stats", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
