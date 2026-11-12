import type { XmlElement } from "../runtime/xml-tree.ts";
import { Schema } from "effect";
import type { CatalogTypes } from "../compiler/catalog.ts";
import { scalarTypes } from "./scalars.ts";
import type { ScalarType } from "./scalars.ts";
import { ordinalIgnoreCaseKey } from "./ordinal-ignore-case.ts";

function identity<const Fields extends Readonly<Record<string, ScalarType>>>(
	fields: Fields,
) {
	// This schema is a projection of the decoded key envelope, not its XML codec.
	// Schema decoding drops provenance and any fields outside the reviewed identity.
	// Object.fromEntries loses the field-to-scalar association; the mapped codec
	// assertion restores exactly the pairs supplied above, all with no services.
	const payload = Schema.Struct(
		Object.fromEntries(
			Object.entries(fields).map(([name, type]) => [
				name,
				Schema.toType(scalarTypes[type].codec),
			]),
		) as unknown as {
			[K in keyof Fields]: Schema.Codec<
				(typeof scalarTypes)[Fields[K]]["codec"]["Type"]
			>;
		},
	);
	return { fields, schema: Schema.Struct({ value: payload }) };
}

const vector2Identity = identity({ X: "System.Single", Y: "System.Single" });

// Equality is a CLR behavior rather than serialization metadata. Register only
// reviewed identities: FarmerPair.Equals compares these two Int64 fields in order.
// MakePair sorts new pairs, but deserialization/equality do not normalize them.
export const keyIdentities = {
	"StardewValley.FarmerPair": identity({
		Farmer1: "System.Int64",
		Farmer2: "System.Int64",
	}),
	"Microsoft.Xna.Framework.Vector2": {
		...vector2Identity,
		schema: vector2Identity.schema.pipe(
			Schema.overrideToEquivalence(
				() =>
					// MonoGame Vector2.Equals uses component-wise float ==: signed zeros are
					// equal, infinities compare normally, and NaN is unequal even to itself.
					// Keep this a raw comparison; Equivalence.make's reference shortcut would
					// incorrectly equate a reused NaN-containing key envelope.
					(left, right) =>
						left.value.X === right.value.X && left.value.Y === right.value.Y,
			),
		),
	},
} as const;
export type KeyIdentity = keyof typeof keyIdentities;
// Comparer policies are independent of key representation: this string policy
// must not make a scalar key use the structured-key XML builder.
export type DictionaryKeyComparison = KeyIdentity | "ordinalIgnoreCase";

export function resolveKeyIdentity(
	types: CatalogTypes,
	id: string,
	path: string,
): KeyIdentity {
	if (!Object.hasOwn(keyIdentities, id))
		throw new Error(
			`${path}: dictionary object key requires a registered identity (${id})`,
		);
	const key = id as KeyIdentity;
	const record = types.get(id);
	const fields: Readonly<Record<string, ScalarType>> =
		keyIdentities[key].fields;
	// The reviewed struct has exactly this shape. Fail if a future game version
	// changes it; extra serialized fields must not silently escape equality review.
	if (
		record?.baseType !== "System.ValueType" ||
		record.isAbstract ||
		record.members?.length !== Object.keys(fields).length ||
		record.members.some(
			(member) =>
				!Object.hasOwn(fields, member.name) ||
				fields[member.name as keyof typeof fields] !== member.type,
		)
	)
		throw new Error(`${path}: registered key identity no longer matches ${id}`);
	return key;
}

export function keyComparisonSchema<K>(
	codec: Schema.Codec<K, string | XmlElement>,
	id: DictionaryKeyComparison,
): Schema.Codec<K> {
	if (id === "ordinalIgnoreCase") {
		const read = Schema.decodeUnknownSync(Schema.String);
		// This separate view only changes duplicate detection. Keep the actual key
		// codec case-sensitive so editing a key's saved spelling still writes XML.
		return Schema.toType(codec).pipe(
			Schema.overrideToEquivalence(
				() => (left, right) =>
					ordinalIgnoreCaseKey(read(left)) ===
					ordinalIgnoreCaseKey(read(right)),
			),
		);
	}
	if (!Object.hasOwn(keyIdentities, id))
		throw new Error(`Unknown dictionary key identity ${id}`);
	const projection: Schema.Codec<unknown> = keyIdentities[id].schema;
	const project = Schema.decodeUnknownSync(projection);
	const equal = Schema.toEquivalence(projection);
	// Override only a separate decoded-schema view. Using this override on codec
	// itself would also hide XML-only edits from the normal preservation comparison.
	return Schema.toType(codec).pipe(
		Schema.overrideToEquivalence(
			() => (left, right) => equal(project(left), project(right)),
		),
	);
}
