import {
	calendarFestivalOn,
	DAYS_PER_SEASON,
	dateInRange,
	type ForcedWeather,
	forcedWeather,
	type GameDate,
	greenRainDay,
	isWeatherId,
	MAX_YEAR,
	nextDay,
	SEASONS,
	seasonIndex,
	seasonName,
	seasonWeathers,
	totalDays,
	WEATHER_FLAGS,
	type WeatherFlags,
	type WeatherId,
	weatherFromFlags,
	weatherLabel,
	weekday,
} from "$lib/calendar";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { type LocationWeatherClass, type Save, Season } from "$types/save";
import { type DataProxy, Raw } from ".";

export interface WeatherOption {
	id: string;
	label: string;
	/** False for the current weather when the day can't have it */
	allowed: boolean;
}

/** LocationWeather's flags: the net field (`<isRaining><boolean>`), then the property (`<IsRaining>`) */
const FLAG_FIELDS = [
	["isRaining", "IsRaining"],
	["isSnowing", "IsSnowing"],
	["isLightning", "IsLightning"],
	["isDebrisWeather", "IsDebrisWeather"],
	["isGreenRain", "IsGreenRain"],
] as const;

/**
    Today's date and weather, and tomorrow's forecast.

    On load the game takes the date, today's weather flags and the forecast
    from the top of the save, and pushes them into the valley's (`Default`)
    entry of `locationWeather`; the rest of that entry (such as `Weather` and
    lightning) comes from the save. So every edit writes both, keeping them
    in agreement. Ginger Island and the desert keep their own weather.

    Nothing is written until something is changed: writing on load would
    rewrite derived fields like days played.
*/
export class Calendar implements DataProxy<Save> {
	public [Raw]: Save;
	#save: SaveProxy;

	#date = $state<GameDate>({ year: 1, season: Season.Spring, day: 1 });
	#today = $state("Sun");
	#tomorrow = $state("Sun");
	/** The host's, which the game's weather rules count with */
	#daysPlayed = $state(1);

	/**
	    The weather picked for an ordinary day: the save's, or the last one
	    chosen here. A day with fixed weather (a festival, the green rain
	    day...) only has it while the date is on that day; moving on goes
	    back to this.
	*/
	#chosenToday: string | undefined;
	#chosenTomorrow: string | undefined;
	/** Today's flags as loaded, for weather from a mod, whose flags the editor doesn't know */
	#loadedFlags: WeatherFlags;
	/** Puts back the soil and pet bowls the editor watered, if the rain is taken away again */
	#undoWatering: (() => void)[] = [];

	constructor(save: SaveProxy) {
		this.#save = save;
		this[Raw] = save[Raw].SaveGame;
		const game = this[Raw];

		this.#date = {
			year: game.year,
			// The game reads it in any case, and writes it in lower case
			season: String(game.currentSeason).toLowerCase() as Season,
			day: game.dayOfMonth,
		};
		this.#daysPlayed = save.players[0]?.daysPlayed ?? 0;
		this.#tomorrow = String(game.weatherForTomorrow ?? "Sun");

		// Prefer the weather's name, unless today's flags say otherwise
		const weather = this.#weather;
		this.#loadedFlags = {
			isRaining: game.isRaining === true,
			isSnowing: game.isSnowing === true,
			isLightning: game.isLightning === true,
			isDebrisWeather: game.isDebrisWeather === true,
			isGreenRain: weather?.IsGreenRain === true,
		};
		const fromFlags = weatherFromFlags(this.#loadedFlags);
		const named = weather?.Weather ?? weather?.weather?.string;
		this.#today =
			typeof named === "string" &&
			named &&
			(!isWeatherId(named) ||
				weatherFromFlags(WEATHER_FLAGS[named]) === fromFlags)
				? named
				: fromFlags;

		// The weather the save's date fixes wasn't picked, so it isn't kept
		if (this.#today !== this.forcedToday?.weather)
			this.#chosenToday = this.#today;
		if (this.#tomorrow !== this.forcedTomorrow?.weather)
			this.#chosenTomorrow = this.#tomorrow;
	}

	/** The valley's entry in locationWeather */
	get #weather(): LocationWeatherClass | undefined {
		const all = this[Raw].locationWeather;
		if (typeof all !== "object" || !all) return undefined;
		return all.item?.find((entry) => entry.key?.string === "Default")?.value
			?.LocationWeather;
	}

	get date(): GameDate {
		return this.#date;
	}

	get year() {
		return this.#date.year;
	}

	set year(value: number) {
		if (!Number.isInteger(value) || value < 1 || value > MAX_YEAR)
			throw new Error(`The year must be a whole number from 1 to ${MAX_YEAR}`);
		this.#writeDate({ year: value });
	}

	get season() {
		return this.#date.season;
	}

	set season(value: Season) {
		if (!SEASONS.includes(value)) throw new Error(`"${value}" isn't a season`);
		this.#writeDate({ season: value });
	}

	get day() {
		return this.#date.day;
	}

	set day(value: number) {
		if (!Number.isInteger(value) || value < 1 || value > DAYS_PER_SEASON)
			throw new Error(`The day must be from 1 to ${DAYS_PER_SEASON}`);
		this.#writeDate({ day: value });
	}

	/**
	    What's wrong with the save's date, if the game never makes it (the save
	    still loads). Changing any part of the date moves the rest into range.
	*/
	get dateProblems(): string[] {
		const { year, season, day } = this.#date;
		const fixed = dateInRange(this.#date);
		const problems: string[] = [];
		if (fixed.year !== year)
			problems.push(
				`There's no Year ${year}: changing the day or season moves the save to Year ${fixed.year}.`,
			);
		if (fixed.season !== season)
			problems.push(
				`"${season}" isn't a season: changing the day or year moves the save to ${seasonName(fixed.season)}.`,
			);
		if (fixed.day !== day)
			problems.push(
				`There's no day ${day} in a season: changing the year or season moves the save to day ${fixed.day}.`,
			);
		return problems;
	}

	get weekday() {
		return weekday(this.#date.day);
	}

	get daysPlayed() {
		return this.#daysPlayed;
	}

	/** Today's festival, including ones that don't change the valley's weather */
	get festival() {
		return calendarFestivalOn(this.#date);
	}

	get tomorrowDate() {
		return nextDay(this.#date);
	}

	/** The day of summer green rain falls on in a year */
	greenRainDay(year = this.#date.year) {
		const game = this[Raw];
		return greenRainDay(
			year,
			Number(game.uniqueIDForThisGame),
			game.useLegacyRandom === true,
		);
	}

	get forcedToday(): ForcedWeather | undefined {
		return forcedWeather(this.#date, this.#daysPlayed, this.greenRainDay());
	}

	get forcedTomorrow(): ForcedWeather | undefined {
		const tomorrow = this.tomorrowDate;
		return forcedWeather(
			tomorrow,
			this.#daysPlayed + 1,
			this.greenRainDay(tomorrow.year),
		);
	}

	/** Today's weather: what you wake up to */
	get today() {
		return this.#today;
	}

	set today(value: string) {
		if (!this.#todayWeathers().includes(value as WeatherId))
			throw new Error(
				this.forcedToday?.reason ??
					`${weatherLabel(value)} isn't possible in ${seasonName(this.#date.season)}`,
			);
		if (!this.forcedToday) this.#chosenToday = value;
		this.#writeToday(value);
	}

	/** Tomorrow's weather: the forecast on the TV */
	get tomorrow() {
		return this.#tomorrow;
	}

	set tomorrow(value: string) {
		if (!this.#tomorrowWeathers().includes(value as WeatherId))
			throw new Error(
				this.forcedTomorrow?.reason ??
					`${weatherLabel(value)} isn't possible in ${seasonName(this.tomorrowDate.season)}`,
			);
		if (!this.forcedTomorrow) this.#chosenTomorrow = value;
		this.#writeTomorrow(value);
	}

	get todayOptions(): WeatherOption[] {
		return this.#options(this.#today, this.#todayWeathers());
	}

	get tomorrowOptions(): WeatherOption[] {
		return this.#options(this.#tomorrow, this.#tomorrowWeathers());
	}

	/**
	    Green rain can't be picked for today: the game grows its weeds, moss
	    and trees overnight, as a green rain day starts, so today's wouldn't
	    have them.
	*/
	#todayWeathers(): WeatherId[] {
		const forced = this.forcedToday;
		if (forced) return [forced.weather];
		return seasonWeathers(this.#date.season).filter((w) => w !== "GreenRain");
	}

	#tomorrowWeathers(): WeatherId[] {
		const forced = this.forcedTomorrow;
		if (forced) return [forced.weather];
		return seasonWeathers(this.tomorrowDate.season);
	}

	#options(current: string, allowed: WeatherId[]): WeatherOption[] {
		const options: WeatherOption[] = allowed.map((id) => ({
			id,
			label: weatherLabel(id),
			allowed: true,
		}));
		if (!allowed.includes(current as WeatherId))
			options.unshift({
				id: current,
				label: weatherLabel(current),
				allowed: false,
			});
		return options;
	}

	/**
	    Move to another date, as if the game had got there: every farmer's copy
	    of the date and the host's days played change with it, then the weather
	    follows the new day's rules (see #applyWeather). Parts of the date the
	    game never makes (Year 0, day 29) move into range with the change, so
	    days played can't go below 1.
	*/
	#writeDate(change: Partial<GameDate>) {
		const next = dateInRange({ ...this.#date, ...change });
		// Days played starts at 1 and goes up with the date (Game1.newDayAfterFade).
		// Written first: it refuses a count the game can't load, before anything changes.
		const daysPlayed = totalDays(next) + 1;
		const host = this.#save.players[0];
		if (host) host.daysPlayed = daysPlayed;

		const game = this[Raw];
		game.year = next.year;
		game.currentSeason = next.season;
		game.dayOfMonth = next.day;
		for (const player of this.#save.players) {
			player[Raw].dayOfMonthForSaveGame = next.day;
			player[Raw].seasonForSaveGame = seasonIndex(next.season);
			player[Raw].yearForSaveGame = next.year;
		}
		this.#date = next;
		this.#daysPlayed = daysPlayed;
		this.#applyWeather();
	}

	/**
	    Today's and tomorrow's weather for the date: the date's fixed weather if
	    it has one, or else the weather picked for an ordinary day if the season
	    can have it, or else sunny. So it doesn't matter which dates were passed
	    on the way: a festival's or the green rain day's weather goes when the
	    date moves on, and the picked weather comes back. Weather the editor
	    doesn't know (from a mod) is kept.
	*/
	#applyWeather() {
		const ordinary = (chosen: string | undefined, allowed: WeatherId[]) =>
			chosen !== undefined && (!isWeatherId(chosen) || allowed.includes(chosen))
				? chosen
				: "Sun";

		const today =
			this.forcedToday?.weather ??
			ordinary(this.#chosenToday, this.#todayWeathers());
		if (today !== this.#today) this.#writeToday(today);

		const tomorrow =
			this.forcedTomorrow?.weather ??
			ordinary(this.#chosenTomorrow, this.#tomorrowWeathers());
		if (tomorrow !== this.#tomorrow) this.#writeTomorrow(tomorrow);
	}

	#writeToday(id: string) {
		const game = this[Raw];
		const flags = isWeatherId(id) ? WEATHER_FLAGS[id] : this.#loadedFlags;
		const wasRaining = game.isRaining === true;

		game.isRaining = flags.isRaining;
		game.isSnowing = flags.isSnowing;
		game.isLightning = flags.isLightning;
		game.isDebrisWeather = flags.isDebrisWeather;

		const weather = this.#weather;
		if (weather) {
			if (typeof weather.weather === "object" && weather.weather)
				weather.weather.string = id;
			else weather.weather = { string: id };
			weather.Weather = id;
			for (const [field, property] of FLAG_FIELDS) {
				if (typeof weather[field] === "object" && weather[field])
					weather[field].boolean = flags[field];
				else weather[field] = { boolean: flags[field] };
				weather[property] = flags[field];
			}
		}

		if (flags.isRaining && !wasRaining) this.#waterFarm();
		if (!flags.isRaining && wasRaining) this.#dryFarm();
		this.#today = id;
	}

	/**
	    Rain at the start of a day waters the pet bowl and all tilled soil
	    (Game1.newDayAfterFade), apart from soil the game hides (state 2).
	    What this waters is remembered, so #dryFarm can put it back.
	*/
	#waterFarm() {
		const farm = this.#save.farm?.[Raw];
		if (!farm) return;
		for (const building of farm.buildings?.Building ?? []) {
			if (building["@_xsi:type"] !== "PetBowl" || building.watered === true)
				continue;
			const before = building.watered;
			building.watered = true;
			this.#undoWatering.push(() => {
				if (building.watered === true) building.watered = before;
			});
		}
		const features =
			typeof farm.terrainFeatures === "object" && farm.terrainFeatures
				? (farm.terrainFeatures.item ?? [])
				: [];
		for (const { value } of features) {
			const feature = value?.TerrainFeature;
			if (
				feature?.["@_xsi:type"] !== "HoeDirt" ||
				feature.state === 1 ||
				feature.state === 2
			)
				continue;
			const before = feature.state;
			feature.state = 1;
			this.#undoWatering.push(() => {
				if (feature.state === 1) feature.state = before;
			});
		}
	}

	/** Dry what #waterFarm watered; what the save had watered stays watered */
	#dryFarm() {
		for (const undo of this.#undoWatering) undo();
		this.#undoWatering = [];
	}

	#writeTomorrow(id: string) {
		this[Raw].weatherForTomorrow = id;
		const weather = this.#weather;
		if (weather) {
			if (
				typeof weather.weatherForTomorrow === "object" &&
				weather.weatherForTomorrow
			)
				weather.weatherForTomorrow.string = id;
			else weather.weatherForTomorrow = { string: id };
			weather.WeatherForTomorrow = id;
		}
		this.#tomorrow = id;
	}
}
