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
	function visit(value: unknown): boolean {
		if (
			value === null ||
			["boolean", "number", "bigint", "string"].includes(typeof value)
		)
			return true;
		if (typeof value !== "object" || active.has(value)) return false;
		if (
			!Array.isArray(value) &&
			Object.getPrototypeOf(value) !== Object.prototype &&
			Object.getPrototypeOf(value) !== null
		)
			return false;
		active.add(value);
		const valid = Array.isArray(value)
			? value.length === Object.keys(value).length && value.every(visit)
			: Object.values(value).every(visit);
		active.delete(value);
		return valid;
	}
	return visit(value);
}
// Effect's pinned patch implementation compares scalar leaves with Object.is
// and never JSON-stringifies their values. Its public type is narrower than the
// cloneable saved-value domain; contain that assertion at this tested boundary.
export const patchValue = (value: unknown) => value as Schema.Json;
export function savedBytes(value: unknown): number {
	return new TextEncoder().encode(stringifySavedData(value)).byteLength;
}

/** Diagnostic text supports exact integers; it is not used as a save encoding. */
export function stringifySavedData(value: unknown, space?: number): string {
	return (
		JSON.stringify(
			value,
			(_, entry) =>
				typeof entry === "bigint"
					? `${entry}n`
					: typeof entry === "number" && !Number.isFinite(entry)
						? String(entry)
						: entry,
			space,
		) ?? "undefined"
	);
}
