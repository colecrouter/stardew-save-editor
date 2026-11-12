// Generated from catalog format 3 for "Example.Preserve". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Preserve".
const Object0ValueSchema = Xml.structure(
	{
		preserve: Xml.repeatedValues(
			"preserve",
			Xml.textValue(
				Xml.nullableEnumText([
					"AgedRoe",
					"Bait",
					"DriedFruit",
					"DriedMushroom",
					"Honey",
					"Jelly",
					"Juice",
					"Pickle",
					"Roe",
					"SmokedFish",
					"Wine",
				]),
			),
			1,
		),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Preserve",
	{ name: "Preserve", namespace: "" },
	Object0ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Preserve", Object0Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
