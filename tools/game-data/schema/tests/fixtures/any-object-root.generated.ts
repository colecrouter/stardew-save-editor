// Generated from catalog format 3 for "System.Object". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "System.Object".
const Object0ValueSchema = Xml.structure({}, { allowType: true });

const Object0Schema = Xml.anyObject(
	Xml.variant(
		"System.Object",
		{ name: "anyType", namespace: "http://www.w3.org/2001/XMLSchema" },
		Object0ValueSchema,
		true,
	),
);

export const FragmentSchema = Xml.named("anyType", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
