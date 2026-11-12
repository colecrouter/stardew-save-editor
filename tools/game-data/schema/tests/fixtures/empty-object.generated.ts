// Generated from catalog format 3 for "Example.Mine". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "System.Random".
const Object0ValueSchema = Xml.structure({}, { allowType: true });

const Object0Schema = Xml.variant(
	"System.Random",
	{ name: "Random", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "Example.Mine".
const Object1ValueSchema = Xml.structure(
	{
		level: Xml.field("level", Xml.scalarValues["System.Int32"]),
		mineRandom: Xml.field("mineRandom", Xml.value(Object0Schema)),
	},
	{ allowType: true },
);

const Object1Schema = Xml.variant(
	"Example.Mine",
	{ name: "Mine", namespace: "" },
	Object1ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Mine", Object1Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
