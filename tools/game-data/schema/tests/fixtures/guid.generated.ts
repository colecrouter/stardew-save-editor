// Generated from catalog format 3 for "Example.Building". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Building".
const Object0ValueSchema = Xml.structure(
	{
		id: Xml.field("id", Xml.scalarValues["System.Guid"]),
		ids: Xml.list("ids", "guid", Xml.scalarValues["System.Guid"]),
		optional: Xml.field(
			"optional",
			Xml.nullable(Xml.scalarValues["System.Guid"]),
		),
		owner: Xml.attribute("owner", Xml.scalarValues["System.Guid"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Building",
	{ name: "Building", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Building", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
