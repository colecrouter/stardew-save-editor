import { readFile } from "node:fs/promises";

import { expect } from "vitest";

import type { Location, SaveDocument } from "../../src/lib/editor/domain.ts";
import { parser } from "../../tests/helpers/editor-document.ts";

export {
	parser,
	exportDocument,
	tinyFixture,
	scenarios,
} from "../../tests/helpers/editor-document.ts";

// Read the public save from disk; the shared parser reuses the prepared baseline.
export async function loadFixture(): Promise<SaveDocument> {
	const xml = await readFile(
		new URL("../../tests/TestSave", import.meta.url),
		"utf8",
	);
	return parser.parse(xml);
}

type KnownLocation = Exclude<Location, { $type: "$unknown" }>;
// The generated extension index must be removed before replacing one field;
// ordinary Omit would retain only that index and erase named host requirements.
type FixtureGame = {
	[
		Key in keyof SaveDocument["SaveGame"] as string extends Key
			? never
			: number extends Key
				? never
				: Key extends "locations"
					? never
					: Key
	]: SaveDocument["SaveGame"][Key];
} & { locations: KnownLocation[] };

/** Retain fixture identity while establishing the vanilla locations these tests inspect. */
export function fixtureGame(document: SaveDocument): FixtureGame {
	const game = document.SaveGame;
	const hasKnownLocations = (value: typeof game): value is FixtureGame =>
		Array.isArray(value.locations) &&
		value.locations.every(
			(location) => location != null && location.$type !== "$unknown",
		);
	// The public fixture is decoded already. This additional check establishes
	// that family-specific terrain fields are available, without copying the save.
	expect.assert(hasKnownLocations(game), "Expected vanilla fixture locations");
	return game;
}
