import {
	calendarFestivalOn,
	type CalendarWeatherChoices,
	DAYS_PER_SEASON,
	dateInRange,
	type ForcedWeather,
	forcedWeather,
	type GameDate,
	greenRainDay,
	MAX_YEAR,
	nextDay,
	planCalendarWeather,
	SEASONS,
	seasonName,
	seasonWeathers,
	totalDays,
	type WeatherFlags,
	type WeatherId,
	weatherLabel,
	weekday,
} from "$lib/calendar";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { locationWeatherContext } from "$lib/locationWeather";
import {
	planRainWatering,
	type WateringMark,
	type WateringTarget,
	type WateringWrite,
} from "$lib/calendarWatering";
import { type Save, Season } from "$types/save";
import {
	readCalendarView,
	writeCalendarDate,
	writeCalendarToday,
	writeCalendarTomorrow,
} from "$lib/calendarDocument";
import { type DataProxy, Raw } from ".";

export interface WeatherOption {
	id: string;
	label: string;
	/** False for the current weather when the day can't have it */
	allowed: boolean;
}

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
	#chosenWeather: CalendarWeatherChoices = {};
	/** Today's flags as loaded, for weather from a mod, whose flags the editor doesn't know */
	#loadedFlags: WeatherFlags;
	/** Explicit provenance; identities are weakly associated with current proxy objects. */
	#watering: WateringMark[] = [];
	#wateringIds = new WeakMap<object, string>();
	#nextWateringId = 0;

	constructor(save: SaveProxy) {
		this.#save = save;
		this[Raw] = save[Raw].SaveGame;
		const state = readCalendarView(this[Raw]);
		this.#date = state.date;
		this.#daysPlayed = state.daysPlayed;
		this.#today = state.today;
		this.#tomorrow = state.tomorrow;
		this.#chosenWeather = state.choices;
		this.#loadedFlags = state.loadedFlags;
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
		if (!this.forcedToday)
			this.#chosenWeather = { ...this.#chosenWeather, today: value };
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
		if (!this.forcedTomorrow)
			this.#chosenWeather = { ...this.#chosenWeather, tomorrow: value };
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
		writeCalendarDate(
			this[Raw],
			next,
			this.#save.players.map((player) => player[Raw]),
		);
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
		const { today, tomorrow } = planCalendarWeather({
			date: this.#date,
			daysPlayed: this.#daysPlayed,
			gameId: Number(this[Raw].uniqueIDForThisGame),
			legacyRandom: this[Raw].useLegacyRandom === true,
			choices: this.#chosenWeather,
		});
		if (today !== this.#today) this.#writeToday(today);
		if (tomorrow !== this.#tomorrow) this.#writeTomorrow(tomorrow);
	}

	#writeToday(id: string) {
		const wasRaining = this[Raw].isRaining === true;
		writeCalendarToday(this[Raw], id, this.#loadedFlags);
		const raining = this[Raw].isRaining === true;
		if (raining !== wasRaining) this.#applyWatering(wasRaining, raining);
		this.#today = id;
	}
	/**
	    Rain at the start of a day waters the pet bowl and all tilled soil
	    (Game1.newDayAfterFade), apart from soil the game hides (state 2).
	    Provenance records only the editor's watering, so removing rain can restore it.
	*/
	#applyWatering(wasRaining: boolean, raining: boolean) {
		const targets: WateringTarget[] = [];
		const bindings = new Map<string, (write: WateringWrite) => void>();
		const identity = (target: object) => {
			let id = this.#wateringIds.get(target);
			if (id === undefined) {
				id = `watering:${++this.#nextWateringId}`;
				this.#wateringIds.set(target, id);
			}
			return id;
		};
		for (const location of this.#save.locations) {
			const raw = location[Raw];
			const context = locationWeatherContext(raw);
			if (raw.isOutdoors !== true || context !== "Default") continue;
			for (const building of raw.buildings?.Building ?? []) {
				if (building["@_xsi:type"] !== "PetBowl") continue;
				const id = identity(building);
				targets.push({
					id,
					context,
					outdoors: true,
					kind: "bowl",
					value: building.watered,
				});
				bindings.set(id, (write) => {
					if (write.kind === "bowl") building.watered = write.value;
				});
			}
			const features =
				typeof raw.terrainFeatures === "object" && raw.terrainFeatures
					? (raw.terrainFeatures.item ?? [])
					: [];
			for (const { value } of features) {
				const feature = value?.TerrainFeature;
				if (feature?.["@_xsi:type"] !== "HoeDirt") continue;
				const id = identity(feature);
				targets.push({
					id,
					context,
					outdoors: true,
					kind: "soil",
					value: feature.state,
				});
				bindings.set(id, (write) => {
					if (write.kind === "soil") feature.state = write.value;
				});
			}
		}
		const prepared = planRainWatering({
			targets,
			provenance: this.#watering,
			context: "Default",
			wasRaining,
			raining,
		});
		for (const write of prepared.writes) bindings.get(write.id)?.(write);
		this.#watering = prepared.provenance;
	}

	#writeTomorrow(id: string) {
		writeCalendarTomorrow(this[Raw], id);
		this.#tomorrow = id;
	}
}
