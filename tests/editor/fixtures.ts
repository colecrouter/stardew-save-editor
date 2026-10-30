import fixtureXml from "../TestSave?raw";
export { fixtureXml };
import { XMLCodec } from "../../src/lib/xmlCodec.ts";
import type {
	ResolvedMutation,
	SaveDocument,
} from "../../src/lib/editor/domain.ts";

// Use the production codec, including equipment types and XML normalization.
const codec = new XMLCodec();
export const parser = {
	parse: (xml: string) => codec.parse<SaveDocument>(xml.replace(/^\uFEFF/, "")),
};
export const exportDocument = (document: SaveDocument) =>
	new TextDecoder().decode(codec.stringify(structuredClone(document)));

export async function loadFixture(): Promise<SaveDocument> {
	return parser.parse(fixtureXml);
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
export function scenarios(document: SaveDocument): ResolvedMutation[] {
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
			ownerId: String(farmer.UniqueMultiplayerID),
			order: farmer.items.Item.map((_, i, all) => all.length - 1 - i),
		},
	];
}
