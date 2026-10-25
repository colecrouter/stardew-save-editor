import { readFile } from "node:fs/promises";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { arrayTags, nestedArrayTags } from "../../src/lib/workers/jank";
import type { Mutation, SaveDocument } from "./domain";

// Reuse production array recognition. Export roundtrips below test parsed-data
// preservation, not byte identity or the production worker/download path.
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	trimValues: false,
	numberParseOptions: { hex: false, leadingZeros: false, eNotation: false },
	isArray: (tag, path) =>
		arrayTags.has(tag) ||
		[...(nestedArrayTags.get(tag) ?? [])].some((parent) =>
			path.toString().endsWith(`.${parent}.${tag}`),
		),
});
function prune(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(prune);
	if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node)) {
			if (key === "#text" && typeof value === "string" && !value.trim())
				delete (node as Record<string, unknown>)[key];
			else (node as Record<string, unknown>)[key] = prune(value);
		}
	}
	return node;
}
export const parser = {
	parse: (xml: string) =>
		prune(xmlParser.parse(xml.replace(/^\uFEFF/, ""))) as SaveDocument,
};
export const builder = new XMLBuilder({
	ignoreAttributes: false,
	suppressBooleanAttributes: false,
});
export const exportDocument = (document: SaveDocument) =>
	builder.build(document) as string;

export async function loadFixture(): Promise<SaveDocument> {
	const xml = await readFile(
		new URL("../../tests/TestSave", import.meta.url),
		"utf8",
	);
	return parser.parse(xml) as SaveDocument;
}

export function tinyFixture(): SaveDocument {
	return {
		SaveGame: {
			player: {
				UniqueMultiplayerID: "host",
				name: "Host",
				farmName: "Farm",
				money: 10,
				items: {
					Item: [
						{ itemId: "388", modData: { opaque: "007" } },
						{ "@_xsi:nil": "true" },
						{ name: "Secret Note #1" },
					],
				},
			},
			farmhands: {
				Farmer: [
					{
						UniqueMultiplayerID: "guest",
						name: "Guest",
						farmName: "Farm",
						money: 20,
						items: { Item: [] },
					},
				],
			},
		},
	};
}
export function scenarios(document: SaveDocument): Mutation[] {
	const farmer = document.SaveGame.player;
	return [
		{
			type: "money",
			farmerId: String(farmer.UniqueMultiplayerID),
			value: 12345,
		},
		{ type: "farm-name", value: "Experiment Farm" },
		{
			type: "reorder",
			farmerId: String(farmer.UniqueMultiplayerID),
			order: farmer.items.Item.map((_, i, all) => all.length - 1 - i),
		},
	];
}
