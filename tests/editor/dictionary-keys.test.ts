import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { dictionary } from "../../src/lib/save-format/dictionary.ts";
import { object } from "../../src/lib/save-format/objects.ts";
import { scalar } from "../../src/lib/save-format/values.ts";

// The duplicate-key check indexes each key by its identity parts. These cases
// pin the game's equality rules for each comparison kind, so that a change to
// the index walk cannot reject distinct keys or accept real duplicates.

// A decoded dictionary is an ordered list of key/value entries.
const entries = (keys: readonly unknown[]) =>
	keys.map((key) => ({ key, value: "payload" }));
// Validating the in-memory value runs the type checks and the duplicate filter.
const accepts = (codec: Schema.Codec<unknown>, keys: readonly unknown[]) =>
	expect(() => Schema.decodeSync(codec)(entries(keys))).not.toThrow();
const rejects = (codec: Schema.Codec<unknown>, keys: readonly unknown[]) =>
	expect(() => Schema.decodeSync(codec)(entries(keys))).toThrow(
		"Duplicate dictionary key",
	);

const value = scalar("System.String");

describe("Vector2 keys", () => {
	const vector = object({
		X: { xmlName: "X", codec: scalar("System.Single") },
		Y: { xmlName: "Y", codec: scalar("System.Single") },
	});
	const codec = dictionary(
		vector,
		"Vector2",
		value,
		"string",
		"Microsoft.Xna.Framework.Vector2",
	);

	it("accepts keys that share only the first field", () => {
		// (1,2) and (1,3) share an index level for X but differ at the leaf.
		accepts(codec, [
			{ X: 1, Y: 2 },
			{ X: 1, Y: 3 },
		]);
	});

	it("rejects a repeated key", () => {
		rejects(codec, [
			{ X: 1, Y: 2 },
			{ X: 5, Y: 5 },
			{ X: 1, Y: 2 },
		]);
	});

	it("treats both signs of zero as the same field value", () => {
		// Field comparison uses ===, under which -0 equals +0.
		rejects(codec, [
			{ X: 0, Y: 1 },
			{ X: -0, Y: 1 },
		]);
	});

	it("never treats keys containing NaN as duplicates", () => {
		// NaN fields never compare equal under ===, so these keys stay distinct.
		accepts(codec, [
			{ X: Number.NaN, Y: 1 },
			{ X: Number.NaN, Y: 1 },
			{ X: 1, Y: Number.NaN },
			{ X: 1, Y: Number.NaN },
		]);
	});
});

describe("FarmerPair keys", () => {
	const pair = object({
		Farmer1: { xmlName: "Farmer1", codec: scalar("System.Int64") },
		Farmer2: { xmlName: "Farmer2", codec: scalar("System.Int64") },
	});
	const codec = dictionary(
		pair,
		"FarmerPair",
		value,
		"string",
		"StardewValley.FarmerPair",
	);

	it("accepts distinct pairs and rejects a repeated pair", () => {
		accepts(codec, [
			{ Farmer1: 1n, Farmer2: 2n },
			{ Farmer1: 2n, Farmer2: 1n },
		]);
		// Int64 fields are bigints, which compare by value rather than identity.
		rejects(codec, [
			{ Farmer1: 1n, Farmer2: 2n },
			{ Farmer1: 1n, Farmer2: 2n },
		]);
	});
});

describe("case-insensitive string keys", () => {
	const codec = dictionary(
		scalar("System.String"),
		"string",
		value,
		"string",
		"ordinalIgnoreCase",
	);

	it("rejects keys that differ only by case", () => {
		rejects(codec, ["Abc", "ABC"]);
	});

	it("accepts keys that differ in more than case", () => {
		accepts(codec, ["Abc", "Abd"]);
	});
});

describe("plain keys", () => {
	it("rejects repeated string keys and accepts distinct ones", () => {
		const codec = dictionary(
			scalar("System.String"),
			"string",
			value,
			"string",
		);
		accepts(codec, ["a", "A", "b"]);
		rejects(codec, ["a", "b", "a"]);
	});

	it("treats NaN as equal to NaN", () => {
		// Plain keys follow .NET Equals, where NaN equals itself.
		const codec = dictionary(scalar("System.Single"), "float", value, "string");
		rejects(codec, [Number.NaN, Number.NaN]);
	});

	it("compares Int64 keys by value", () => {
		const codec = dictionary(scalar("System.Int64"), "long", value, "string");
		accepts(codec, [1n, 2n]);
		rejects(codec, [1n, 2n, 1n]);
	});
});
