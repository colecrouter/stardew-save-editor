import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { Effect } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import type { FixtureSave as Save } from "../helpers/editor-document.ts";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
} from "../../src/lib/editor/calendar-document.ts";
import { CalendarSeason } from "../../src/lib/calendarSeason.ts";
import { getStatValue } from "../../src/lib/editor/player-stats.ts";
import { loadFixture } from "./fixture.ts";

// Retain the engine suite's budget for full-save codecs and worker round trips.
vi.setConfig({ testTimeout: 15_000 });

test("the complete Effect calendar history graph supports editing and undo", async () => {
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

test("calendar preparation stages every farmer's date without changing its source", async () => {
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
	assert.equal(getStatValue(prepared.game.player!, "daysPlayed"), 120);
	for (const player of [
		prepared.game.player!,
		...(!Array.isArray(prepared.game.farmhands) ? [] : prepared.game.farmhands),
	])
		assert.equal(player?.yearForSaveGame, 2);
});

test("calendar preparation retains target bindings across document cloning and array reordering", async () => {
	const source = await loadFixture();
	const game = source.SaveGame as unknown as Save;
	const initial = initializeCalendarDocument(game);
	const sunny = prepareCalendarDocument(game, initial, {
		type: "calendar-weather",
		day: "today",
		value: "Sun",
	});
	const sunnyGame = sunny.game as Save;
	const farm = sunnyGame.locations?.find(
		(location) => location?.name === "Farm",
	);
	const soil = farm?.terrainFeatures?.find(
		(entry) => entry.value.$type === "StardewValley.TerrainFeatures.HoeDirt",
	);
	assert.ok(soil);
	assert.equal(soil.value.$type, "StardewValley.TerrainFeatures.HoeDirt");
	if (soil.value.$type !== "StardewValley.TerrainFeatures.HoeDirt")
		throw new Error("Missing soil fixture");
	soil.value.state = 0;
	const rainy = prepareCalendarDocument(sunny.game, sunny.state, {
		type: "calendar-weather",
		day: "today",
		value: "Rain",
	});
	const rainyGame = rainy.game as Save;
	rainyGame.locations.reverse();
	for (const location of rainyGame.locations) {
		location?.terrainFeatures?.reverse();
		location?.buildings?.reverse();
	}
	const dried = prepareCalendarDocument(rainy.game, rainy.state, {
		type: "calendar-weather",
		day: "today",
		value: "Sun",
	});
	const result = (dried.game as Save).locations
		?.find((location) => location?.name === "Farm")
		?.terrainFeatures?.find(
			(entry) => entry.key.X === soil.key.X && entry.key.Y === soil.key.Y,
		);
	assert.equal(result?.value.state, 0);
});
