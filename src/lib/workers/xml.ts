/*
    The purpose of this worker is to improve performance by extracting the XML parsing
    from the main thread. This also has the benefit of making it "async", which lets us create
    a loading screen while the XML is being parsed.

    Apparently this is an issue on some of the devices users are using (mainly mobile devices).
*/

import * as Comlink from "comlink";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { arrayTags, nestedArrayTags } from "./jank";

// Equipment slots in the Stardew Valley save file don't include xsi:type because the
// C# deserializer knows the type from the field declaration. We inject the correct
// xsi:type during parsing so our proxy factory can create the right proxy class,
// and strip it back out during serialization to match the original format.
const EQUIPMENT_SLOT_TYPES: Record<string, string> = {
	hat: "Hat",
	shirtItem: "Clothing",
	pantsItem: "Clothing",
	boots: "Boots",
	leftRing: "Ring",
	rightRing: "Ring",
	trinketItem: "Trinket",
};

function injectEquipmentXsiTypes(node: unknown): void {
	if (typeof node !== "object" || node === null) return;
	const record = node as Record<string, unknown>;
	for (const [slot, xsiType] of Object.entries(EQUIPMENT_SLOT_TYPES)) {
		const item = record[slot];
		if (
			item &&
			typeof item === "object" &&
			!("@_xsi:nil" in (item as Record<string, unknown>))
		) {
			const itemRecord = item as Record<string, unknown>;
			if (!itemRecord["@_xsi:type"]) {
				itemRecord["@_xsi:type"] = xsiType;
			}
		}
	}
	// Recurse into child objects (e.g. farmhands)
	for (const value of Object.values(record)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				injectEquipmentXsiTypes(entry);
			}
		} else if (value && typeof value === "object") {
			injectEquipmentXsiTypes(value);
		}
	}
}

function stripEquipmentXsiTypes(node: unknown): void {
	if (typeof node !== "object" || node === null) return;
	const record = node as Record<string, unknown>;
	for (const slot of Object.keys(EQUIPMENT_SLOT_TYPES)) {
		const item = record[slot];
		if (item && typeof item === "object") {
			const itemRecord = item as Record<string, unknown>;
			delete itemRecord["@_xsi:type"];
		}
	}
	// Recurse into child objects (e.g. farmhands)
	for (const value of Object.values(record)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				stripEquipmentXsiTypes(entry);
			}
		} else if (value && typeof value === "object") {
			stripEquipmentXsiTypes(value);
		}
	}
}

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
		const pruned = pruneFormattingWhitespace(parsed) as T;
		injectEquipmentXsiTypes(pruned);
		return pruned;
	}

	/**
	 * Build XML UTF-8 bytes (with BOM) and return a Uint8Array. This is safer to
	 * transfer across threads on some mobile browsers than a Blob.
	 */
	public stringify<T>(obj: T, pretty = false) {
		// Strip injected xsi:type from equipment slots before serializing,
		// since the game's save format doesn't include them on dedicated slots.
		stripEquipmentXsiTypes(obj);

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
