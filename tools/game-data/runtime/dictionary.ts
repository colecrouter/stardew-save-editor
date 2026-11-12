import { Effect, Schema } from "effect";
import { keyIdentities } from "./key-identities.ts";
import type { DictionaryKeyComparison } from "./key-identities.ts";
import { ordinalIgnoreCaseKey } from "./ordinal-ignore-case.ts";
import { object } from "./objects.ts";
import { scalar, wrapped } from "./values.ts";
import {
	accepted,
	attach,
	noAttributes,
	record,
	whitespace,
	invalid,
} from "./events.ts";
import type { Codec, Frame } from "./events.ts";

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
			yield* codec.events(name, value);
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
	const equal = (left: unknown, right: unknown): boolean => {
		if (comparison === "ordinalIgnoreCase")
			return (
				ordinalIgnoreCaseKey(String(left)) ===
				ordinalIgnoreCaseKey(String(right))
			);
		if (comparison) {
			const a = record(left),
				b = record(right);
			return Object.keys(keyIdentities[comparison].fields).every(
				(field) => a[field] === b[field],
			);
		}
		return (
			left === right ||
			(typeof left === "number" &&
				typeof right === "number" &&
				Number.isNaN(left) &&
				Number.isNaN(right))
		);
	};
	const target = Schema.toType(entries).check(
		Schema.makeFilter((values) => {
			for (const [index, entry] of values.entries())
				if (
					values
						.slice(0, index)
						.some((previous) => equal(previous.key, entry.key))
				)
					return "Duplicate dictionary key";
			return undefined;
		}),
	);
	return attach(target, entries.open, (name, value, attributes) =>
		entries.events(name, value, attributes),
	);
}
