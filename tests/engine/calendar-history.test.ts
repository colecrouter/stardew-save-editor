import { Effect } from "effect";
import { expect, test } from "vitest";

import { CalendarSeason } from "../../src/lib/calendarSeason.ts";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
} from "../../src/lib/editor/calendar-document.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { getStatValue } from "../../src/lib/editor/player-stats.ts";
import { fixtureGame, loadFixture } from "./fixture.ts";

test("the complete Effect calendar history graph supports editing and undo", async () => {
	const original = await loadFixture();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(original);
				const after = yield* session.execute([
					{ type: "calendar-date", change: { day: 8 } },
				]);
				expect(gameOf(after.document).dayOfMonth).toBe(8);
				expect.assert(after.domainState["calendar"] !== undefined);
				expect((yield* session.undo).document).toStrictEqual(original);
			}),
		),
	);
});

const gameOf = fixtureGame;

test("calendar preparation stages every farmer's date without changing its source", async () => {
	const source = await loadFixture();
	const before = structuredClone(source);
	const game = gameOf(source);
	const state = initializeCalendarDocument(game);
	const prepared = prepareCalendarDocument(game, state, {
		type: "calendar-date",
		change: { year: 2, season: CalendarSeason.Spring, day: 8 },
	});
	expect(source).toStrictEqual(before);
	expect(prepared.game.year).toBe(2);
	expect(prepared.game.dayOfMonth).toBe(8);
	expect(getStatValue(prepared.game.player, "daysPlayed")).toBe(120);
	for (const player of [
		prepared.game.player,
		...(!Array.isArray(prepared.game.farmhands) ? [] : prepared.game.farmhands),
	])
		expect(player?.yearForSaveGame).toBe(2);
});

test("calendar preparation retains target bindings across document cloning and array reordering", async () => {
	const source = await loadFixture();
	const game = source.SaveGame;
	const initial = initializeCalendarDocument(game);
	const sunny = prepareCalendarDocument(game, initial, {
		type: "calendar-weather",
		day: "today",
		value: "Sun",
	});
	const sunnyGame = fixtureGame({ SaveGame: sunny.game });
	const farm = sunnyGame.locations?.find(
		(location) => location?.name === "Farm",
	);
	const soil = farm?.terrainFeatures?.find(
		(entry) => entry.value.$type === "StardewValley.TerrainFeatures.HoeDirt",
	);
	expect.assert(soil);
	expect(soil.value.$type).toBe("StardewValley.TerrainFeatures.HoeDirt");
	if (soil.value.$type !== "StardewValley.TerrainFeatures.HoeDirt")
		throw new Error("Missing soil fixture");
	soil.value.state = 0;
	const rainy = prepareCalendarDocument(sunny.game, sunny.state, {
		type: "calendar-weather",
		day: "today",
		value: "Rain",
	});
	const rainyGame = fixtureGame({ SaveGame: rainy.game });
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
	const result = fixtureGame({ SaveGame: dried.game })
		.locations?.find((location) => location?.name === "Farm")
		?.terrainFeatures?.find(
			(entry) => entry.key.X === soil.key.X && entry.key.Y === soil.key.Y,
		);
	expect(result?.value.state).toBe(0);
});
