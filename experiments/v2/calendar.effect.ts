import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { Save } from "../../codegen/save.ts";
import {
	type CalendarDocumentState,
	valleyWeather,
	initializeCalendarDocument,
} from "../../src/lib/calendarDocument.ts";
import { CalendarSeason } from "../../src/lib/calendarSeason.ts";
import { getStatValue } from "../../src/lib/playerStats.ts";
import { loadFixture, parser, exportDocument, tinyFixture } from "./fixture.ts";
import { makeHistorySession } from "./history.ts";
import {
	coreOperations,
	EditorOperations,
	type Operations,
} from "./operations.ts";
import type { DomainState, DomainValue, SaveDocument } from "./domain.ts";

const gameOf = (document: SaveDocument) => document.SaveGame as unknown as Save;
const calendarOf = (domain: DomainState) =>
	domain.calendar as unknown as CalendarDocumentState;
const today = (value: string) =>
	({ type: "calendar-weather", day: "today", value }) as const;
const day = (value: number) =>
	({ type: "calendar-date", change: { day: value } }) as const;

it.effect(
	"a real-save date transaction updates all farmers, exports unknown data and restores domain state with undo/redo",
	() =>
		Effect.gen(function* () {
			const original = yield* Effect.promise(loadFixture);
			const game = gameOf(original);
			game.farmhands = {
				Farmer: [
					{
						...structuredClone(game.player),
						UniqueMultiplayerID: 123456789,
						name: "Calendar guest",
					},
				],
			};
			const before = structuredClone(original);
			const session = yield* makeHistorySession(original);
			const after = yield* session.execute([
				{
					type: "calendar-date",
					change: { year: 2, season: CalendarSeason.Spring, day: 8 },
				},
			]);
			expect(original).toEqual(before);
			const result = gameOf(after.document);
			expect(getStatValue(result.player, "daysPlayed")).toBe(120);
			for (const player of [
				result.player,
				...(result.farmhands === "" ? [] : result.farmhands.Farmer),
			]) {
				expect(player.yearForSaveGame).toBe(2);
				expect(player.dayOfMonthForSaveGame).toBe(8);
				expect(player.seasonForSaveGame).toBe(0);
			}
			expect(after.entries[0].intent.label).toContain("Spring 8");
			const allowed = [
				"/SaveGame/year",
				"/SaveGame/dayOfMonth",
				"/SaveGame/currentSeason",
				"/SaveGame/player/stats/Values",
				"/SaveGame/player/dayOfMonthForSaveGame",
				"/SaveGame/player/seasonForSaveGame",
				"/SaveGame/player/yearForSaveGame",
				"/SaveGame/farmhands/Farmer",
			];
			expect(
				after.entries[0].forward.every((change) =>
					allowed.some(
						(path) =>
							change.path === path || change.path.startsWith(`${path}/`),
					),
				),
			).toBe(true);
			expect(result.locations).toEqual(game.locations);
			expect(result.player.items).toEqual(game.player.items);
			expect(parser.parse(exportDocument(after.document))).toEqual(
				after.document,
			);
			expect((yield* session.undo).document).toEqual(before);
			const redone = yield* session.redo;
			expect(redone.document).toEqual(after.document);
			expect(redone.domainState).toEqual(after.domainState);
		}),
);

it.effect(
	"rain provenance and ordinary choices survive weather undo/redo and a festival round trip",
	() =>
		Effect.gen(function* () {
			const original = yield* Effect.promise(loadFixture);
			const farm = gameOf(original).locations.GameLocation.find(
				(location) => location.name === "Farm",
			);
			const soils =
				farm?.terrainFeatures?.item.filter(
					(entry) => entry.value.TerrainFeature["@_xsi:type"] === "HoeDirt",
				) ?? [];
			const [dry, wet] = soils;
			if (!dry || !wet) throw new Error("Missing soil fixture");
			dry.value.TerrainFeature.state = 0;
			wet.value.TerrainFeature.state = 1;
			for (const name of ["Forest", "IslandWest"]) {
				const location = gameOf(original).locations.GameLocation.find(
					(location) => location.name === name,
				);
				if (!location) throw new Error(`Missing ${name}`);
				location.terrainFeatures = { item: [structuredClone(dry)] };
			}
			const stateOf = (
				document: SaveDocument,
				target: typeof dry,
				locationName = "Farm",
			) =>
				gameOf(document)
					.locations.GameLocation.find(
						(location) => location.name === locationName,
					)
					?.terrainFeatures?.item.find(
						(entry) =>
							entry.key.Vector2.X === target.key.Vector2.X &&
							entry.key.Vector2.Y === target.key.Vector2.Y,
					)?.value.TerrainFeature.state;
			const session = yield* makeHistorySession(original);
			yield* session.execute([today("Sun")]);
			const rainy = yield* session.execute([today("Rain")]);
			expect(stateOf(rainy.document, dry)).toBe(1);
			expect(stateOf(rainy.document, dry, "Forest")).toBe(1);
			expect(stateOf(rainy.document, dry, "IslandWest")).toBe(0);
			expect(calendarOf(rainy.domainState).watering.length).toBeGreaterThan(0);
			expect(stateOf((yield* session.undo).document, dry)).toBe(0);
			expect((yield* session.redo).domainState).toEqual(rainy.domainState);
			const sunny = yield* session.execute([today("Sun")]);
			expect(stateOf(sunny.document, dry)).toBe(0);
			expect(stateOf(sunny.document, wet)).toBe(1);
			expect(stateOf(sunny.document, dry, "Forest")).toBe(0);
			expect(stateOf(sunny.document, dry, "IslandWest")).toBe(0);
			expect((yield* session.undo).domainState).toEqual(rainy.domainState);
			yield* session.execute([day(13)]);
			expect(calendarOf((yield* session.snapshot).domainState).today).toBe(
				"Festival",
			);
			const restored = yield* session.execute([day(14)]);
			expect(calendarOf(restored.domainState).today).toBe("Rain");
			expect(stateOf(restored.document, dry)).toBe(1);
			expect(parser.parse(exportDocument(restored.document))).toEqual(
				restored.document,
			);
		}),
);

it.effect(
	"a failed calendar group preserves the document, metadata, identities and redo branch",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(
				yield* Effect.promise(loadFixture),
			);
			yield* session.execute([today("Sun")]);
			yield* session.undo;
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(
					yield* Effect.exit(session.execute([today("Sun"), day(100)])),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			expect(gameOf((yield* session.redo).document).isRaining).toBe(false);
		}),
);

it.effect(
	"unannotated target content changes is rejected and undo restores a usable calendar binding",
	() => {
		const adapter: Operations = {
			prepare: (state, action) =>
				coreOperations.prepare(state, action).pipe(
					Effect.map((prepared) => {
						if (action.type === "farm-name") {
							const farm = gameOf(
								prepared.document,
							).locations.GameLocation.find(
								(location) => location.name === "Farm",
							);
							const entry = farm?.terrainFeatures?.item.find(
								(entry) =>
									entry.value.TerrainFeature["@_xsi:type"] === "HoeDirt",
							);
							if (!entry) throw new Error("Missing soil fixture");
							entry.value.TerrainFeature = {
								...entry.value.TerrainFeature,
								health: 999,
							};
						}
						return prepared;
					}),
				),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(
				yield* Effect.promise(loadFixture),
			);
			yield* session.execute([today("Sun")]);
			yield* session.execute([{ type: "farm-name", value: "Changed target" }]);
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(yield* Effect.exit(session.execute([today("Rain")]))),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			yield* session.undo;
			expect(
				gameOf((yield* session.execute([today("Rain")])).document).isRaining,
			).toBe(true);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"mod weather names and original flags return after forced festival weather",
	() =>
		Effect.gen(function* () {
			const original = yield* Effect.promise(loadFixture);
			const weather = valleyWeather(gameOf(original));
			if (!weather) throw new Error("Missing valley weather");
			weather.Weather = "Mod.Meteors";
			weather.weather = { string: "Mod.Meteors" };
			const session = yield* makeHistorySession(original);
			yield* session.execute([day(13)]);
			const restored = yield* session.execute([day(14)]);
			expect(calendarOf(restored.domainState).today).toBe("Mod.Meteors");
			expect(gameOf(restored.document).isRaining).toBe(true);
			expect(valleyWeather(gameOf(restored.document))?.Weather).toBe(
				"Mod.Meteors",
			);
		}),
);

it.effect(
	"malformed calendar metadata and unsupported calendar documents fail before publication",
	() =>
		Effect.gen(function* () {
			const fixture = yield* Effect.promise(loadFixture);
			const session = yield* makeHistorySession(
				fixture,
				{},
				{ calendar: { version: 999 } },
			);
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(yield* Effect.exit(session.execute([day(8)]))),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			const tiny = yield* makeHistorySession(tinyFixture());
			const tinyBefore = yield* tiny.snapshot;
			expect(Exit.isFailure(yield* Effect.exit(tiny.execute([day(8)])))).toBe(
				true,
			);
			expect(yield* tiny.snapshot).toEqual(tinyBefore);
			const malformed = structuredClone(fixture);
			Object.assign(gameOf(malformed).player.stats, { Values: [] });
			const badStats = yield* makeHistorySession(malformed);
			const badStatsBefore = yield* badStats.snapshot;
			expect(
				Exit.isFailure(yield* Effect.exit(badStats.execute([day(8)]))),
			).toBe(true);
			expect(yield* badStats.snapshot).toEqual(badStatsBefore);
		}),
);

it.effect("calendar no-ops don't initialize hidden history or metadata", () =>
	Effect.gen(function* () {
		const session = yield* makeHistorySession(
			yield* Effect.promise(loadFixture),
		);
		const before = yield* session.snapshot;
		const after = yield* session.execute([today("Rain")]);
		expect(after).toEqual(before);
	}),
);

it.effect(
	"green rain is a forecast choice rather than an ordinary current-weather shortcut",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(
				yield* Effect.promise(loadFixture),
			);
			yield* session.execute([
				{
					type: "calendar-date",
					change: { year: 2, season: CalendarSeason.Summer, day: 8 },
				},
			]);
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(
					yield* Effect.exit(session.execute([today("GreenRain")])),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			const forecast = yield* session.execute([
				{ type: "calendar-weather", day: "tomorrow", value: "GreenRain" },
			]);
			expect(gameOf(forecast.document).weatherForTomorrow).toBe("GreenRain");
			expect(valleyWeather(gameOf(forecast.document))?.WeatherForTomorrow).toBe(
				"GreenRain",
			);
			expect((yield* session.undo).domainState).toEqual(before.domainState);
			expect((yield* session.redo).domainState).toEqual(forecast.domainState);
		}),
);

it.effect(
	"ambiguous bindings and orphaned watering marks fail before publication",
	() =>
		Effect.gen(function* () {
			const fixture = yield* Effect.promise(loadFixture);
			const initial = initializeCalendarDocument(gameOf(fixture));
			const [first, second] = initial.targets;
			if (!first || !second) throw new Error("Missing identity fixture");
			for (const invalid of [
				{
					...initial,
					targets: initial.targets.map((target) =>
						target === second ? { ...target, id: first.id } : target,
					),
				},
				{
					...initial,
					watering: [
						{ id: "missing", context: "Default", kind: "soil", before: 0 },
					],
				},
			]) {
				const session = yield* makeHistorySession(
					fixture,
					{},
					{ calendar: invalid as unknown as DomainValue },
				);
				const before = yield* session.snapshot;
				expect(
					Exit.isFailure(yield* Effect.exit(session.execute([today("Sun")]))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}
		}),
);

it.effect(
	"calendar and inventory operations share one transaction while preserving other domain state",
	() =>
		Effect.gen(function* () {
			const fixture = yield* Effect.promise(loadFixture);
			const initial: DomainState = { otherFeature: { retained: true } };
			const session = yield* makeHistorySession(fixture, {}, initial);
			const after = yield* session.execute(
				[
					{ type: "calendar-date", change: { year: 2, day: 8 } },
					{
						type: "money",
						farmerId: String(fixture.SaveGame.player.UniqueMultiplayerID),
						value: 1234,
					},
					{ type: "calendar-weather", day: "tomorrow", value: "Wind" },
				],
				"Prepare farm",
			);
			expect(after.entries).toHaveLength(1);
			expect(after.entries[0].actions).toHaveLength(3);
			expect(after.document.SaveGame.player.money).toBe(1234);
			expect(calendarOf(after.domainState).tomorrow).toBe("Wind");
			expect(after.domainState.otherFeature).toEqual(initial.otherFeature);
			const undone = yield* session.undo;
			expect(undone.document).toEqual(fixture);
			expect(undone.domainState).toEqual(initial);
			expect((yield* session.redo).domainState).toEqual(after.domainState);
		}),
);
