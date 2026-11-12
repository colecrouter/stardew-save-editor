// Generated from catalog format 3 for "Example.Order". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import * as Xml from "../../xml-codecs.ts";

// Concrete CLR type "Example.Address".
const Object0ValueSchema = Xml.structure(
	{
		City: Xml.field("City", Xml.scalarValues["System.String"]),
		Zip: Xml.field("Zip", Xml.scalarValues["System.Int32"]),
	},
	{ allowType: true },
);

const Object0Schema = Xml.variant(
	"Example.Address",
	{ name: "Address", namespace: "" },
	Object0ValueSchema,
	true,
);

// Concrete CLR type "Example.Line".
const Object1ValueSchema = Xml.structure(
	{
		Destination: Xml.field("Destination", Xml.value(Object0Schema)),
		Quantity: Xml.field("Quantity", Xml.scalarValues["System.Int32"]),
		Sku: Xml.attribute("sku", Xml.scalarValues["System.String"]),
	},
	{ allowType: true },
);

const Object1Schema = Xml.variant(
	"Example.Line",
	{ name: "entry", namespace: "" },
	Object1ValueSchema,
	true,
);

// Concrete CLR type "Example.Order".
const Object2ValueSchema = Xml.structure(
	{
		Billing: Xml.field("Billing", Xml.value(Object0Schema)),
		Lines: Xml.list("Lines", "entry", Xml.value(Object1Schema)),
		OrderId: Xml.field("OrderId", Xml.scalarValues["System.Int64"]),
		Shipping: Xml.field("Shipping", Xml.value(Object0Schema)),
	},
	{ allowType: true },
);

const Object2Schema = Xml.variant(
	"Example.Order",
	{ name: "Order", namespace: "" },
	Object2ValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Order", Object2Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
