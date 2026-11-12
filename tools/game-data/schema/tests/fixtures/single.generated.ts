// Generated from catalog format 3 for "Example.Fence". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Fence".
const Object0ValueSchema = Xml.structure(
	{
		Bias: Xml.attribute("Bias", Xml.scalarValues["System.Single"]),
		Health: Xml.field("Health", Xml.scalarValues["System.Single"]),
		History: Xml.list("History", "float", Xml.scalarValues["System.Single"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Fence",
	{ name: "Fence", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Fence", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
