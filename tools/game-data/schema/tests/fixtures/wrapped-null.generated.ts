// Generated from catalog format 3 for "Example.Paint". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Point".
const Object0ValueSchema = Xml.structure(
	{
		X: Xml.optional(Xml.field("X", Xml.scalarValues["System.Int32"])),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Point",
	{ name: "Point", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "Example.Node".
const Object1ValueSchema = Xml.structure(
	{
		Name: Xml.optional(Xml.field("Name", Xml.scalarValues["System.String"])),
	},
	{ allowType: true },
);

const Object1Schema = Xml.variant(
	"Example.Node",
	{ name: "Node", namespace: "" },
	Object1ValueSchema,
	true,
);

// Concrete CLR type "Example.Paint".
const Object2ValueSchema = Xml.structure(
	{
		ColorName: Xml.optional(
			Xml.list(
				"ColorName",
				"string",
				Xml.nullable(Xml.scalarValues["System.String"]),
				1,
			),
		),
		DirectName: Xml.repeatedValues(
			"name",
			Xml.scalarValues["System.String"],
			1,
		),
		NonNullableName: Xml.optional(
			Xml.list(
				"NonNullableName",
				"string",
				Xml.scalarValues["System.String"],
				1,
			),
		),
		Numbers: Xml.optional(
			Xml.list("Numbers", "int", Xml.scalarValues["System.Int32"]),
		),
		Points: Xml.optional(Xml.list("Points", "Point", Xml.value(Object0Schema))),
		Targets: Xml.optional(
			Xml.list("Targets", "Node", Xml.nullable(Xml.value(Object1Schema))),
		),
	},
	{ allowType: true },
);

const Object2Schema = Xml.variant(
	"Example.Paint",
	{ name: "Paint", namespace: "" },
	Object2ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Paint", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
