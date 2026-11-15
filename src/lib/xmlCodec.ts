// Legacy save representation codec, wrapped in workers/xml.ts for the old UI.
// The current editor uses its generated typed codec in save-format instead.

import { buildXmlObject, parseXmlObject } from "./xmlObject.ts";

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

// Reuse the slot table across every visited record. Most save records have no
// equipment, so rebuilding seven entry pairs per node only adds traversal cost.
const equipmentSlotTypes = Object.entries(EQUIPMENT_SLOT_TYPES);

// XML containers can be records or arrays. Both expose string-keyed children;
// scalar values must never enter the recursive equipment traversal.
const isContainer = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object";

function injectEquipmentXsiTypes(node: unknown): void {
	if (!isContainer(node)) return;
	const record = node;
	for (const [slot, xsiType] of equipmentSlotTypes) {
		const item = record[slot];
		if (isContainer(item) && !("@_xsi:nil" in item)) {
			const itemRecord = item;
			// Preserve the legacy absence test for empty or missing attributes.
			const hasType = Boolean(itemRecord["@_xsi:type"]);
			if (!hasType) {
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
		} else if (isContainer(value)) {
			injectEquipmentXsiTypes(value);
		}
	}
}

function stripEquipmentXsiTypes(node: unknown): void {
	if (!isContainer(node)) return;
	const record = node;
	for (const [slot, defaultXsiType] of equipmentSlotTypes) {
		const item = record[slot];
		if (isContainer(item)) {
			const itemRecord = item;
			if (itemRecord["@_xsi:type"] === defaultXsiType) {
				delete itemRecord["@_xsi:type"];
			}
		}
	}
	// Recurse into child objects (e.g. farmhands)
	for (const value of Object.values(record)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				stripEquipmentXsiTypes(entry);
			}
		} else if (isContainer(value)) {
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
	if (isContainer(node)) {
		const record = node;
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

export class XMLCodec {
	// Compatibility callers supply the legacy save type; this parser deliberately
	// preserves unknown records rather than validating the current editor's schema.
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Existing callers select their legacy representation explicitly.
	public parse<T>(xml: string) {
		const parsed = parseXmlObject(xml);
		// This legacy API predates schema validation: the caller owns the requested
		// save shape. Whitespace removal preserves that representation's data fields.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Caller-owned legacy representation boundary.
		const pruned = pruneFormattingWhitespace(parsed) as T;
		injectEquipmentXsiTypes(pruned);
		return pruned;
	}

	/**
	 * Build XML UTF-8 bytes (with BOM) and return a Uint8Array. This is safer to
	 * transfer across threads on some mobile browsers than a Blob.
	 */
	public stringify(obj: unknown, pretty = false) {
		// Strip injected xsi:type from equipment slots before serializing,
		// since the game's save format doesn't include them on dedicated slots.
		stripEquipmentXsiTypes(obj);

		const raw = buildXmlObject(obj, pretty);
		const xml = raw.trim().replaceAll("&apos;", "'");
		if (xml.length === 0) throw new Error("Failed to generate XML");

		// Create UTF-8 BOM bytes
		const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
		// Convert XML string to UTF-8 encoded bytes
		const xmlBytes = new TextEncoder().encode(xml);
		// Combine BOM and XML bytes
		const combinedArray = new Uint8Array(bom.length + xmlBytes.length);
		combinedArray.set(bom);
		combinedArray.set(xmlBytes, bom.length);

		return combinedArray;
	}
}
