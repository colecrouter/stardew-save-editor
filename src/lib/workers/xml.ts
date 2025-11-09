/*
    The purpose of this worker is to improve performance by extracting the XML parsing
    from the main thread. This also has the benefit of making it "async", which lets us create
    a loading screen while the XML is being parsed.

    Apparently this is an issue on some of the devices users are using (mainly mobile devices).
*/

import * as Comlink from "comlink";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { arrayTags, nestedArrayTags } from "./jank";

// Detects whitespace nodes that exist purely for indentation/pretty-printing.
const isFormattingWhitespace = (value: unknown): value is string =>
	typeof value === "string" &&
	value.trim().length === 0 &&
	(value.includes("\n") || value.includes("\r"));

const pruneFormattingWhitespace = (node: unknown): unknown => {
	if (isFormattingWhitespace(node)) return undefined;
	if (Array.isArray(node)) {
		// Filter out formatting-only entries while preserving real data.
		const next = node
			.map((item) => pruneFormattingWhitespace(item))
			.filter((item) => item !== undefined);
		return next;
	}
	if (node && typeof node === "object") {
		const record = node as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			// Recurse into nested structures so indentation nodes never leak through.
			const cleaned = pruneFormattingWhitespace(record[key]);
			if (cleaned === undefined) {
				delete record[key];
			} else {
				record[key] = cleaned;
			}
		}
	}
	return node;
};

export class XMLManager {
	private parser = new XMLParser({
		ignoreAttributes: false,
		allowBooleanAttributes: true,
		// Defaults to `true`, but we want to preserve whitespace for user-generated strings
		trimValues: false,
		isArray: (tagName, jPath) => {
			if (arrayTags.has(tagName)) return true;

			// Check if the tag is a nested array tag
			const nestedTags = nestedArrayTags.get(tagName);
			if (!nestedTags) return false;

			// Check if the jPath ends with any of the nested tags
			for (const nestedTag of nestedTags) {
				if (jPath.endsWith(`.${nestedTag}.${tagName}`)) {
					// console.debug(
					// 	`Converted "${tagName}" to an array because it is nested under "${nestedTag}"`,
					// );
					return true;
				}
			}

			return false;
		},
	});

	public parse<T>(xml: string) {
		const parsed = this.parser.parse(xml) as T;
		return pruneFormattingWhitespace(parsed) as T;
	}

	/**
	 * Build XML UTF-8 bytes (with BOM) and return a Uint8Array. This is safer to
	 * transfer across threads on some mobile browsers than a Blob.
	 */
	public stringify<T>(obj: T, pretty = false) {
		const builder = new XMLBuilder({
			attributeNamePrefix: "@_",
			ignoreAttributes: false,
			suppressUnpairedNode: false,
			suppressEmptyNode: true,
			suppressBooleanAttributes: false,
			format: pretty,
			indentBy: "    ",
		});
		const raw = builder.build(obj) as string;
		const xml = raw.trim().replaceAll("&apos;", "'").replaceAll("/>", " />");
		if (!xml) throw new Error("Failed to generate XML");

		// Create UTF-8 BOM bytes
		const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
		// Convert XML string to UTF-8 encoded bytes
		const xmlBytes = new TextEncoder().encode(xml);
		// Combine BOM and XML bytes
		const combinedArray = new Uint8Array(bom.length + xmlBytes.length);
		combinedArray.set(bom);
		combinedArray.set(xmlBytes, bom.length);

		try {
			// Prefer transferring the underlying buffer when used via Comlink.
			return Comlink.transfer(combinedArray, [combinedArray.buffer]);
		} catch {
			return combinedArray;
		}
	}
}

Comlink.expose(XMLManager);
