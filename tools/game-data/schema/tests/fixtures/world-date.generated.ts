// Generated from catalog format 3 for "StardewValley.WorldDate". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "StardewValley.WorldDate".
const Object0ValueSchema = Xml.structure(
	{
		DayOfMonth: Xml.field("DayOfMonth", Xml.scalarValues["System.Int32"]),
		SeasonKey: Xml.field("Season", Xml.scalarValues["System.String"]),
		Year: Xml.field("Year", Xml.scalarValues["System.Int32"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"StardewValley.WorldDate",
	{ name: "WorldDate", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("WorldDate", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
