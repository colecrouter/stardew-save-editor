// Generated from catalog format 3 for "Example.Root". Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
import { Schema } from "effect";
import * as Xml from "../../xml-codecs.ts";

type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };

type Variant<Id extends string, A> = { readonly type: Id } & Preserved<A>;

type Int32 = typeof Int32Codec.Type;

type Mode = typeof ModeCodec.Type;

type StringValue = typeof StringCodec.Type;

type BooleanValue = typeof BooleanCodec.Type;

type ChangedValue = Omit<BaseValue, "Name"> & {
	readonly Name?: Int32;
	readonly Next?: Changed;
};

type BaseValue = {
	readonly Mode?: Mode;
	readonly Name?: StringValue;
};

type MarkerValue = DerivedValue;

type DerivedValue = BaseValue & {
	readonly Count?: Int32;
	readonly Next?: Derived;
};

type GrandchildValue = DerivedValue & {
	readonly Extra?: BooleanValue;
};

type ExampleNodeValue = {
	readonly Children?: ReadonlyArray<ExampleNode | null>;
	readonly Mode?: Mode;
	readonly Name?: StringValue;
	readonly Next?: ExampleNode;
};

type MarkerInstance = Variant<"Example.Marker", MarkerValue>;

type GrandchildInstance = Variant<"Example.Grandchild", GrandchildValue>;

type Changed = Variant<"Example.Changed", ChangedValue>;

type Marker = MarkerInstance;

type Derived =
	| Variant<"Example.Derived", DerivedValue>
	| GrandchildInstance
	| MarkerInstance;

type Grandchild = GrandchildInstance;

type ExampleNode = Variant<"Example.Node", ExampleNodeValue>;

const Int32Codec = Xml.scalarValues["System.Int32"];

const ModeCodec = Xml.enumeration(["Quiet", "Loud"]);

const StringCodec = Xml.scalarValues["System.String"];

const BooleanCodec = Xml.scalarValues["System.Boolean"];

const ChangedReference = Xml.value(Schema.suspend(() => ChangedSchema));

const DerivedReference = Xml.value(Schema.suspend(() => DerivedSchema));

const ExampleNodeReference = Xml.value(Schema.suspend(() => ExampleNodeSchema));

const ExampleNodeOrNullCodec = Xml.nullable(ExampleNodeReference);

const StringToStringDictionaryIgnoringCaseCodec = Xml.value(
	Xml.dictionary(
		"string",
		StringCodec.text,
		"string",
		StringCodec.text,
		false,
		"ordinalIgnoreCase",
	),
);

const StringToStringDictionaryCodec = Xml.value(
	Xml.dictionary("string", StringCodec.text, "string", StringCodec.text, false),
);

// Saved payload fields of "Example.Base".
const BaseFields = {
	Mode: Xml.optional(Xml.field("Mode", ModeCodec)),
	Name: Xml.optional(Xml.field("Name", StringCodec)),
};

// Saved payload fields of "Example.Changed".
const ChangedFields = {
	...BaseFields,
	Name: Xml.optional(Xml.field("caption", Int32Codec)),
	Next: Xml.optional(Xml.field("Next", ChangedReference)),
};

// Saved payload fields of "Example.Derived".
const DerivedFields = {
	...BaseFields,
	Count: Xml.optional(Xml.field("Count", Int32Codec)),
	Next: Xml.optional(Xml.field("Next", DerivedReference)),
};

// Saved payload fields of "Example.Grandchild".
const GrandchildFields = {
	...DerivedFields,
	Extra: Xml.optional(Xml.field("Extra", BooleanCodec)),
};

// Saved payload fields of "Example.Marker".
const MarkerFields = {
	...DerivedFields,
};

// Saved payload fields of "Example.Removed".
const RemovedFields = {
	Name: Xml.optional(Xml.field("Name", StringCodec)),
};

// Saved payload fields of "Example.Node".
const ExampleNodeFields = {
	Children: Xml.optional(Xml.list("Children", "Node", ExampleNodeOrNullCodec)),
	Mode: Xml.optional(Xml.field("Mode", ModeCodec)),
	Name: Xml.optional(Xml.field("Name", StringCodec)),
	Next: Xml.optional(Xml.field("Next", ExampleNodeReference)),
};

// Saved payload fields of "Example.Point".
const PointFields = {
	X: Xml.optional(Xml.field("X", Int32Codec)),
	Y: Xml.optional(Xml.field("Y", Int32Codec)),
};

// Saved payload fields of "Other.Node".
const OtherNodeFields = {
	Name: Xml.optional(Xml.field("Name", StringCodec)),
};

// Saved payload fields of "Example.Root".
const RootFields = {
	Animal: Xml.optional(
		Xml.field("Animal", Xml.value(Schema.suspend(() => BaseSchema))),
	),
	CaseLabels: Xml.optional(
		Xml.field("CaseLabels", StringToStringDictionaryIgnoringCaseCodec),
	),
	Changed: Xml.optional(Xml.field("Changed", ChangedReference)),
	Children: Xml.optional(Xml.list("Children", "Node", ExampleNodeOrNullCodec)),
	Labels: Xml.optional(Xml.field("Labels", StringToStringDictionaryCodec)),
	Last: Xml.optional(
		Xml.field("Last", Xml.value(Schema.suspend(() => GrandchildSchema))),
	),
	Left: Xml.optional(Xml.field("Left", ExampleNodeReference)),
	Marker: Xml.optional(
		Xml.field("Marker", Xml.value(Schema.suspend(() => MarkerSchema))),
	),
	Other: Xml.optional(Xml.field("Other", DerivedReference)),
	OtherCaseLabels: Xml.optional(
		Xml.field("OtherCaseLabels", StringToStringDictionaryIgnoringCaseCodec),
	),
	OtherLabels: Xml.optional(
		Xml.field("OtherLabels", StringToStringDictionaryCodec),
	),
	Position: Xml.optional(
		Xml.field("Position", Xml.value(Schema.suspend(() => PointSchema))),
	),
	Removed: Xml.optional(
		Xml.field("Removed", Xml.value(Schema.suspend(() => RemovedSchema))),
	),
	Right: Xml.optional(
		Xml.field("Right", Xml.value(Schema.suspend(() => OtherNodeSchema))),
	),
};

const ChangedValueSchema: Schema.Codec<
	Preserved<ChangedValue>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<ChangedValue> } = Xml.structure(
	ChangedFields,
	{ allowType: true },
);

const DerivedValueSchema: Schema.Codec<
	Preserved<DerivedValue>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<DerivedValue> } = Xml.structure(
	DerivedFields,
	{ allowType: true },
);

const GrandchildValueSchema: Schema.Codec<
	Preserved<GrandchildValue>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<GrandchildValue> } = Xml.structure(
	GrandchildFields,
	{ allowType: true },
);

const MarkerValueSchema: Schema.Codec<
	Preserved<MarkerValue>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<MarkerValue> } = Xml.structure(
	MarkerFields,
	{ allowType: true },
);

const RemovedValueSchema = Xml.structure(RemovedFields, { allowType: true });

const ExampleNodeValueSchema: Schema.Codec<
	Preserved<ExampleNodeValue>,
	Xml.XmlElement
> & { readonly valueSchema: Schema.Codec<ExampleNodeValue> } = Xml.structure(
	ExampleNodeFields,
	{ allowType: true },
);

const PointValueSchema = Xml.structure(PointFields, { allowType: true });

const OtherNodeValueSchema = Xml.structure(OtherNodeFields, {
	allowType: true,
});

const RootValueSchema = Xml.structure(RootFields, { allowType: true });

const GrandchildVariant = Xml.variant(
	"Example.Grandchild",
	{ name: "Grandchild", namespace: "" },
	GrandchildValueSchema,
	false,
);

const MarkerVariant = Xml.variant(
	"Example.Marker",
	{ name: "Marker", namespace: "" },
	MarkerValueSchema,
	false,
);

const ChangedSchema: Schema.Codec<Changed, Xml.XmlElement> = Schema.suspend(
	() =>
		Xml.variant(
			"Example.Changed",
			{ name: "Changed", namespace: "" },
			ChangedValueSchema,
			true,
		),
);

const GrandchildSchema: Schema.Codec<Grandchild, Xml.XmlElement> =
	Schema.suspend(() =>
		Xml.variant(
			"Example.Grandchild",
			{ name: "Grandchild", namespace: "" },
			GrandchildValueSchema,
			true,
		),
	);

const MarkerSchema: Schema.Codec<Marker, Xml.XmlElement> = Schema.suspend(() =>
	Xml.variant(
		"Example.Marker",
		{ name: "Marker", namespace: "" },
		MarkerValueSchema,
		true,
	),
);

const DerivedSchema: Schema.Codec<Derived, Xml.XmlElement> = Schema.suspend(
	() =>
		Schema.Union([
			Xml.variant(
				"Example.Derived",
				{ name: "Derived", namespace: "" },
				DerivedValueSchema,
				true,
			),
			GrandchildVariant,
			MarkerVariant,
		]),
);

const RemovedSchema = Xml.variant(
	"Example.Removed",
	{ name: "Removed", namespace: "" },
	RemovedValueSchema,
	true,
);

const BaseSchema = Schema.Union([
	Xml.variant(
		"Example.Changed",
		{ name: "Changed", namespace: "" },
		ChangedValueSchema,
		false,
	),
	Xml.variant(
		"Example.Derived",
		{ name: "Derived", namespace: "" },
		DerivedValueSchema,
		false,
	),
	GrandchildVariant,
	MarkerVariant,
	Xml.variant(
		"Example.Removed",
		{ name: "Removed", namespace: "" },
		RemovedValueSchema,
		false,
	),
]);

const ExampleNodeSchema: Schema.Codec<ExampleNode, Xml.XmlElement> =
	Schema.suspend(() =>
		Xml.variant(
			"Example.Node",
			{ name: "Node", namespace: "" },
			ExampleNodeValueSchema,
			true,
		),
	);

const PointSchema = Xml.variant(
	"Example.Point",
	{ name: "Point", namespace: "" },
	PointValueSchema,
	true,
);

const OtherNodeSchema = Xml.variant(
	"Other.Node",
	{ name: "Node", namespace: "" },
	OtherNodeValueSchema,
	true,
);

const RootSchema = Xml.variant(
	"Example.Root",
	{ name: "Root", namespace: "" },
	RootValueSchema,
	true,
);

export const FragmentSchema = Xml.named("Root", RootSchema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
