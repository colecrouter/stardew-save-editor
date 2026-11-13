import { Schema, SchemaTransformation } from "effect";

export function nullableEnumText<const Labels extends readonly string[]>(
	labels: Labels,
) {
	// NetNullableEnum.Add(string) treats empty text as no value. Absence is handled
	// separately by its collection binding: [] and [null] retain their XML presence.
	// Named labels still go through the enum schema, so unknown text is rejected.
	return Schema.String.pipe(
		Schema.decodeTo(
			Schema.NullOr(Schema.Literals(labels)),
			SchemaTransformation.transform({
				decode: (text) => (text === "" ? null : text),
				encode: (value) => value ?? "",
			}),
		),
	);
}
