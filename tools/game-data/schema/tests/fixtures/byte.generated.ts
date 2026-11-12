// Generated from catalog format 3 for "Example.Color". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Color".
const Object0ValueSchema = Xml.structure(
	{
		A: Xml.field("A", Xml.scalarValues["System.Byte"]),
		B: Xml.attribute("B", Xml.scalarValues["System.Byte"]),
		G: Xml.field("G", Xml.scalarValues["System.Byte"]),
		Palette: Xml.list(
			"Palette",
			"unsignedByte",
			Xml.scalarValues["System.Byte"],
		),
		R: Xml.field("R", Xml.scalarValues["System.Byte"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Color",
	{ name: "Color", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Color", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
