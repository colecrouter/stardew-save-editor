import { ordinalCaseRanges } from "./ordinal-case-table.ts";

// This identity is only for key comparison. Never replace a saved key with it:
// its original casing and Unicode normalization remain part of the saved key.
export function ordinalIgnoreCaseKey(text: string): string {
	let result = "";
	// Iterate Unicode scalars so supplementary alphabets case as a single unit.
	// Isolated UTF-16 surrogates have no table entry and remain unchanged.
	for (const character of text) {
		const codePoint = character.codePointAt(0);
		if (codePoint === undefined)
			throw new Error("Expected a Unicode character");
		let low = 0;
		let high = ordinalCaseRanges.length - 1;
		let mapped = codePoint;
		// Locate the only possible containing range. A stride-two gap represents
		// an already-uppercase character, so it must not receive the lowercase delta.
		while (low <= high) {
			const middle = (low + high) >>> 1;
			const range = ordinalCaseRanges[middle];
			if (!range) throw new Error("Invalid ordinal casing range index");
			const [first, last, stride, delta] = range;
			if (codePoint < first) high = middle - 1;
			else if (codePoint > last) low = middle + 1;
			else {
				if ((codePoint - first) % stride === 0) mapped += delta;
				break;
			}
		}
		result += String.fromCodePoint(mapped);
	}
	return result;
}
