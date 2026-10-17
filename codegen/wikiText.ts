/** Strip wiki markup from a line of article text */
export function wikiToText(text: string) {
	// Keep the text of templates that carry some: {{Price|40000}} reads "40,000g"
	let out = text.replace(
		/\{\{[Pp]rice\|([\d,]+)\}\}/g,
		(_, price: string) =>
			`${Number(price.replaceAll(",", "")).toLocaleString("en-US")}g`,
	);
	// Drop templates, innermost first so nested ones collapse
	for (let prev = ""; prev !== out; ) {
		prev = out;
		out = out.replace(/\{\{[^{}]*\}\}/g, "");
	}
	// Drop footnotes, then any other HTML tags until none are left
	out = out
		.replace(/<ref[^>]*\/>/g, "")
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
	for (let prev = ""; prev !== out; ) {
		prev = out;
		out = out.replace(/<[^<>]*>/g, "");
	}
	return out
		.replace(/[<>]/g, "")
		.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
		.replace(/'{2,}/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
