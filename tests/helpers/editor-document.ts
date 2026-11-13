import { isHostFarmer } from "../../src/lib/editor/domain.ts";
import { Schema } from "effect";
import { getFixtureBaseline } from "./fixture-context.ts";
import {
	XmlSchema,
	type Value,
	type T_StardewValley_Farmer,
	type T_StardewValley_GameLocation,
} from "../../generated/save-format/save.ts";
import type {
	ResolvedMutation,
	Item,
	HostFarmer,
	SaveDocument,
} from "../../src/lib/editor/domain.ts";

// Use the production codec, including equipment types and XML normalization.

// Vitest provides the public baseline decoded once for the run. Standalone Node
// callers and modified XML use a small local cache; every caller gets a clone.
const parsedFixtures = new Map<string, SaveDocument>();
export const parser = {
	parse(xml: string): SaveDocument {
		// Vite's raw loader retains the BOM while TextDecoder removes it. Both
		// entry paths must address the same prepared baseline and codec input.
		if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
		const cached = getFixtureBaseline(xml) ?? parsedFixtures.get(xml);
		if (cached) return structuredClone(cached);
		const saved = Schema.decodeSync(XmlSchema)(xml);
		const { player, farmhands } = saved;
		// Real-save fixtures must meet the same editor envelope as production imports.
		if (!player || !isHostFarmer(player) || !Array.isArray(farmhands))
			throw Error("Invalid editor fixture envelope");
		const document: SaveDocument = {
			SaveGame: { ...saved, player, farmhands },
		};
		// Bound fixture retention while keeping each test's mutable document isolated.
		parsedFixtures.set(xml, structuredClone(document));
		if (parsedFixtures.size > 4) {
			const oldest = parsedFixtures.keys().next().value;
			if (oldest !== undefined) parsedFixtures.delete(oldest);
		}
		return document;
	},
};
export const exportDocument = (document: SaveDocument) =>
	Schema.encodeSync(XmlSchema)(document.SaveGame);

// The tiny fixture deliberately populates both farmers and their inventories.
export type TinyDocument = SaveDocument & {
	SaveGame: { farmhands: HostFarmer[] };
};
export function tinyFixture(): TinyDocument {
	return {
		SaveGame: {
			player: {
				UniqueMultiplayerID: 1n,
				$type: "StardewValley.Farmer",
				name: "Host",
				farmName: "Farm",
				money: 10,
				items: [
					{ $type: "StardewValley.Object", itemId: "388", modData: [] },
					null,
					{ $type: "StardewValley.Object", name: "Secret Note #1" },
				],
			},
			farmhands: [
				{
					UniqueMultiplayerID: 2n,
					$type: "StardewValley.Farmer",
					name: "Guest",
					farmName: "Farm",
					money: 20,
					items: [],
				},
			],
		},
	};
}

/** Minimal model fixture: the full editor also projects a calendar and world seed.
 * Domain-only tests can keep using tinyFixture without unrelated world defaults. */
export function tinyEditorFixture(): TinyDocument {
	const document = tinyFixture();
	Object.assign(document.SaveGame, {
		gameVersion: "1.6.8",
		year: 1,
		currentSeason: "spring",
		dayOfMonth: 1,
		uniqueIDForThisGame: 1n,
	});
	// Export validation requires both base locations even when a UI scenario
	// does not edit the world. Keep their contents empty and explicit.
	document.SaveGame.locations = [
		{ $type: "StardewValley.Farm", name: "Farm" },
		{ $type: "StardewValley.Locations.FarmHouse", name: "FarmHouse" },
	];
	return document;
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
			order: farmer.items.map((_, i, all) => all.length - 1 - i),
		},
	];
}

// Full-save integration assertions can rely on the public fixture's populated roots.
type KnownProperties<T> = {
	[
		K in keyof T as string extends K ? never : number extends K ? never : K
	]: T[K];
};
export type FixtureSave = Omit<
	KnownProperties<Value>,
	"player" | "locations" | "farmhands"
> & {
	player: T_StardewValley_Farmer;
	locations: Exclude<T_StardewValley_GameLocation, { $type: "$unknown" }>[];
	farmhands: T_StardewValley_Farmer[];
};

// Malformed-import tests intentionally bypass the decoder to exercise defensive
// domain behavior. Keep that escape hatch explicit and local to test fixtures.
export function malformedFixture<T>(value: unknown): T {
	return value as T;
}

// Catalog factories return a polymorphic item. Tests targeting equipment must
// establish its concrete type before assigning it to a concrete equipment slot.
export function catalogFixture<T extends Item["$type"]>(
	item: Item | undefined,
	type: T,
): Extract<Item, { $type: T }> {
	if (!item || item.$type !== type)
		throw Error(`Unexpected fixture item type: ${type}`);
	return item as Extract<Item, { $type: T }>;
}
