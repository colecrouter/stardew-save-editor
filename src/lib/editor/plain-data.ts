// Parsed XML consists of plain records, arrays, and primitive values. This
// comparator intentionally does not support class instances, cycles, Maps or Sets.
export function samePlainData(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (
		!left ||
		!right ||
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
	const a = left as Record<string, unknown>;
	const b = right as Record<string, unknown>;
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && samePlainData(a[key], b[key]))
	);
}
