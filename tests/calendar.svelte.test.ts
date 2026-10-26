import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import { getStatValue, setStatValue } from "$lib/proxies/Farmer.svelte";
import { Season } from "$types/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

const parse = (xml: string) => new XMLManager().parse<SaveFile>(xml);

async function importSave(xml: string): Promise<SaveManager> {
	let saveManager!: SaveManager;
	let promise: Promise<void> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([xml], "TestSave"));
	});
	await promise;
	flushSync();
	cleanup();
	return saveManager;
}

describe("Calendar", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		saveManager = await importSave(await readFile("tests/TestSave", "utf-8"));
	});

	const save = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save;
	};
	const game = () => save().raw.SaveGame;
	const weatherIn = (context: string, parsed: SaveFile = save().raw) => {
		const weather = parsed.SaveGame.locationWeather.item.find(
			(entry) => entry.key.string === context,
		)?.value.LocationWeather;
		if (!weather) throw new Error(`No ${context} weather`);
		return weather;
	};
	const daysPlayed = () =>
		getStatValue(save().raw.SaveGame.player, "daysPlayed");
	// For tests that write out and read back the whole save
	const slow = { timeout: 30_000 };

	it("reads the test save's date and weather", () => {
		const { calendar } = save();
		expect(calendar.date).toEqual({
			year: 1,
			season: Season.Spring,
			day: 6,
		});
		expect(calendar.weekday).toBe("Saturday");
		expect(calendar.daysPlayed).toBe(6);
		expect(calendar.today).toBe("Rain");
		expect(calendar.tomorrow).toBe("Sun");
		expect(calendar.forcedToday).toBeUndefined();
		expect(calendar.forcedTomorrow).toBeUndefined();
		expect(calendar.greenRainDay()).toBe(18);
	});

	it.each([
		[0, Season.Spring],
		[1, Season.Summer],
		[2, Season.Fall],
		[3, Season.Winter],
	] as const)(
		"preserves numeric season %i when editing the date",
		async (index, season) => {
			const xml = (await readFile("tests/TestSave", "utf-8")).replace(
				"<currentSeason>spring</currentSeason>",
				`<currentSeason>${index}</currentSeason>`,
			);
			saveManager = await importSave(xml);
			const { calendar } = save();
			expect(calendar.season).toBe(season);
			expect(calendar.dateProblems).toEqual([]);
			expect(Number(game().currentSeason)).toBe(index);
			calendar.day = 10;
			expect(game().currentSeason).toBe(season);
			expect(game().player.seasonForSaveGame).toBe(index);
		},
	);

	it("changes every copy of the date, and days played with it", () => {
		const { calendar } = save();
		calendar.day = 10;
		expect(game().dayOfMonth).toBe(10);
		expect(game().player.dayOfMonthForSaveGame).toBe(10);
		expect(daysPlayed()).toBe(10);
		expect(calendar.weekday).toBe("Wednesday");

		calendar.season = Season.Summer;
		expect(game().currentSeason).toBe("summer");
		expect(game().player.seasonForSaveGame).toBe(1);
		expect(daysPlayed()).toBe(38);

		calendar.year = 2;
		expect(game().year).toBe(2);
		expect(game().player.yearForSaveGame).toBe(2);
		expect(daysPlayed()).toBe(150);
		expect(calendar.daysPlayed).toBe(150);
	});

	it("refuses dates the game can't have", () => {
		const { calendar } = save();
		expect(() => {
			calendar.day = 29;
		}).toThrow("1 to 28");
		expect(() => {
			calendar.day = 0;
		}).toThrow();
		expect(() => {
			calendar.year = 0;
		}).toThrow();
		expect(() => {
			calendar.year = 1.5;
		}).toThrow();
		expect(() => {
			calendar.season = "autumn" as Season;
		}).toThrow("isn't a season");
		expect(game().dayOfMonth).toBe(6);
		expect(game().year).toBe(1);
	});

	it("writes tomorrow's forecast to the valley only", () => {
		const { calendar } = save();
		const island = structuredClone(weatherIn("Island"));
		const desert = structuredClone(weatherIn("Desert"));

		calendar.tomorrow = "Storm";
		expect(game().weatherForTomorrow).toBe("Storm");
		expect(weatherIn("Default").weatherForTomorrow.string).toBe("Storm");
		expect(weatherIn("Default").WeatherForTomorrow).toBe("Storm");
		expect(weatherIn("Island")).toEqual(island);
		expect(weatherIn("Desert")).toEqual(desert);
	});

	it("writes today's weather flags in every form", () => {
		const { calendar } = save();
		calendar.today = "Sun";
		expect(game()).toMatchObject({
			isRaining: false,
			isSnowing: false,
			isLightning: false,
			isDebrisWeather: false,
		});
		const valley = weatherIn("Default");
		expect(valley.weather.string).toBe("Sun");
		expect(valley.Weather).toBe("Sun");
		for (const flag of [
			"isRaining",
			"isSnowing",
			"isLightning",
			"isDebrisWeather",
		] as const)
			expect(valley[flag].boolean).toBe(false);
		for (const flag of [
			"IsRaining",
			"IsSnowing",
			"IsLightning",
			"IsDebrisWeather",
		] as const)
			expect(valley[flag]).toBe(false);

		calendar.today = "Storm";
		expect(game().isRaining).toBe(true);
		expect(game().isLightning).toBe(true);
		expect(valley.isLightning.boolean).toBe(true);
		expect(valley.IsRaining).toBe(true);
		expect(valley.Weather).toBe("Storm");
	});

	it("keeps to the weather each season can have", () => {
		const { calendar } = save();
		expect(() => {
			calendar.today = "Snow";
		}).toThrow("isn't possible in Spring");
		expect(() => {
			calendar.tomorrow = "GreenRain";
		}).toThrow();
		expect(calendar.todayOptions.map((o) => o.id)).toEqual([
			"Sun",
			"Rain",
			"Storm",
			"Wind",
		]);

		calendar.today = "Wind";
		calendar.season = Season.Summer;
		expect(calendar.today).toBe("Sun");
		expect(game().isDebrisWeather).toBe(false);

		calendar.day = 2;
		calendar.tomorrow = "GreenRain";
		calendar.season = Season.Fall;
		expect(calendar.tomorrow).toBe("Sun");
		expect(game().weatherForTomorrow).toBe("Sun");

		calendar.season = Season.Winter;
		calendar.today = "Snow";
		expect(game().isSnowing).toBe(true);
		expect(weatherIn("Default").IsSnowing).toBe(true);
	});

	it("gives festivals and other set days their weather", () => {
		const { calendar } = save();
		calendar.day = 12;
		expect(calendar.tomorrow).toBe("Festival");
		expect(game().weatherForTomorrow).toBe("Festival");
		expect(calendar.forcedTomorrow?.reason).toContain("Egg Festival");
		expect(() => {
			calendar.tomorrow = "Rain";
		}).toThrow("Egg Festival");

		calendar.day = 13;
		expect(calendar.festival?.name).toBe("Egg Festival");
		expect(calendar.today).toBe("Festival");
		expect(game().isRaining).toBe(false);
		expect(weatherIn("Default").Weather).toBe("Festival");
		expect(calendar.tomorrow).toBe("Sun");

		calendar.day = 3;
		expect(calendar.today).toBe("Rain");
		calendar.day = 1;
		expect(calendar.today).toBe("Sun");

		// TestSave's green rain day in Year 1 is Summer 18
		calendar.season = Season.Summer;
		calendar.day = 17;
		expect(calendar.tomorrow).toBe("GreenRain");
		calendar.day = 18;
		expect(calendar.today).toBe("GreenRain");
		expect(game().isRaining).toBe(true);
		expect(weatherIn("Default").IsGreenRain).toBe(true);
		expect(weatherIn("Default").isGreenRain.boolean).toBe(true);
		expect(weatherIn("Default").Weather).toBe("GreenRain");
		// Back to TestSave's own rain, without the green
		calendar.day = 19;
		expect(calendar.today).toBe("Rain");
		expect(weatherIn("Default").IsGreenRain).toBe(false);
		expect(weatherIn("Default").isGreenRain.boolean).toBe(false);
	});

	it("goes back to the picked weather when the date leaves a fixed day", () => {
		const { calendar } = save();
		calendar.tomorrow = "Storm";
		calendar.day = 12;
		expect(calendar.tomorrow).toBe("Festival");
		calendar.day = 13;
		expect(calendar.today).toBe("Festival");
		expect(game().isRaining).toBe(false);

		// TestSave's own rain, and the forecast picked above
		calendar.day = 6;
		expect(calendar.today).toBe("Rain");
		expect(game().isRaining).toBe(true);
		expect(weatherIn("Default").Weather).toBe("Rain");
		expect(calendar.tomorrow).toBe("Storm");
		expect(game().weatherForTomorrow).toBe("Storm");
	});

	it("doesn't keep a new farm's rain once the date moves on", () => {
		const { calendar } = save();
		calendar.day = 10;
		calendar.today = "Sun";
		// Picking the day first, then the season, passes Year 1's rainy third day
		calendar.day = 3;
		expect(calendar.today).toBe("Rain");
		calendar.season = Season.Summer;
		expect(calendar.today).toBe("Sun");
		expect(game().isRaining).toBe(false);

		// Typing "15" over Year 5 passes Year 1 on the way
		calendar.season = Season.Spring;
		calendar.year = 5;
		expect(calendar.today).toBe("Sun");
		calendar.year = 1;
		expect(calendar.today).toBe("Rain");
		calendar.year = 15;
		expect(calendar.today).toBe("Sun");
		expect(weatherIn("Default").IsRaining).toBe(false);
	});

	it("drops the green rain forecast once the date leaves its eve", () => {
		const { calendar } = save();
		calendar.season = Season.Summer;
		calendar.day = 17;
		expect(calendar.tomorrow).toBe("GreenRain");
		calendar.day = 3;
		expect(calendar.forcedTomorrow).toBeUndefined();
		expect(calendar.tomorrow).toBe("Sun");
		expect(game().weatherForTomorrow).toBe("Sun");
		expect(weatherIn("Default").WeatherForTomorrow).toBe("Sun");

		// A year whose green rain falls on another day
		calendar.day = 17;
		const year = [2, 3, 4, 5, 6].find((y) => calendar.greenRainDay(y) !== 18);
		if (!year) throw new Error("No year without green rain on Summer 18");
		calendar.year = year;
		expect(calendar.tomorrow).toBe("Sun");

		// Green rain the user picks is theirs, so it stays
		calendar.day = 3;
		calendar.tomorrow = "GreenRain";
		calendar.day = 10;
		expect(calendar.tomorrow).toBe("Festival");
		calendar.day = 24;
		expect(calendar.forcedTomorrow).toBeUndefined();
		expect(calendar.tomorrow).toBe("GreenRain");
	});

	it("waters the farm when rain starts, and dries only what it watered", () => {
		const { calendar } = save();
		const farm = save().farm?.[Raw];
		if (!farm) throw new Error("No farm");
		const soil = (farm.terrainFeatures?.item ?? [])
			.map((entry) => entry.value.TerrainFeature)
			.filter((feature) => feature["@_xsi:type"] === "HoeDirt");
		const bowl = farm.buildings?.Building?.find(
			(b) => b["@_xsi:type"] === "PetBowl",
		);
		const [hidden, dry, ...wet] = soil;
		if (!hidden || !dry || !bowl) throw new Error("No soil or pet bowl");
		hidden.state = 2;

		// The save's own rain watered everything, and taking it away leaves that
		calendar.today = "Sun";
		expect([dry, ...wet].every((s) => s.state === 1)).toBe(true);
		dry.state = 0;
		bowl.watered = false;

		calendar.today = "Rain";
		expect(dry.state).toBe(1);
		expect(hidden.state).toBe(2);
		expect(bowl.watered).toBe(true);

		// Still raining, so nothing changes
		calendar.today = "Storm";
		expect(dry.state).toBe(1);

		calendar.today = "Sun";
		expect(dry.state).toBe(0);
		expect(bowl.watered).toBe(false);
		expect(wet.every((s) => s.state === 1)).toBe(true);
		expect(hidden.state).toBe(2);

		// A new farm's rainy third day waters it, and moving on dries it again
		calendar.day = 3;
		expect(dry.state).toBe(1);
		calendar.day = 10;
		expect(dry.state).toBe(0);
	});

	it("restores moved watering targets but leaves removed targets and replacements untouched", () => {
		const { calendar } = save();
		const farm = save().farm?.[Raw];
		if (!farm) throw new Error("No farm");
		const features = farm.terrainFeatures?.item ?? [];
		const buildings = farm.buildings?.Building ?? [];
		const entry = features.find(
			(entry) => entry.value.TerrainFeature["@_xsi:type"] === "HoeDirt",
		);
		const bowl = buildings.find(
			(building) => building["@_xsi:type"] === "PetBowl",
		);
		if (!entry || !bowl) throw new Error("No soil or bowl");
		const soil = entry.value.TerrainFeature;
		calendar.today = "Sun";
		soil.state = 0;
		bowl.watered = false;
		calendar.today = "Rain";
		features.reverse();
		buildings.reverse();
		calendar.today = "Sun";
		expect(soil.state).toBe(0);
		expect(bowl.watered).toBe(false);

		calendar.today = "Rain";
		const soilReplacement = {
			...entry,
			value: { ...entry.value, TerrainFeature: { ...soil } },
		};
		const bowlReplacement = { ...bowl };
		features.splice(features.indexOf(entry), 1, soilReplacement);
		buildings.splice(buildings.indexOf(bowl), 1, bowlReplacement);
		calendar.today = "Sun";
		expect(soilReplacement.value.TerrainFeature.state).toBe(1);
		expect(bowlReplacement.watered).toBe(true);
		// Removed objects may still be retained by a UI reference. Don't write to them.
		expect(soil.state).toBe(1);
		expect(bowl.watered).toBe(true);
	});

	it("waters known outdoor valley locations without touching independent, indoor or unresolved locations", () => {
		const { calendar } = save();
		const farm = save().farm?.[Raw];
		const source = farm?.terrainFeatures?.item.find(
			(entry) => entry.value.TerrainFeature["@_xsi:type"] === "HoeDirt",
		);
		if (!farm || !source) throw new Error("No farm soil");
		calendar.today = "Sun";
		const prepare = (name: string) => {
			const location = save().locations.find(
				(location) => location[Raw].name === name,
			)?.[Raw];
			if (!location) throw new Error(`No ${name}`);
			location.terrainFeatures = {
				item: [
					{
						...source,
						value: {
							...source.value,
							TerrainFeature: { ...source.value.TerrainFeature, state: 0 },
						},
					},
				],
			};
			const entry = location.terrainFeatures.item[0];
			if (!entry) throw new Error("No prepared soil");
			return { location, entry, soil: entry.value.TerrainFeature };
		};
		const forest = prepare("Forest");
		const island = prepare("IslandWest");
		const desert = prepare("Desert");
		const indoors = prepare("FarmHouse");
		const unknown = prepare("Town");
		unknown.location.name = "CustomTown";
		calendar.today = "Rain";
		expect(forest.soil.state).toBe(1);
		for (const target of [island, desert, indoors, unknown])
			expect(target.soil.state).toBe(0);

		// A move between known locations retains the object's session identity.
		forest.location.terrainFeatures = { item: [] };
		farm.terrainFeatures?.item.push(forest.entry);
		calendar.today = "Sun";
		expect(forest.soil.state).toBe(0);
		for (const target of [island, desert, indoors, unknown])
			expect(target.soil.state).toBe(0);
	});

	it("leaves weather from mods alone", async () => {
		const xml = (await readFile("tests/TestSave", "utf-8")).replace(
			"<Weather>Rain</Weather>",
			"<Weather>Meteors</Weather>",
		);
		saveManager = await importSave(xml);
		const { calendar } = save();
		expect(calendar.today).toBe("Meteors");
		expect(calendar.todayOptions[0]).toEqual({
			id: "Meteors",
			label: "Meteors",
			allowed: false,
		});
		calendar.day = 10;
		expect(calendar.today).toBe("Meteors");

		// After a festival, it comes back with the flags it was loaded with
		calendar.day = 13;
		expect(game().isRaining).toBe(false);
		calendar.day = 10;
		expect(calendar.today).toBe("Meteors");
		expect(weatherIn("Default").Weather).toBe("Meteors");
		expect(game().isRaining).toBe(true);
	});

	it("moves Year 0 into range when the day changes", slow, async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		saveManager = await importSave(
			xml.replace("<year>1</year>", "<year>0</year>"),
		);
		expect(save().calendar.dateProblems).toEqual([
			expect.stringContaining("There's no Year 0"),
		]);
		save().calendar.day = 10;
		expect(save().calendar.date).toEqual({
			year: 1,
			season: Season.Spring,
			day: 10,
		});
		expect(daysPlayed()).toBe(10);
		expect(save().calendar.dateProblems).toEqual([]);

		const parsed = parse(await (await saveManager.export()).text());
		expect(parsed.SaveGame.year).toBe(1);
		expect(getStatValue(parsed.SaveGame.player, "daysPlayed")).toBe(10);
	});

	it("moves day 29 into range when the season changes", async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		saveManager = await importSave(
			xml.replace("<dayOfMonth>6</dayOfMonth>", "<dayOfMonth>29</dayOfMonth>"),
		);
		expect(save().calendar.dateProblems).toEqual([
			expect.stringContaining("There's no day 29"),
		]);
		save().calendar.season = Season.Summer;
		expect(save().calendar.date).toEqual({
			year: 1,
			season: Season.Summer,
			day: 28,
		});
		expect(daysPlayed()).toBe(56);
	});

	it("refuses a stat the game can't load", () => {
		const player = game().player;
		for (const value of [-1, 1.5, 2 ** 32])
			expect(() => setStatValue(player, "daysPlayed", value)).toThrow(
				"0 to 4294967295",
			);
		expect(daysPlayed()).toBe(6);
	});

	it("changes every farmhand's copy of the date", slow, async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		const start = xml.indexOf("<player>") + "<player>".length;
		const farmhand = xml
			.slice(start, xml.indexOf("</player>"))
			.replace("<name>Test</name>", "<name>Hand</name>")
			.replace(
				/<UniqueMultiplayerID>\d+<\/UniqueMultiplayerID>/,
				"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
			);
		saveManager = await importSave(
			xml.replace(
				"<farmhands />",
				`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
			),
		);
		const { calendar } = save();
		calendar.year = 2;
		calendar.season = Season.Fall;
		calendar.day = 9;

		const parsed = parse(await (await saveManager.export()).text());
		const { farmhands } = parsed.SaveGame;
		const [hand] = farmhands === "" ? [] : farmhands.Farmer;
		if (!hand) throw new Error("No farmhand");
		expect(hand.name).toBe("Hand");
		expect(hand).toMatchObject({
			dayOfMonthForSaveGame: 9,
			seasonForSaveGame: 2,
			yearForSaveGame: 2,
		});
		// Days played is the host's: a farmhand's counts the days they played
		expect(getStatValue(parsed.SaveGame.player, "daysPlayed")).toBe(177);
		expect(getStatValue(hand, "daysPlayed")).toBe(6);
	});

	it("keeps the changes through an export", slow, async () => {
		const { calendar } = save();
		calendar.year = 3;
		calendar.season = Season.Fall;
		calendar.day = 9;
		calendar.today = "Wind";
		calendar.tomorrow = "Storm";

		const xml = await (await saveManager.export()).text();
		const parsed = parse(xml);
		expect(parsed.SaveGame).toMatchObject({
			year: 3,
			currentSeason: "fall",
			dayOfMonth: 9,
			isDebrisWeather: true,
			isRaining: false,
			weatherForTomorrow: "Storm",
		});
		expect(weatherIn("Default", parsed).Weather).toBe("Wind");

		saveManager = await importSave(xml);
		expect(save().calendar.date).toEqual({
			year: 3,
			season: Season.Fall,
			day: 9,
		});
		expect(save().calendar.daysPlayed).toBe(2 * 112 + 2 * 28 + 9);
		expect(save().calendar.today).toBe("Wind");
		expect(save().calendar.tomorrow).toBe("Storm");
	});

	it(
		"keeps the farm's watering, and its undoing, through an export",
		slow,
		async () => {
			const { calendar } = save();
			const farm = save().farm?.[Raw];
			if (!farm) throw new Error("No farm");
			calendar.today = "Sun";
			for (const { value } of farm.terrainFeatures?.item ?? [])
				if (value.TerrainFeature["@_xsi:type"] === "HoeDirt")
					value.TerrainFeature.state = 0;
			for (const building of farm.buildings?.Building ?? [])
				if (building["@_xsi:type"] === "PetBowl") building.watered = false;

			const exported = async () => {
				const parsed = parse(await (await saveManager.export()).text());
				const farm = parsed.SaveGame.locations.GameLocation.find(
					(l) => l.name === "Farm",
				);
				if (!farm) throw new Error("No farm in the export");
				return {
					soil: (farm.terrainFeatures?.item ?? [])
						.map((entry) => entry.value.TerrainFeature)
						.filter((f) => f["@_xsi:type"] === "HoeDirt")
						.map((f) => f.state),
					bowl: farm.buildings?.Building?.find(
						(b) => b["@_xsi:type"] === "PetBowl",
					)?.watered,
				};
			};

			calendar.today = "Rain";
			const rained = await exported();
			expect(rained.soil.length).toBeGreaterThan(0);
			expect(rained.soil.every((state) => state === 1)).toBe(true);
			expect(rained.bowl).toBe(true);

			calendar.today = "Sun";
			const dried = await exported();
			expect(dried.soil.every((state) => state === 0)).toBe(true);
			expect(dried.bowl).toBe(false);
		},
	);
});
