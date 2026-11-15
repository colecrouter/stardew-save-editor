import {
	FESTIVALS,
	type GameDate,
	OTHER_FESTIVALS,
	seasonIndex,
	SEASONS,
} from "../calendar.ts";
import { createGameRandom } from "../game-random.ts";
import { characters } from "../NPCs.ts";
import type { SaveDocument } from "./domain.ts";

export interface CalendarEvent {
	readonly day: number;
	readonly label: string;
	readonly kind: "birthday" | "festival" | "bookseller" | "derby";
	/** Only names with bundled vanilla portraits cross the presentation boundary. */
	readonly portrait?: string | undefined;
	readonly locked?: boolean | undefined;
}
export interface CalendarEventContext {
	readonly random?:
		| {
				readonly seed: number;
				readonly legacy: boolean;
		  }
		| undefined;
	readonly birthdays: readonly {
		readonly name: string;
		readonly season: GameDate["season"];
		readonly day: number;
		readonly portrait?: string | undefined;
	}[];
	readonly desertAccessible: boolean | undefined;
	readonly notes: readonly string[];
}
// Data/Characters Calendar policies (vanilla 1.6); all other social villagers in
// NPCs.ts are AlwaysShown. Dates themselves come from the imported resident, so
// modded birthdays of a known villager are not silently replaced with defaults.
// Source metadata: https://github.com/kronosta/stardew-data/blob/main/Data/Characters.json
const hiddenUntilMet = new Set(["Dwarf", "Sandy", "Krobus"]);
const vanilla = new Set<string>(characters);
const safeInteger = (
	value: number | bigint | undefined,
): number | undefined => {
	// RNG helpers use numbers; only exactly representable saved IDs may cross.
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : undefined;
};

/** Inspect calendar context without repairing residents, mail or RNG fields. */
export function readCalendarEventContext(
	document: SaveDocument,
): CalendarEventContext {
	const game = document.SaveGame;
	const host = game.player;
	const notes: string[] = [];
	const seed = safeInteger(game.uniqueIDForThisGame);
	const random =
		seed !== undefined && game.useLegacyRandom !== undefined
			? { seed, legacy: game.useLegacyRandom }
			: undefined;
	if (!random)
		notes.push(
			"Bookseller dates are unavailable because the saved random seed or randomization mode is unsupported.",
		);
	const mail = host.mailReceived ?? [];
	const mailSupported = mail.every((entry) => entry !== null);
	if (!mailSupported)
		notes.push(
			"Desert Festival availability is unknown because saved mail is unsupported.",
		);
	const met = new Set((host.friendshipData ?? []).map((row) => row.key));
	// Only generated residents carry trusted birthday fields. Opaque location
	// payloads cannot establish vanilla NPC semantics from similarly named keys.
	const residents = (game.locations ?? []).flatMap((location) =>
		location != null && location.$type !== "$unknown"
			? (location.characters ?? [])
			: [],
	);
	const candidates = new Map<
		string,
		{ season: GameDate["season"]; day: number }[]
	>();
	for (const resident of residents) {
		if (
			resident === null ||
			resident.$type === "$unknown" ||
			resident.name === undefined ||
			!vanilla.has(resident.name)
		)
			continue;
		const day = safeInteger(resident.birthday_Day);
		const season = SEASONS.find((value) => value === resident.birthday_Season);
		if (day === undefined || day < 1 || day > 28 || !(season !== undefined))
			continue;
		if (hiddenUntilMet.has(resident.name) && !met.has(resident.name)) continue;
		const entries = candidates.get(resident.name) ?? [];
		entries.push({ season, day });
		candidates.set(resident.name, entries);
	}
	// Duplicate resident records are common; identical dates can share one marker.
	// Conflicting copies are ambiguous and must not invent two birthdays.
	const birthdays: CalendarEventContext["birthdays"][number][] = [];
	for (const [name, dates] of candidates) {
		const first = dates[0];
		if (!first) continue;
		if (
			dates.some(
				(date) => date.day !== first.day || date.season !== first.season,
			)
		) {
			notes.push(
				`${name}'s birthday is unavailable because saved resident records disagree.`,
			);
			continue;
		}
		birthdays.push({ name, ...first, portrait: name });
	}
	if (!(birthdays.length > 0))
		notes.push("No supported saved resident birthdays are available.");
	// The calendar is based on saved resident records, not a full simulation of
	// future NPC arrivals or mod-defined calendar queries absent from the save.
	notes.push(
		"Birthdays follow the saved residents. Future arrivals, custom villagers and weddings are not predicted.",
	);
	return {
		random,
		birthdays,
		desertAccessible: mailSupported ? mail.includes("ccVault") : undefined,
		notes,
	};
}

const booksellerDays = {
	spring: [11, 12, 21, 22, 25],
	summer: [9, 12, 18, 25, 27],
	fall: [4, 7, 8, 9, 12, 19, 22, 25],
	winter: [5, 11, 12, 19, 22, 24],
} as const;

/** Billboard.GetEventsForDay and Utility.getDaysOfBooksellerThisSeason, 1.6.
 * Each month owns a fresh seeded generator: viewing consumes no shared state. */
export function calendarEventsForMonth(
	date: Pick<GameDate, "year" | "season">,
	context: CalendarEventContext,
): CalendarEvent[] {
	if (
		!Number.isInteger(date.year) ||
		date.year < 1 ||
		date.year > 9999 ||
		!SEASONS.includes(date.season)
	)
		return [];
	const events: CalendarEvent[] = [];
	for (const festival of [...FESTIVALS, ...OTHER_FESTIVALS]) {
		if (festival.season !== date.season) continue;
		const locked =
			festival.name === "Desert Festival" && context.desertAccessible !== true;
		for (let day = festival.start; day <= festival.end; day++)
			events.push({
				day,
				label: locked
					? context.desertAccessible === undefined
						? "??? — Desert access unavailable"
						: "??? — Desert access required"
					: festival.name,
				kind:
					festival.name === "Trout Derby" || festival.name === "SquidFest"
						? "derby"
						: "festival",
				...(locked ? { locked: true } : {}),
			});
	}
	for (const birthday of context.birthdays)
		if (birthday.season === date.season)
			events.push({
				day: birthday.day,
				label: `${birthday.name}'s birthday`,
				kind: "birthday",
				portrait: birthday.portrait,
			});
	if (context.random) {
		const days = booksellerDays[date.season];
		const random = createGameRandom(
			context.random.legacy,
			date.year * 11,
			context.random.seed,
			seasonIndex(date.season),
		);
		const first = random.next(days.length);
		for (const index of [
			first,
			(first + Math.floor(days.length / 2)) % days.length,
		]) {
			const day = days[index];
			if (day !== undefined)
				events.push({ day, label: "Bookseller visiting", kind: "bookseller" });
		}
	}
	return events.sort((a, b) => {
		// Calendar position sorts first; labels only break ties on the same day.
		const dayOrder = a.day - b.day;
		return dayOrder !== 0 ? dayOrder : a.label.localeCompare(b.label);
	});
}
