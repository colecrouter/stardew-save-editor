// Generated from catalog format 3 for "Example.Profile". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Profile".
const Object0ValueSchema = Xml.structure(
	{
		Count: Xml.field("Count", Xml.scalarValues["System.Int32"]),
		Enabled: Xml.field("Enabled", Xml.scalarValues["System.Boolean"]),
		Name: Xml.field("Name", Xml.scalarValues["System.String"]),
		Season: Xml.field("Season", Xml.enumeration(["spring", "winter"])),
		Tags: Xml.list("Tags", "tag", Xml.scalarValues["System.String"]),
		Version: Xml.attribute("version", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Profile",
	{ name: "Profile", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Profile", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
