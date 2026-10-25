import type { LocationWeatherClass, Player, Save, Season } from "$types/save";
import {
	dateInRange,
	DAYS_PER_SEASON,
	forcedWeather,
	greenRainDay,
	isWeatherId,
	MAX_YEAR,
	nextDay,
	planCalendarWeather,
	SEASONS,
	seasonIndex,
	seasonWeathers,
	totalDays,
	WEATHER_FLAGS,
	weatherFromFlags,
	type CalendarWeatherChoices,
	type GameDate,
	type WeatherFlags,
	type WeatherId,
} from "./calendar.ts";
import {
	planRainWatering,
	type WateringMark,
	type WateringTarget,
	type WateringWrite,
} from "./calendarWatering.ts";
import { locationWeatherContext } from "./locationWeather.ts";
import { getStatValue, setStatValue } from "./playerStats.ts";

export interface CalendarViewState {
	date: GameDate;
	daysPlayed: number;
	today: string;
	tomorrow: string;
	choices: CalendarWeatherChoices;
	loadedFlags: WeatherFlags;
}
export interface CalendarDocumentState extends CalendarViewState {
	version: 1;
	watering: WateringMark[];
	targets: { key: string; id: string; fingerprint: string }[];
}
export type CalendarEdit =
	| { type: "calendar-date"; change: Partial<GameDate> }
	| { type: "calendar-weather"; day: "today" | "tomorrow"; value: string };

export function valleyWeather(game: Save): LocationWeatherClass | undefined {
	return typeof game.locationWeather === "object" && game.locationWeather
		? game.locationWeather.item?.find(
				(entry) => entry.key?.string === "Default",
			)?.value?.LocationWeather
		: undefined;
}
const flags = [
	["isRaining", "IsRaining"],
	["isSnowing", "IsSnowing"],
	["isLightning", "IsLightning"],
	["isDebrisWeather", "IsDebrisWeather"],
	["isGreenRain", "IsGreenRain"],
] as const;

const fixed = (game: Save, state: CalendarViewState, tomorrow: boolean) => {
	const date = tomorrow ? nextDay(state.date) : state.date;
	return forcedWeather(
		date,
		state.daysPlayed + (tomorrow ? 1 : 0),
		greenRainDay(
			date.year,
			Number(game.uniqueIDForThisGame),
			game.useLegacyRandom === true,
		),
	);
};

export function readCalendarView(game: Save): CalendarViewState {
	const seasonText = String(game.currentSeason).trim().toLowerCase();
	const seasonNumber = /^-?\d+$/.test(seasonText)
		? Number(seasonText)
		: Number.NaN;
	const weather = valleyWeather(game);
	const loadedFlags: WeatherFlags = {
		isRaining: game.isRaining === true,
		isSnowing: game.isSnowing === true,
		isLightning: game.isLightning === true,
		isDebrisWeather: game.isDebrisWeather === true,
		isGreenRain: weather?.IsGreenRain === true,
	};
	const fromFlags = weatherFromFlags(loadedFlags);
	const named = weather?.Weather ?? weather?.weather?.string;
	const state: CalendarViewState = {
		date: {
			year: game.year,
			season: SEASONS[seasonNumber] ?? (seasonText as Season),
			day: game.dayOfMonth,
		},
		daysPlayed: getStatValue(game.player, "daysPlayed"),
		today:
			typeof named === "string" &&
			named &&
			(!isWeatherId(named) ||
				weatherFromFlags(WEATHER_FLAGS[named]) === fromFlags)
				? named
				: fromFlags,
		tomorrow: String(game.weatherForTomorrow ?? "Sun"),
		choices: {},
		loadedFlags,
	};
	if (state.today !== fixed(game, state, false)?.weather)
		state.choices = { ...state.choices, today: state.today };
	if (state.tomorrow !== fixed(game, state, true)?.weather)
		state.choices = { ...state.choices, tomorrow: state.tomorrow };
	return state;
}

export function writeCalendarDate(
	game: Save,
	date: GameDate,
	players: readonly Player[] = [
		game.player,
		...(game.farmhands === "" ? [] : game.farmhands.Farmer),
	],
) {
	const host = players[0];
	if (host) setStatValue(host, "daysPlayed", totalDays(date) + 1);
	game.year = date.year;
	game.currentSeason = date.season;
	game.dayOfMonth = date.day;
	for (const player of players) {
		player.dayOfMonthForSaveGame = date.day;
		player.seasonForSaveGame = seasonIndex(date.season);
		player.yearForSaveGame = date.year;
	}
}

export function writeCalendarToday(
	game: Save,
	id: string,
	loadedFlags: WeatherFlags,
) {
	const selected = isWeatherId(id) ? WEATHER_FLAGS[id] : loadedFlags;
	game.isRaining = selected.isRaining;
	game.isSnowing = selected.isSnowing;
	game.isLightning = selected.isLightning;
	game.isDebrisWeather = selected.isDebrisWeather;
	const weather = valleyWeather(game);
	if (!weather) return;
	if (typeof weather.weather === "object" && weather.weather)
		weather.weather.string = id;
	else weather.weather = { string: id };
	weather.Weather = id;
	for (const [field, property] of flags) {
		if (typeof weather[field] === "object" && weather[field])
			weather[field].boolean = selected[field];
		else weather[field] = { boolean: selected[field] };
		weather[property] = selected[field];
	}
}

export function writeCalendarTomorrow(game: Save, id: string) {
	game.weatherForTomorrow = id;
	const weather = valleyWeather(game);
	if (!weather) return;
	if (
		typeof weather.weatherForTomorrow === "object" &&
		weather.weatherForTomorrow
	)
		weather.weatherForTomorrow.string = id;
	else weather.weatherForTomorrow = { string: id };
	weather.WeatherForTomorrow = id;
}

type BoundTarget =
	| Omit<Extract<WateringTarget, { kind: "soil" }>, "id">
	| Omit<Extract<WateringTarget, { kind: "bowl" }>, "id">;
interface TargetBinding {
	key: string;
	fingerprint: string;
	target: BoundTarget;
	write: (write: WateringWrite) => void;
}

/** Resolved by keys, never array positions. Unannotated topology/content changes fail closed. */
function bindings(game: Save): Map<string, TargetBinding> {
	const result = new Map<string, TargetBinding>();
	const locations = new Set<string>();
	const add = (binding: TargetBinding) => {
		if (result.has(binding.key))
			throw new Error("Calendar target key is ambiguous");
		result.set(binding.key, binding);
	};
	for (const location of game.locations.GameLocation) {
		const context = locationWeatherContext(location);
		if (location.isOutdoors !== true || context !== "Default") continue;
		const locationKey =
			typeof location.uniqueName === "string" && location.uniqueName
				? location.uniqueName
				: location.name;
		if (locations.has(locationKey))
			throw new Error("Calendar location key is ambiguous");
		locations.add(locationKey);
		for (const building of location.buildings?.Building ?? []) {
			if (building["@_xsi:type"] !== "PetBowl") continue;
			if (typeof building.id !== "string" || !building.id)
				throw new Error("A pet bowl is missing its building ID");
			if (
				building.watered !== undefined &&
				typeof building.watered !== "boolean"
			)
				throw new Error("Pet bowl watering is invalid");
			const { watered: _watered, ...detail } = building;
			add({
				key: JSON.stringify([locationKey, "bowl", building.id]),
				fingerprint: JSON.stringify(detail),
				target: {
					context,
					outdoors: true,
					kind: "bowl",
					value: building.watered,
				},
				write: (write) => {
					if (write.kind !== "bowl")
						throw new Error("Calendar target kind changed");
					if (write.value === undefined) delete building.watered;
					else building.watered = write.value;
				},
			});
		}
		for (const entry of location.terrainFeatures?.item ?? []) {
			const feature = entry.value?.TerrainFeature;
			if (feature?.["@_xsi:type"] !== "HoeDirt") continue;
			const tile = entry.key?.Vector2;
			if (!tile || !Number.isInteger(tile.X) || !Number.isInteger(tile.Y))
				throw new Error("A tilled tile is missing its map coordinates");
			if (feature.state !== undefined && !Number.isFinite(feature.state))
				throw new Error("Soil watering is invalid");
			const { state: _state, ...detail } = feature;
			add({
				key: JSON.stringify([locationKey, "soil", tile.X, tile.Y]),
				fingerprint: JSON.stringify(detail),
				target: { context, outdoors: true, kind: "soil", value: feature.state },
				write: (write) => {
					if (write.kind !== "soil")
						throw new Error("Calendar target kind changed");
					if (write.value === undefined) delete feature.state;
					else feature.state = write.value;
				},
			});
		}
	}
	return result;
}

function assertCalendarDocument(game: Save) {
	const record = (value: unknown): value is Record<string, unknown> =>
		typeof value === "object" && value !== null && !Array.isArray(value);
	const stats: unknown = game.player?.stats;
	if (!record(stats))
		throw new Error("The host statistics have an unsupported format");
	const values = stats.Values;
	if (
		values !== undefined &&
		values !== "" &&
		(!record(values) ||
			(values.item !== undefined && !Array.isArray(values.item)))
	)
		throw new Error("The host statistics have an unsupported format");
	if (
		!Number.isInteger(game.year) ||
		!Number.isInteger(game.dayOfMonth) ||
		!game.player?.stats ||
		!Array.isArray(game.locations?.GameLocation)
	)
		throw new Error("Calendar requires a date, host stats and locations");
}

export function initializeCalendarDocument(game: Save): CalendarDocumentState {
	assertCalendarDocument(game);
	return {
		...readCalendarView(game),
		version: 1,
		watering: [],
		targets: [...bindings(game).values()].map((binding, index) => ({
			key: binding.key,
			id: `calendar:${index + 1}`,
			fingerprint: binding.fingerprint,
		})),
	};
}

export function prepareCalendarDocument(
	input: Save,
	current: CalendarDocumentState,
	edit: CalendarEdit,
): { game: Save; state: CalendarDocumentState } {
	assertCalendarDocument(input);
	const game = structuredClone(input);
	const state = structuredClone(current);
	const live = bindings(game);
	const resolve = (key: string) => {
		const binding = live.get(key);
		if (!binding) throw new Error("A farm object is no longer available");
		return binding;
	};
	if (
		live.size !== state.targets.length ||
		state.targets.some(
			(target) => live.get(target.key)?.fingerprint !== target.fingerprint,
		)
	)
		throw new Error(
			"Farm objects changed. Undo that edit before changing the date or weather.",
		);
	const ids = new Set(state.targets.map((target) => target.id));
	if (
		ids.size !== state.targets.length ||
		new Set(state.targets.map((target) => target.key)).size !==
			state.targets.length
	)
		throw new Error("Some farm objects could not be matched uniquely");
	const owned = new Map(
		state.targets.map((target) => [target.id, resolve(target.key).target]),
	);
	const marks = new Set<string>();
	for (const mark of state.watering) {
		const target = owned.get(mark.id);
		if (
			!target ||
			target.kind !== mark.kind ||
			target.context !== mark.context ||
			marks.has(mark.id)
		)
			throw new Error("Recorded watering no longer matches the farm");
		marks.add(mark.id);
	}
	const writeToday = (id: string) => {
		const wasRaining = game.isRaining === true;
		writeCalendarToday(game, id, state.loadedFlags);
		const prepared = planRainWatering({
			targets: state.targets.map((target) => ({
				...resolve(target.key).target,
				id: target.id,
			})),
			provenance: state.watering,
			context: "Default",
			wasRaining,
			raining: game.isRaining === true,
		});
		for (const write of prepared.writes) {
			const target = state.targets.find((target) => target.id === write.id);
			if (!target) throw new Error("A farm object is no longer available");
			resolve(target.key).write(write);
		}
		state.watering = prepared.provenance;
		state.today = id;
	};
	if (edit.type === "calendar-date") {
		const { change } = edit;
		if (
			!Object.keys(change).length ||
			Object.keys(change).some(
				(key) => !["year", "season", "day"].includes(key),
			)
		)
			throw new Error("Choose a calendar date field");
		if (
			"year" in change &&
			(!Number.isInteger(change.year) ||
				Number(change.year) < 1 ||
				Number(change.year) > MAX_YEAR)
		)
			throw new Error(`The year must be from 1 to ${MAX_YEAR}`);
		if (
			"day" in change &&
			(!Number.isInteger(change.day) ||
				Number(change.day) < 1 ||
				Number(change.day) > DAYS_PER_SEASON)
		)
			throw new Error(`The day must be from 1 to ${DAYS_PER_SEASON}`);
		if ("season" in change && !SEASONS.includes(change.season as Season))
			throw new Error("Choose a valid season");
		state.date = dateInRange({ ...state.date, ...change });
		writeCalendarDate(game, state.date);
		state.daysPlayed = totalDays(state.date) + 1;
		const weather = planCalendarWeather({
			date: state.date,
			daysPlayed: state.daysPlayed,
			gameId: Number(game.uniqueIDForThisGame),
			legacyRandom: game.useLegacyRandom === true,
			choices: state.choices,
		});
		if (weather.today !== state.today) writeToday(weather.today);
		if (weather.tomorrow !== state.tomorrow) {
			writeCalendarTomorrow(game, weather.tomorrow);
			state.tomorrow = weather.tomorrow;
		}
	} else {
		const tomorrow = edit.day === "tomorrow";
		if (edit.day !== "today" && !tomorrow)
			throw new Error("Choose today or tomorrow");
		const forced = fixed(game, state, tomorrow);
		const date = tomorrow ? nextDay(state.date) : state.date;
		const allowed: WeatherId[] = forced
			? [forced.weather]
			: seasonWeathers(date.season).filter(
					(id) => tomorrow || id !== "GreenRain",
				);
		if (!allowed.includes(edit.value as WeatherId))
			throw new Error(forced?.reason ?? "Weather is not allowed on this date");
		if (tomorrow) {
			if (!forced) state.choices = { ...state.choices, tomorrow: edit.value };
			writeCalendarTomorrow(game, edit.value);
			state.tomorrow = edit.value;
		} else {
			if (!forced) state.choices = { ...state.choices, today: edit.value };
			writeToday(edit.value);
		}
	}
	return { game, state };
}
