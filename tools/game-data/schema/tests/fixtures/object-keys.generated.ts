// Generated from catalog format 3 for "Example.Relationships". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "StardewValley.FarmerPair".
const Object0ValueSchema = Xml.structure(
	{
		Farmer1: Xml.field("Farmer1", Xml.scalarValues["System.Int64"]),
		Farmer2: Xml.field("Farmer2", Xml.scalarValues["System.Int64"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"StardewValley.FarmerPair",
	{ name: "FarmerPair", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "StardewValley.Friendship".
const Object1ValueSchema = Xml.structure(
	{
		Points: Xml.field("Points", Xml.scalarValues["System.Int32"]),
	},
	{ allowType: true },
);

const Object1Schema = Xml.variant(
	"StardewValley.Friendship",
	{ name: "Friendship", namespace: "" },
	Object1ValueSchema,
	true,
);

// Concrete CLR type "Example.Relationships".
const Object2ValueSchema = Xml.structure(
	{
		friendships: Xml.field(
			"friendships",
			Xml.value(
				Xml.dictionary(
					"FarmerPair",
					Object0Schema,
					"Friendship",
					Object1Schema,
					true,
					"StardewValley.FarmerPair",
				),
			),
		),
	},
	{ allowType: true },
);

const Object2Schema = Xml.variant(
	"Example.Relationships",
	{ name: "Relationships", namespace: "" },
	Object2ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Relationships", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
