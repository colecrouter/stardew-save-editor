// Generated from catalog format 3 for "Example.Luck". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Luck".
const Object0ValueSchema = Xml.structure(
	{
		bias: Xml.attribute("bias", Xml.scalarValues["System.Double"]),
		dailyLuck: Xml.field("dailyLuck", Xml.scalarValues["System.Double"]),
		history: Xml.list("history", "double", Xml.scalarValues["System.Double"]),
		optional: Xml.field(
			"optional",
			Xml.nullable(Xml.scalarValues["System.Double"]),
		),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Luck",
	{ name: "Luck", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Luck", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
