/** Recognize an object-shaped value before inspecting opaque saved extensions or
 * generic review data. Arrays and null are separate representations. */
export const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/** Lookup/display fallbacks treat empty text as absent without trimming nonempty
 * spellings. This derives a value without mutating the underlying saved text. */
export const nonemptyText = (
	value: string | null | undefined,
): string | undefined =>
	value === null || value === undefined || value === "" ? undefined : value;

// Parsed XML consists of plain records, arrays, and primitive values. This
// comparator intentionally does not support class instances, cycles, Maps or Sets.
export function samePlainData(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (
		left === null ||
		right === null ||
		typeof left !== "object" ||
		typeof right !== "object" ||
		Array.isArray(left) !== Array.isArray(right)
	)
		return false;
	// Array capacity is meaningful even for an unsupported sparse input. Record
	// key order is not: patch replay may insert identical members in another order.
	if (
		Array.isArray(left) &&
		Array.isArray(right) &&
		left.length !== right.length
	)
		return false;
	// Reflection reads remain unknown until recursive comparison establishes their
	// representation; arrays can also carry enumerable extension properties.
	const read = (value: object, key: string): unknown => Reflect.get(value, key);
	const keys = Object.keys(left);
	return (
		keys.length === Object.keys(right).length &&
		keys.every(
			(key) =>
				Object.hasOwn(right, key) &&
				samePlainData(read(left, key), read(right, key)),
		)
	);
}
