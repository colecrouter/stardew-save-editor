import { Effect, Schema } from "effect";

import {
	accepted,
	attach,
	type Codec,
	type Frame,
	invalid,
	noAttributes,
	record,
	whitespace,
} from "./events.ts";
import {
	type DictionaryKeyComparison,
	keyIdentities,
} from "./key-identities.ts";
import { object } from "./objects.ts";
import { ordinalIgnoreCaseKey } from "./ordinal-ignore-case.ts";
import { scalar, wrapped } from "./values.ts";

function boxed(
	codec: Codec,
	name: string,
	aliases: readonly string[] = [],
): Codec {
	return attach(
		Schema.toType(codec),
		(header) =>
			Effect.gen(function* () {
				yield* noAttributes(header);
				let seen = false,
					value: unknown;
				return {
					text: whitespace,
					child: (child) =>
						Effect.gen(function* () {
							if (
								seen ||
								(child.name !== name && !aliases.includes(child.name))
							)
								return yield* invalid(
									`Expected one dictionary payload ${name}`,
								);
							seen = true;
							// The reviewed legacy integer payload converts to a string through the
							// bounded Int32 codec before joining the current dictionary key domain.
							const legacy = name === "string" && child.name === "int";
							return accepted(
								yield* (legacy ? scalar("System.Int32") : codec).open(child),
								(result) => {
									value = legacy ? String(result) : result;
								},
							);
						}),
					finish: () =>
						!seen
							? invalid(`Missing dictionary payload ${name}`)
							: Effect.succeed(value),
				} satisfies Frame;
			}),
		function* (wrapper, value, attributes) {
			yield { _tag: "StartElement", name: wrapper, attributes };
			yield* codec.write(name, value);
			yield { _tag: "EndElement", name: wrapper };
		},
	);
}
export function dictionary(
	key: Codec,
	keyName: string,
	value: Codec,
	valueName: string,
	comparison?: DictionaryKeyComparison,
): Codec {
	const entry = object({
		key: {
			xmlName: "key",
			codec: boxed(
				key,
				keyName,
				keyName === "string" ? ["int", "LocationContext"] : [],
			),
		},
		value: {
			xmlName: "value",
			codec: boxed(value, valueName, valueName === "string" ? ["int"] : []),
		},
	});
	const entries = wrapped(entry, "item");
	// Keep ordered entries and compare decoded key values using the game's
	// equality policy, independently of their canonical XML representation.
	//
	// Each key reduces to a path of identity parts so seen keys can be indexed
	// rather than compared pairwise. Large saves hold location dictionaries with
	// thousands of entries, and a pairwise scan ran millions of comparisons on
	// every decode, encode and export readback.
	const identityFields =
		comparison != null && comparison !== "ordinalIgnoreCase"
			? Object.keys(keyIdentities[comparison].fields)
			: undefined;
	const identityParts = (keyValue: unknown): readonly unknown[] | undefined => {
		// Case-insensitive string keys compare by their ordinal uppercase form.
		if (comparison === "ordinalIgnoreCase")
			return [ordinalIgnoreCaseKey(String(keyValue))];
		if (identityFields) {
			// Structured keys (Vector2, FarmerPair) are equal when every identity
			// field is strictly equal. NaN never equals itself under ===, so a key
			// containing it cannot duplicate anything and is left out of the index.
			const fields = record(keyValue);
			const parts = identityFields.map((field) => fields[field]);
			return parts.some((part) => Number.isNaN(part)) ? undefined : parts;
		}
		// Plain keys use === except that NaN matches NaN. Map lookup already uses
		// exactly that rule (SameValueZero), so the key is its own identity.
		return [keyValue];
	};
	const target = Schema.toType(entries).check(
		Schema.makeFilter((values) => {
			// Nested maps hold one level per identity part. Map lookup agrees with
			// === for every part value that reaches it, including bigint Int64s.
			const seen = new Map();
			for (const nestedEntry of values) {
				const parts = identityParts(nestedEntry["key"]);
				if (!parts) continue;
				let level = seen;
				for (const [index, part] of parts.entries()) {
					const last = index === parts.length - 1;
					const next = level.get(part);
					// A complete path that already exists is an earlier equal key.
					if (last && next !== undefined) return "Duplicate dictionary key";
					if (last) level.set(part, true);
					else if (next instanceof Map) level = next;
					else {
						const created = new Map();
						level.set(part, created);
						level = created;
					}
				}
			}
			return undefined;
		}),
	);
	return attach(target, entries.open, (name, nestedValue, attributes) =>
		entries.write(name, nestedValue, attributes),
	);
}
