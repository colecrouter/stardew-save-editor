/**
 * Validate a newly typed event ID without changing imported saved values.
 *
 * Event keys use "/" to separate preconditions, whose ID arguments are separated
 * by whitespace. Neither delimiter can be part of an event ID. For new input we
 * retain v1's conservative plain-number policy: drop unsigned leading zeros and
 * reject alternative finite numeric spellings such as "1e3" or "1.0". This is
 * deliberately stricter than the current codec, which preserves some such text.
 * Boolean literals are rejected because the codec converts them to booleans.
 * Unsafe integers are also excluded conservatively, so IDs never depend on
 * precision-losing numeric conversion even when this codec preserves their text.
 */
export function toEventId(input: string): string | undefined {
	const id = input.trim().replace(/^0+(?=\d+$)/, "");
	if (!/^[^\s/]+$/.test(id) || id === "true" || id === "false")
		return undefined;
	const number = Number(id);
	// Integer values must remain exact when the XML codec reads numeric text.
	if (Number.isInteger(number) && !Number.isSafeInteger(number))
		return undefined;
	return Number.isFinite(number) && String(number) !== id ? undefined : id;
}
