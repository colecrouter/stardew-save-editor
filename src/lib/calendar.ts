/**
    The game's calendar and weather rules: dates, festivals, the weather each
    season can have, and the days whose weather is always the same.

    Taken from the game's WorldDate, LocationWeather,
    Game1.getWeatherModificationsForDate and Utility.isGreenRainDay, and the
    wiki's Weather and Modding:Weather data pages. None of it is generated
    (the festivals are from Data/Festivals/FestivalDates and
    Data/PassiveFestivals), so check it when a game update changes festivals
    or weather.
*/
import { Season } from "$types/save";

export const SEASONS = [
	Season.Spring,
	Season.Summer,
	Season.Fall,
	Season.Winter,
] as const;

export const DAYS_PER_SEASON = 28;

/** Not a game limit; it keeps the day count far from overflowing an int */
export const MAX_YEAR = 9999;

/** Indexed by `day % 7` (WorldDate.DayOfWeek), so every season starts on a Monday */
export const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export interface GameDate {
	year: number;
	season: Season;
	/** Day of the month, 1 to 28 */
	day: number;
}

export const seasonIndex = (season: Season) => SEASONS.indexOf(season);

export const seasonName = (season: Season) =>
	season.charAt(0).toUpperCase() + season.slice(1);

export const weekday = (day: number) => WEEKDAYS[day % 7] ?? "Sunday";

/** Days since Spring 1 of Year 1, which is 0 (WorldDate.TotalDays) */
export const totalDays = ({ year, season, day }: GameDate) =>
	((year - 1) * SEASONS.length + seasonIndex(season)) * DAYS_PER_SEASON +
	day -
	1;

/**
    The nearest date the game can have to one a save holds anyway, such as
    Year 0 or day 29: a year of at least 1, a season the game knows, and a
    day from 1 to 28
*/
export function dateInRange({ year, season, day }: GameDate): GameDate {
	const whole = (n: number) => (Number.isFinite(n) ? Math.trunc(n) : 1);
	return {
		year: Math.max(whole(year), 1),
		season: SEASONS.includes(season) ? season : Season.Spring,
		day: Math.min(Math.max(whole(day), 1), DAYS_PER_SEASON),
	};
}

/** The next day, as the game moves to it overnight */
export function nextDay({ year, season, day }: GameDate): GameDate {
	if (day < DAYS_PER_SEASON) return { year, season, day: day + 1 };
	const next = (seasonIndex(season) + 1) % SEASONS.length;
	return {
		year: next === 0 ? year + 1 : year,
		season: SEASONS[next] ?? Season.Spring,
		day: 1,
	};
}

/** e.g. "Saturday, Spring 6, Year 1" */
export const formatDate = (date: GameDate) =>
	`${weekday(date.day)}, ${seasonName(date.season)} ${date.day}, Year ${date.year}`;

// Festivals

export interface Festival {
	name: string;
	season: Season;
	start: number;
	end: number;
	/** Passive festivals (Data/PassiveFestivals) are sunny, not festival weather */
	passive?: boolean;
}

/**
    The valley's festivals: Data/Festivals/FestivalDates, and the passive
    festivals in Data/PassiveFestivals that replace a valley location. The
    Desert Festival is in OTHER_FESTIVALS, since the desert has its own
    weather.
*/
export const FESTIVALS: readonly Festival[] = [
	{ name: "Egg Festival", season: Season.Spring, start: 13, end: 13 },
	{ name: "Flower Dance", season: Season.Spring, start: 24, end: 24 },
	{ name: "Luau", season: Season.Summer, start: 11, end: 11 },
	{
		name: "Trout Derby",
		season: Season.Summer,
		start: 20,
		end: 21,
		passive: true,
	},
	{
		name: "Dance of the Moonlight Jellies",
		season: Season.Summer,
		start: 28,
		end: 28,
	},
	{ name: "Stardew Valley Fair", season: Season.Fall, start: 16, end: 16 },
	{ name: "Spirit's Eve", season: Season.Fall, start: 27, end: 27 },
	{ name: "Festival of Ice", season: Season.Winter, start: 8, end: 8 },
	{
		name: "SquidFest",
		season: Season.Winter,
		start: 12,
		end: 13,
		passive: true,
	},
	{
		name: "Night Market",
		season: Season.Winter,
		start: 15,
		end: 17,
		passive: true,
	},
	{
		name: "Feast of the Winter Star",
		season: Season.Winter,
		start: 25,
		end: 25,
	},
];

/** Festivals on the calendar that don't change the valley's weather */
export const OTHER_FESTIVALS: readonly Festival[] = [
	{
		name: "Desert Festival",
		season: Season.Spring,
		start: 15,
		end: 17,
		passive: true,
	},
];

type DayOfYear = Pick<GameDate, "season" | "day">;

const isOn =
	({ season, day }: DayOfYear) =>
	(f: Festival) =>
		f.season === season && day >= f.start && day <= f.end;

/** The valley's festival on a day, which fixes its weather */
export const festivalOn = (date: DayOfYear) => FESTIVALS.find(isOn(date));

/** Any festival on a day, for showing on the calendar */
export const calendarFestivalOn = (date: DayOfYear) =>
	festivalOn(date) ?? OTHER_FESTIVALS.find(isOn(date));

// Weather

/** The game's weather IDs (Game1.weather_*); mods can add more */
export type WeatherId =
	| "Sun"
	| "Rain"
	| "GreenRain"
	| "Wind"
	| "Storm"
	| "Festival"
	| "Snow"
	| "Wedding";

export const WEATHER_LABELS: Record<WeatherId, string> = {
	Sun: "Sunny",
	Rain: "Rain",
	GreenRain: "Green rain",
	Wind: "Windy",
	Storm: "Storm",
	Festival: "Festival (sunny)",
	Snow: "Snow",
	Wedding: "Wedding (sunny)",
};

export const isWeatherId = (id: string): id is WeatherId =>
	Object.hasOwn(WEATHER_LABELS, id);

export const weatherLabel = (id: string) =>
	isWeatherId(id) ? WEATHER_LABELS[id] : id;

export interface WeatherFlags {
	isRaining: boolean;
	isSnowing: boolean;
	isLightning: boolean;
	isDebrisWeather: boolean;
	isGreenRain: boolean;
}

const flags = (set: Partial<WeatherFlags> = {}): WeatherFlags => ({
	isRaining: false,
	isSnowing: false,
	isLightning: false,
	isDebrisWeather: false,
	isGreenRain: false,
	...set,
});

/**
    The flags each weather sets (LocationWeather.UpdateDailyWeather). Green
    rain is rain too: setting IsGreenRain also sets IsRaining.
*/
export const WEATHER_FLAGS: Record<WeatherId, WeatherFlags> = {
	Sun: flags(),
	Rain: flags({ isRaining: true }),
	GreenRain: flags({ isRaining: true, isGreenRain: true }),
	Wind: flags({ isDebrisWeather: true }),
	Storm: flags({ isRaining: true, isLightning: true }),
	Festival: flags(),
	Snow: flags({ isSnowing: true }),
	Wedding: flags(),
};

/** The weather a set of flags means, as LocationWeather.CopyFrom works it out */
export function weatherFromFlags(f: Partial<WeatherFlags>): WeatherId {
	if (f.isGreenRain) return "GreenRain";
	if (f.isLightning) return "Storm";
	if (f.isRaining) return "Rain";
	if (f.isSnowing) return "Snow";
	if (f.isDebrisWeather) return "Wind";
	return "Sun";
}

/**
    The weather a season can have (wiki: Weather). Snow only falls in winter,
    where rain only comes from a Rain Totem; it's only windy in spring and
    fall, and there are no storms in winter. Green rain is summer's.
*/
export function seasonWeathers(season: Season): WeatherId[] {
	switch (season) {
		case Season.Summer:
			return ["Sun", "Rain", "Storm", "GreenRain"];
		case Season.Winter:
			return ["Sun", "Rain", "Snow"];
		default:
			return ["Sun", "Rain", "Storm", "Wind"];
	}
}

export interface ForcedWeather {
	weather: WeatherId;
	reason: string;
}

/**
    The weather the game always gives a day, whatever the forecast said
    (Game1.getWeatherModificationsForDate, where later rules win).

    @param daysPlayed The host's days played on that day (Stats.DaysPlayed)
    @param greenRainDay The day of summer green rain falls on that year
*/
export function forcedWeather(
	date: GameDate,
	daysPlayed: number,
	greenRainDay?: number,
): ForcedWeather | undefined {
	const festival = festivalOn(date);
	if (festival?.passive)
		return {
			weather: "Sun",
			reason: `It's always sunny for the ${festival.name}`,
		};
	if (festival)
		return {
			weather: "Festival",
			reason: `The ${festival.name} always has festival weather`,
		};
	if (date.season === Season.Summer && date.day % 13 === 0)
		return {
			weather: "Storm",
			reason: "There's always a storm on Summer 13 and 26",
		};
	if (date.season === Season.Summer && date.day === greenRainDay)
		return {
			weather: "GreenRain",
			reason: `Green rain falls on Summer ${date.day} in Year ${date.year}`,
		};
	if (daysPlayed === 3)
		return { weather: "Rain", reason: "The third day of a new farm rains" };
	if (date.day === 1)
		return {
			weather: "Sun",
			reason: "The first day of every season is sunny",
		};
	if (daysPlayed <= 4)
		return {
			weather: "Sun",
			reason: "The first days of a new farm are sunny, apart from the third",
		};
	return undefined;
}

// The game's random numbers, for the green rain day

/** xxHash32 with seed 0, the hash behind the game's HashUtility */
function xxHash32(bytes: Uint8Array): number {
	const PRIME1 = 0x9e3779b1;
	const PRIME2 = 0x85ebca77;
	const PRIME3 = 0xc2b2ae3d;
	const PRIME4 = 0x27d4eb2f;
	const PRIME5 = 0x165667b1;
	const rotl = (x: number, r: number) => (x << r) | (x >>> (32 - r));
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const round = (acc: number, lane: number) =>
		Math.imul(rotl((acc + Math.imul(lane, PRIME2)) | 0, 13), PRIME1);

	let i = 0;
	let hash: number;
	if (bytes.length >= 16) {
		let v1 = (PRIME1 + PRIME2) | 0;
		let v2 = PRIME2;
		let v3 = 0;
		let v4 = -PRIME1 | 0;
		for (; i + 16 <= bytes.length; i += 16) {
			v1 = round(v1, view.getUint32(i, true));
			v2 = round(v2, view.getUint32(i + 4, true));
			v3 = round(v3, view.getUint32(i + 8, true));
			v4 = round(v4, view.getUint32(i + 12, true));
		}
		hash = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) | 0;
	} else {
		hash = PRIME5;
	}
	hash = (hash + bytes.length) | 0;
	for (; i + 4 <= bytes.length; i += 4)
		hash = Math.imul(
			rotl((hash + Math.imul(view.getUint32(i, true), PRIME3)) | 0, 17),
			PRIME4,
		);
	for (; i < bytes.length; i++)
		hash = Math.imul(
			rotl((hash + Math.imul(bytes[i] ?? 0, PRIME5)) | 0, 11),
			PRIME1,
		);
	hash = Math.imul(hash ^ (hash >>> 15), PRIME2);
	hash = Math.imul(hash ^ (hash >>> 13), PRIME3);
	return (hash ^ (hash >>> 16)) >>> 0;
}

const INT_MAX = 2147483647;

/** Utility.CreateRandomSeed */
export function createRandomSeed(legacyRandom: boolean, ...seeds: number[]) {
	const parts = [0, 0, 0, 0, 0].map((_, i) => (seeds[i] ?? 0) % INT_MAX);
	if (legacyRandom)
		return Math.trunc(parts.reduce((sum, part) => sum + part, 0) % INT_MAX);
	// HashUtility.GetDeterministicHashCode(params int[]): the ints' bytes, hashed
	const ints = Int32Array.from(parts, (part) => Math.trunc(part));
	return xxHash32(new Uint8Array(ints.buffer)) | 0;
}

/** .NET's System.Random with a seed, which the game's random numbers come from */
export class CSharpRandom {
	#seeds = new Array<number>(56).fill(0);
	#next = 0;
	#nextP = 21;

	constructor(seed: number) {
		const seeds = this.#seeds;
		let mj = 161803398 - (seed === -2147483648 ? INT_MAX : Math.abs(seed));
		seeds[55] = mj;
		let mk = 1;
		for (let i = 1; i < 55; i++) {
			const ii = (21 * i) % 55;
			seeds[ii] = mk;
			mk = (mj - mk) | 0;
			if (mk < 0) mk += INT_MAX;
			mj = seeds[ii] ?? 0;
		}
		for (let k = 1; k < 5; k++)
			for (let i = 1; i < 56; i++) {
				let value = ((seeds[i] ?? 0) - (seeds[1 + ((i + 30) % 55)] ?? 0)) | 0;
				if (value < 0) value += INT_MAX;
				seeds[i] = value;
			}
	}

	/** Random.Next(): 0 to int.MaxValue - 1 */
	nextInt(): number {
		const seeds = this.#seeds;
		if (++this.#next >= 56) this.#next = 1;
		if (++this.#nextP >= 56) this.#nextP = 1;
		let value = (seeds[this.#next] ?? 0) - (seeds[this.#nextP] ?? 0);
		if (value === INT_MAX) value--;
		if (value < 0) value += INT_MAX;
		seeds[this.#next] = value;
		return value;
	}

	/** Random.Next(max): 0 to max - 1 */
	next(max: number): number {
		return Math.trunc(this.nextInt() * (1 / INT_MAX) * max);
	}
}

const GREEN_RAIN_DAYS = [5, 6, 7, 14, 15, 16, 18, 23];

/**
    The day of summer that green rain falls on in a year (Utility.isGreenRainDay)

    @param gameId The save's uniqueIDForThisGame
    @param legacyRandom The save's useLegacyRandom option
*/
export function greenRainDay(
	year: number,
	gameId: number,
	legacyRandom: boolean,
): number {
	const random = new CSharpRandom(
		createRandomSeed(legacyRandom, year * 777, gameId),
	);
	return GREEN_RAIN_DAYS[random.next(GREEN_RAIN_DAYS.length)] ?? 5;
}
