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
	const equal = (left: unknown, right: unknown): boolean => {
		if (comparison === "ordinalIgnoreCase" || comparison === "statsDictionary")
			return (
				ordinalIgnoreCaseKey(String(left)) ===
				ordinalIgnoreCaseKey(String(right))
			);
		if (comparison != null) {
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
			for (const [index, nestedEntry] of values.entries())
				if (
					values
						.slice(0, index)
						.some((previous) => equal(previous["key"], nestedEntry["key"]))
				)
					return "Duplicate dictionary key";
			return undefined;
		}),
	);
	// Stats dictionaries load duplicates the way the game does, so a save the
	// game opens also opens here. Other dictionaries keep rejecting them.
	const open: Codec["open"] =
		comparison === "statsDictionary"
			? (header) =>
					Effect.map(entries.open(header), (frame) => ({
						...frame,
						// Merge after every entry is read. The document still validates the
						// merged value, so a sum outside the value type's range fails to
						// load, as the game's own conversion does.
						finish: () =>
							Effect.map(frame.finish(), (values) => mergeStats(values, equal)),
					}))
			: entries.open;
	return attach(target, open, (name, nestedValue, attributes) =>
		entries.write(name, nestedValue, attributes),
	);
}

// Mirrors StatsDictionary.AddDuringDeserialization (Stardew 1.6.15). A key that
// matches an earlier one, ignoring case, folds into that entry, which keeps its
// spelling and any extra fields. Values add up, except averageBedtime, where
// the first non-zero value wins. Writing the result back gives the save the
// game itself would write next.
function mergeStats(
	values: unknown,
	equal: (left: unknown, right: unknown) => boolean,
): unknown {
	if (!Array.isArray(values)) return values;
	const merged: Record<string, unknown>[] = [];
	for (const entry of values) {
		const current = record(entry);
		const index = merged.findIndex((previous) =>
			equal(previous["key"], current["key"]),
		);
		const previous = merged[index];
		if (previous === undefined) {
			merged.push(current);
			continue;
		}
		const [sum, incoming] = [previous["value"], current["value"]];
		// The game tests the incoming spelling, ignoring case.
		const bedtime = equal(current["key"], "averageBedtime");
		let value: unknown;
		if (bedtime) value = isZero(sum) ? incoming : sum;
		// Int32 and UInt32 stats decode as numbers, Int64 as bigint.
		else if (typeof sum === "number" && typeof incoming === "number")
			value = sum + incoming;
		else if (typeof sum === "bigint" && typeof incoming === "bigint")
			value = sum + incoming;
		else return values; // Unexpected shape: leave the duplicate to be rejected.
		merged[index] = { ...previous, value };
	}
	return merged;
}

const isZero = (value: unknown) => value === 0 || value === 0n;
