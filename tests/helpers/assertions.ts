import { expect } from "vitest";

/** Establish a fixture or query precondition before the test uses its value. */
export function requireDefined<T>(value: T): NonNullable<T> {
	// A missing fixture entry should fail at its lookup rather than producing an
	// unrelated property-access error later in the scenario.
	expect.assert(
		value != null,
		"Expected the test fixture or query value to exist",
	);
	return value;
}

/** Require an addressable saved slot while preserving null as an empty item. */
export function requireStoredSlot<T>(value: T | undefined): T {
	// Null is meaningful serialized inventory data, so it must survive expected
	// swaps. Only an absent array entry signals a broken fixture address here.
	expect.assert(
		value !== undefined,
		"Expected an addressable saved inventory slot",
	);
	return value;
}

/** Verify the actual DOM element kind instead of trusting a query type cast. */
export function requireInstance<T extends object>(
	value: unknown,
	constructor: abstract new (...args: never[]) => T,
): T {
	// Role/text queries return general elements; this assertion checks that the
	// rendered control supplies the specialized browser API used by the test.
	expect.assert(value instanceof constructor, `Expected ${constructor.name}`);
	return value;
}

// Legacy scenarios construct only the serialized fields relevant to their
// behavior. Check every supplied field while allowing unrelated save defaults
// to remain absent; this is a fixture-building contract, not a production decoder.
type FixtureFields<T> = T extends readonly (infer Element)[]
	? FixtureFields<Element>[]
	: T extends object
		? { [Key in keyof T]?: FixtureFields<T[Key]> }
		: T;

/** Build an intentionally incomplete saved record with checked supplied fields. */
export function partialFixture<T>(value: FixtureFields<T>): T {
	// The scenario deliberately owns the omitted fields; callers must not use this
	// helper to claim that arbitrary external data passed the save decoder.
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Test fixtures deliberately omit unrelated serialized defaults.
	return value as T;
}

/** Check a raw fixture's object representation before inspecting unknown fields. */
export function requireRecord(value: unknown): Record<string, unknown> {
	// Unknown extension fields stay unknown. The guard establishes only that the
	// value supports property inspection; each nested representation needs its own check.
	const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
		typeof candidate === "object" &&
		candidate !== null &&
		!Array.isArray(candidate);
	expect.assert(isRecord(value), "Expected a saved object representation");
	return value;
}

/** Require the array representation before inspecting raw serialized entries. */
export function requireArray(value: unknown): unknown[] {
	expect.assert(Array.isArray(value), "Expected a saved array representation");
	return value;
}

/** Establish that a serialized or optional numeric fixture value is a number. */
export function requireNumber(value: unknown): number {
	expect.assert(typeof value === "number", "Expected a numeric fixture value");
	return value;
}

/** Exercise JSON serialization of a known plain-data fixture, preserving its type. */
export function jsonRoundTrip<T>(value: T): T {
	// Callers supply already typed JSON-compatible fixture data. This helper is
	// deliberately not an untrusted JSON decoder: its purpose is to exercise the
	// storage representation (including omission of undefined fields) in tests.
	const restored: unknown = JSON.parse(JSON.stringify(value));
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The JSON source is the caller's known plain-data fixture.
	return restored as T;
}
