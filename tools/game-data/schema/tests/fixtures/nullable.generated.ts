// Generated from catalog format 3 for "Example.Nullable". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Nullable".
const Object0ValueSchema = Xml.structure(
	{
		count: Xml.field("count", Xml.nullable(Xml.scalarValues["System.UInt32"])),
		history: Xml.list(
			"history",
			"int",
			Xml.nullable(Xml.scalarValues["System.Int32"]),
		),
		state: Xml.field(
			"state",
			Xml.nullable(Xml.enumeration(["Ready", "saved-old"])),
		),
		version: Xml.attribute("version", Xml.scalarValues["System.UInt32"]),
		which: Xml.field("which", Xml.nullable(Xml.scalarValues["System.Int32"])),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Nullable",
	{ name: "Nullable", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Nullable", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
