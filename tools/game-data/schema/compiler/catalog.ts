import * as Schema from "effect/Schema";

// This is the boundary between C# inspection JSON and the compiler. Validate
// only fields used to generate codecs: assembly hashes and other provenance may
// remain in the input, but aren't part of the XML contract we emit.
const argument = Schema.Struct({ type: Schema.String, value: Schema.Unknown });
const attributeSchema = Schema.Struct({
	type: Schema.String,
	constructorArguments: Schema.optionalKey(Schema.Array(argument)),
	namedArguments: Schema.optionalKey(Schema.Record(Schema.String, argument)),
});
const memberSchema = Schema.Struct({
	name: Schema.String,
	type: Schema.String,
	attributes: Schema.optionalKey(Schema.Array(attributeSchema)),
});
const typeSchema = Schema.Struct({
	id: Schema.String,
	kind: Schema.String,
	genericDefinition: Schema.optionalKey(Schema.String),
	genericArguments: Schema.optionalKey(Schema.Array(Schema.String)),
	baseType: Schema.optionalKey(Schema.String),
	isAbstract: Schema.optionalKey(Schema.Boolean),
	customXml: Schema.optionalKey(Schema.Boolean),
	elementType: Schema.optionalKey(Schema.String),
	maxItems: Schema.optionalKey(Schema.Literal(1)),
	attributes: Schema.optionalKey(Schema.Array(attributeSchema)),
	members: Schema.optionalKey(Schema.Array(memberSchema)),
});
const catalogSchema = Schema.Struct({
	formatVersion: Schema.Literal(3),
	types: Schema.Array(typeSchema),
	diagnostics: Schema.Array(Schema.String),
});
// Attribute values remain unknown until interpretation. In particular, a CLR
// enum's numeric value isn't a string, and a System.Type constructor argument
// doesn't supply the XML element's name.
export type CatalogAttribute = typeof attributeSchema.Type;
export type CatalogMember = typeof memberSchema.Type;
export type CatalogType = typeof typeSchema.Type;
export type CatalogTypes = ReadonlyMap<string, CatalogType>;

export function decodeCatalog(input: unknown): CatalogTypes {
	const catalog = Schema.decodeUnknownSync(catalogSchema)(input);
	// Inspection can write a partial catalog after a loader failure. Refuse it:
	// a missing type must not silently narrow the generated save representation.
	if (catalog.diagnostics.length)
		throw new Error(`Catalog is incomplete: ${catalog.diagnostics.join("; ")}`);
	const types = new Map(catalog.types.map((record) => [record.id, record]));
	// A Map would otherwise choose the last duplicate and hide ambiguous input.
	if (types.size !== catalog.types.length)
		throw new Error("Duplicate catalog type IDs");
	return types;
}
