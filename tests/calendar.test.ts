import { describe, expect, it } from "vitest";
import {
	CSharpRandom,
	calendarFestivalOn,
	createRandomSeed,
	dateInRange,
	festivalOn,
	forcedWeather,
	type GameDate,
	greenRainDay,
	nextDay,
	seasonWeathers,
	totalDays,
	WEATHER_FLAGS,
	weatherFromFlags,
	weekday,
} from "$lib/calendar";
import { Season } from "$types/save";

const date = (season: Season, day: number, year = 1): GameDate => ({
	year,
	season,
	day,
});

describe("calendar", () => {
	it("starts every season on a Monday", () => {
		expect(weekday(1)).toBe("Monday");
		expect(weekday(6)).toBe("Saturday");
		expect(weekday(7)).toBe("Sunday");
		expect(weekday(28)).toBe("Sunday");
	});

	it("counts days from Spring 1 of Year 1", () => {
		expect(totalDays(date(Season.Spring, 1))).toBe(0);
		expect(totalDays(date(Season.Spring, 6))).toBe(5);
		expect(totalDays(date(Season.Winter, 28))).toBe(111);
		expect(totalDays(date(Season.Spring, 1, 2))).toBe(112);
	});

	it("rolls over to the next season and year", () => {
		expect(nextDay(date(Season.Spring, 6))).toEqual(date(Season.Spring, 7));
		expect(nextDay(date(Season.Spring, 28))).toEqual(date(Season.Summer, 1));
		expect(nextDay(date(Season.Winter, 28))).toEqual(date(Season.Spring, 1, 2));
	});

	it("finds festivals, including several-day ones", () => {
		expect(festivalOn(date(Season.Spring, 13))?.name).toBe("Egg Festival");
		expect(festivalOn(date(Season.Winter, 16))?.name).toBe("Night Market");
		expect(festivalOn(date(Season.Winter, 16))?.passive).toBe(true);
		expect(festivalOn(date(Season.Spring, 14))).toBeUndefined();
	});

	it("shows the Desert Festival, which leaves the valley's weather alone", () => {
		for (const day of [15, 16, 17]) {
			expect(calendarFestivalOn(date(Season.Spring, day))?.name).toBe(
				"Desert Festival",
			);
			expect(festivalOn(date(Season.Spring, day))).toBeUndefined();
			expect(forcedWeather(date(Season.Spring, day), day, 18)).toBeUndefined();
		}
		expect(calendarFestivalOn(date(Season.Spring, 18))).toBeUndefined();
		expect(calendarFestivalOn(date(Season.Spring, 13))?.name).toBe(
			"Egg Festival",
		);
	});

	it("moves a date the game never makes into range", () => {
		expect(dateInRange(date(Season.Fall, 9, 3))).toEqual(
			date(Season.Fall, 9, 3),
		);
		expect(dateInRange(date(Season.Fall, 9, 0))).toEqual(date(Season.Fall, 9));
		expect(dateInRange(date(Season.Fall, 9, -4))).toEqual(date(Season.Fall, 9));
		expect(dateInRange(date(Season.Fall, 29, 2))).toEqual(
			date(Season.Fall, 28, 2),
		);
		expect(dateInRange(date(Season.Fall, 0, 2))).toEqual(
			date(Season.Fall, 1, 2),
		);
		expect(dateInRange(date("autumn" as Season, 5))).toEqual(
			date(Season.Spring, 5),
		);
		expect(dateInRange(date(Season.Fall, Number.NaN, Number.NaN))).toEqual(
			date(Season.Fall, 1),
		);
	});
});

describe("weather", () => {
	it("only offers the weather each season can have", () => {
		expect(seasonWeathers(Season.Spring)).toEqual([
			"Sun",
			"Rain",
			"Storm",
			"Wind",
		]);
		for (const season of [Season.Spring, Season.Summer, Season.Fall])
			expect(seasonWeathers(season)).not.toContain("Snow");
		expect(seasonWeathers(Season.Winter)).toContain("Snow");
		// A Rain Totem still works in winter
		expect(seasonWeathers(Season.Winter)).toContain("Rain");
		expect(seasonWeathers(Season.Winter)).not.toContain("Storm");
		expect(seasonWeathers(Season.Summer)).not.toContain("Wind");
		expect(seasonWeathers(Season.Winter)).not.toContain("Wind");
		expect(seasonWeathers(Season.Summer)).toContain("GreenRain");
		expect(seasonWeathers(Season.Fall)).not.toContain("GreenRain");
	});

	it("sets the flags each weather has, with green rain counting as rain", () => {
		expect(WEATHER_FLAGS.Storm).toMatchObject({
			isRaining: true,
			isLightning: true,
		});
		expect(WEATHER_FLAGS.GreenRain).toMatchObject({
			isRaining: true,
			isGreenRain: true,
		});
		expect(Object.values(WEATHER_FLAGS.Festival).some(Boolean)).toBe(false);
		for (const id of ["Sun", "Rain", "GreenRain", "Wind", "Storm", "Snow"])
			expect(weatherFromFlags(WEATHER_FLAGS[id as "Sun"])).toBe(id);
	});

	it("knows the days with fixed weather", () => {
		const forced = (d: GameDate, daysPlayed = totalDays(d) + 1) =>
			forcedWeather(d, daysPlayed, 18)?.weather;
		expect(forced(date(Season.Fall, 1))).toBe("Sun");
		expect(forced(date(Season.Spring, 2))).toBe("Sun");
		expect(forced(date(Season.Spring, 3))).toBe("Rain");
		expect(forced(date(Season.Spring, 4))).toBe("Sun");
		// It's days played that counts, not the date
		expect(forced(date(Season.Spring, 3, 2))).toBeUndefined();
		expect(forced(date(Season.Spring, 10), 3)).toBe("Rain");
		expect(forced(date(Season.Spring, 13))).toBe("Festival");
		expect(forced(date(Season.Winter, 25))).toBe("Festival");
		expect(forced(date(Season.Summer, 13))).toBe("Storm");
		expect(forced(date(Season.Summer, 26))).toBe("Storm");
		expect(forced(date(Season.Summer, 18))).toBe("GreenRain");
		expect(forced(date(Season.Summer, 20))).toBe("Sun");
		expect(forced(date(Season.Winter, 16))).toBe("Sun");
		expect(forced(date(Season.Spring, 7))).toBeUndefined();
		expect(forcedWeather(date(Season.Spring, 13), 13)?.reason).toContain(
			"Egg Festival",
		);
	});
});

describe("the game's random numbers", () => {
	it("match .NET's seeded System.Random", () => {
		const random = new CSharpRandom(0);
		expect([random.nextInt(), random.nextInt(), random.nextInt()]).toEqual([
			1559595546, 1755192844, 1649316166,
		]);
	});

	it("hash seeds with xxHash32, or add them for legacy randomness", () => {
		expect(createRandomSeed(false, 777, 390176213)).toBe(238367123);
		expect(createRandomSeed(false, 2 * 777, 390176213)).toBe(1865017865);
		expect(createRandomSeed(true, 777, 390176213)).toBe(390176990);
	});

	it("picks the test save's green rain day", () => {
		// TestSave's uniqueIDForThisGame, without legacy randomness
		expect(greenRainDay(1, 390176213, false)).toBe(18);
		for (let year = 1; year < 10; year++)
			expect([5, 6, 7, 14, 15, 16, 18, 23]).toContain(
				greenRainDay(year, 390176213, year % 2 === 0),
			);
	});
});
