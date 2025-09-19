export function normalizeXml(input: string) {
	// Strip BOM
	const noBom = input.replace(/^\uFEFF/, "");
	// Normalize EOLs to LF and normalize self-closing spacing
	return noBom
		.replace(/\r\n?|\n/g, "\n")
		.replace(/\s*\/>/g, " />")
		.trim();
}

function firstDiffIndex(a: string, b: string): number {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++)
		if (a.charCodeAt(i) !== b.charCodeAt(i)) return i;
	return a.length === b.length ? -1 : len;
}

/**
 * Assert two XML strings are equal after normalization. On mismatch, throw a concise
 * multi-line error that includes hashes, lengths, and a snippet around the first diff.
 */
export function assertXmlEqual(original: string, exported: string) {
	const a = normalizeXml(original);
	const b = normalizeXml(exported);
	if (a === b) return;
	const idx = firstDiffIndex(a, b);
	const start = Math.max(0, idx - 80);
	const end = Math.min(Math.max(a.length, b.length), idx + 80);
	const aroundA = a.slice(start, end);
	const aroundB = b.slice(start, end);
	const msg = [
		"Import/Export XML mismatch",
		`lengths orig=${a.length} exp=${b.length}`,
		idx >= 0 ? `firstDiff@${idx}` : "",
		"-- original around diff --",
		aroundA,
		"-- exported around diff --",
		aroundB,
	]
		.filter(Boolean)
		.join("\n");
	throw new Error(msg);
}
