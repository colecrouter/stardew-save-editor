import type { Schema } from "effect";

export type SavedValue =
	| null
	| boolean
	| number
	| bigint
	| string
	| SavedValue[]
	| { [key: string]: SavedValue };
// Save values include CLR Int64 and floating-point special values. They remain
// ordinary cloneable records; class instances, cycles and sparse arrays are invalid.
export function isSavedData(value: unknown): boolean {
	const active = new Set<object>();
	function visit(nextValue: unknown): boolean {
		if (
			nextValue === null ||
			["boolean", "number", "bigint", "string"].includes(typeof nextValue)
		)
			return true;
		if (typeof nextValue !== "object" || active.has(nextValue)) return false;
		if (
			!Array.isArray(nextValue) &&
			Object.getPrototypeOf(nextValue) !== Object.prototype &&
			Object.getPrototypeOf(nextValue) !== null
		)
			return false;
		active.add(nextValue);
		const valid = Array.isArray(nextValue)
			? nextValue.length === Object.keys(nextValue).length &&
				nextValue.every(visit)
			: Object.values(nextValue).every(visit);
		active.delete(nextValue);
		return valid;
	}
	return visit(value);
}
// Effect's pinned patch implementation compares scalar leaves with Object.is
// and never JSON-stringifies their values. Its public type is narrower than the
// cloneable saved-value domain; contain that assertion at this tested boundary.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Effect patches support the tested saved scalar domain, including bigint and non-finite floats, despite Json being narrower.
export const patchValue = (value: unknown) => value as Schema.Json;
export function savedBytes(value: unknown): number {
	return new TextEncoder().encode(stringifySavedData(value)).byteLength;
}

/** Diagnostic text supports exact integers; it is not used as a save encoding. */
export function stringifySavedData(value: unknown, space?: number): string {
	return (
		JSON.stringify(
			value,
			(_, entry: unknown) =>
				typeof entry === "bigint"
					? `${entry}n`
					: typeof entry === "number" && !Number.isFinite(entry)
						? String(entry)
						: entry,
			space,
		) ?? "undefined"
	);
}
