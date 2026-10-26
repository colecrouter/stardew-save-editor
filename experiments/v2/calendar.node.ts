import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect } from "effect";
import { makeHistorySession } from "./history.ts";
import type { Save } from "../../codegen/save.ts";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
} from "../../src/lib/calendarDocument.ts";
import { CalendarSeason } from "../../src/lib/calendarSeason.ts";
import { getStatValue } from "../../src/lib/playerStats.ts";
import { loadFixture } from "./fixture.ts";

test("the complete Effect calendar history graph runs under native Node", async () => {
	const original = await loadFixture();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(original);
				const after = yield* session.execute([
					{ type: "calendar-date", change: { day: 8 } },
				]);
				assert.equal(gameOf(after.document).dayOfMonth, 8);
				assert.ok(after.domainState.calendar);
				assert.deepEqual((yield* session.undo).document, original);
			}),
		),
	);
});

const gameOf = (document: { SaveGame: unknown }) => document.SaveGame as Save;

test("calendar preparation runs on native Node and stages every farmer's date without changing its source", async () => {
	const source = await loadFixture();
	const before = structuredClone(source);
	const game = source.SaveGame as unknown as Save;
	const state = initializeCalendarDocument(game);
	const prepared = prepareCalendarDocument(game, state, {
		type: "calendar-date",
		change: { year: 2, season: CalendarSeason.Spring, day: 8 },
	});
	assert.deepEqual(source, before);
	assert.equal(prepared.game.year, 2);
	assert.equal(prepared.game.dayOfMonth, 8);
	assert.equal(getStatValue(prepared.game.player, "daysPlayed"), 120);
	for (const player of [
		prepared.game.player,
		...(prepared.game.farmhands === "" ? [] : prepared.game.farmhands.Farmer),
	])
		assert.equal(player.yearForSaveGame, 2);
});

test("native calendar preparation retains target bindings across document cloning and array reordering", async () => {
	const source = await loadFixture();
	const game = source.SaveGame as unknown as Save;
	const initial = initializeCalendarDocument(game);
	const sunny = prepareCalendarDocument(game, initial, {
		type: "calendar-weather",
		day: "today",
		value: "Sun",
	});
	const farm = sunny.game.locations.GameLocation.find(
		(location) => location.name === "Farm",
	);
	const soil = farm?.terrainFeatures?.item.find(
		(entry) => entry.value.TerrainFeature["@_xsi:type"] === "HoeDirt",
	);
	assert.ok(soil);
	soil.value.TerrainFeature.state = 0;
	const rainy = prepareCalendarDocument(sunny.game, sunny.state, {
		type: "calendar-weather",
		day: "today",
		value: "Rain",
	});
	rainy.game.locations.GameLocation.reverse();
	for (const location of rainy.game.locations.GameLocation) {
		location.terrainFeatures?.item?.reverse();
		location.buildings?.Building?.reverse();
	}
	const dried = prepareCalendarDocument(rainy.game, rainy.state, {
		type: "calendar-weather",
		day: "today",
		value: "Sun",
	});
	const result = dried.game.locations.GameLocation.find(
		(location) => location.name === "Farm",
	)?.terrainFeatures?.item.find(
		(entry) =>
			entry.key.Vector2.X === soil.key.Vector2.X &&
			entry.key.Vector2.Y === soil.key.Vector2.Y,
	);
	assert.equal(result?.value.TerrainFeature.state, 0);
});
