import { expect, it } from "vitest";
import { CalendarSeason } from "../../src/lib/calendarSeason.ts";
import {
	calendarEventsForMonth,
	readCalendarEventContext,
	type CalendarEventContext,
} from "../../src/lib/editor/calendar-events.ts";
import { parser, fixtureXml, tinyFixture } from "./fixtures.ts";

const context: CalendarEventContext = {
	random: { seed: 390176213, legacy: false },
	birthdays: [],
	desertAccessible: false,
	notes: [],
};

it("projects saved birthdays without modifying the import", () => {
	const document = parser.parse(fixtureXml);
	const before = structuredClone(document);
	const saved = readCalendarEventContext(document);
	const spring = calendarEventsForMonth(
		{ year: 1, season: CalendarSeason.Spring },
		saved,
	);
	expect(spring).toContainEqual({
		day: 7,
		label: "Lewis's birthday",
		kind: "birthday",
		portrait: "Lewis",
	});
	expect(spring).toContainEqual({
		day: 10,
		label: "Vincent's birthday",
		kind: "birthday",
		portrait: "Vincent",
	});
	expect(document).toEqual(before);
});

it("shows every day of passive events and keeps locked Desert dates honest", () => {
	const spring = calendarEventsForMonth(
		{ year: 1, season: CalendarSeason.Spring },
		context,
	);
	expect(
		spring.filter((event) => event.locked).map((event) => event.day),
	).toEqual([15, 16, 17]);
	const accessible = calendarEventsForMonth(
		{ year: 1, season: CalendarSeason.Spring },
		{ ...context, desertAccessible: true },
	);
	expect(
		accessible
			.filter((event) => event.label === "Desert Festival")
			.map((event) => event.day),
	).toEqual([15, 16, 17]);
	expect(spring.find((event) => event.label === "Egg Festival")?.day).toBe(13);
	const winter = calendarEventsForMonth(
		{ year: 1, season: CalendarSeason.Winter },
		context,
	);
	expect(
		winter
			.filter((event) => event.label === "Night Market")
			.map((event) => event.day),
	).toEqual([15, 16, 17]);
	expect(
		winter.filter((event) => event.kind === "derby").map((event) => event.day),
	).toEqual([12, 13]);
});

it("makes Bookseller dates deterministic and independent across month visits and RNG modes", () => {
	const booksellers = (year: number, legacy: boolean) =>
		calendarEventsForMonth(
			{ year, season: CalendarSeason.Fall },
			{ ...context, random: { seed: 390176213, legacy } },
		)
			.filter((event) => event.kind === "bookseller")
			.map((event) => event.day);
	const first = booksellers(1, false);
	expect(first).toHaveLength(2);
	expect(new Set(first).size).toBe(2);
	expect(first.every((day) => [4, 7, 8, 9, 12, 19, 22, 25].includes(day))).toBe(
		true,
	);
	// Interleaving another preview must not advance a shared generator.
	booksellers(5, true);
	expect(booksellers(1, false)).toEqual(first);
	expect(
		new Set(
			[1, 2, 3, 4].flatMap((year) => [
				JSON.stringify(booksellers(year, true)),
				JSON.stringify(booksellers(year, false)),
			]),
		).size,
	).toBeGreaterThan(1);
});

it("deduplicates identical residents, hides secret unmet birthdays and omits conflicting or custom records", () => {
	const document = tinyFixture();
	const npc = (name: string, day: number) => ({
		name,
		birthday_Day: day,
		birthday_Season: "summer",
	});
	Object.assign(document.SaveGame, {
		uniqueIDForThisGame: "12345",
		useLegacyRandom: false,
		locations: {
			GameLocation: [
				{
					characters: {
						NPC: [
							npc("Sam", 17),
							npc("Sam", 17),
							npc("Dwarf", 22),
							npc("Alex", 13),
							npc("Alex", 14),
							npc("Custom NPC", 5),
						],
					},
				},
			],
		},
	});
	let saved = readCalendarEventContext(document);
	expect(saved.birthdays.map((birthday) => birthday.name)).toEqual(["Sam"]);
	expect(saved.notes.some((note) => note.includes("Alex"))).toBe(true);
	Object.assign(document.SaveGame.player, {
		friendshipData: {
			item: { key: { string: "Dwarf" }, value: { Friendship: { Points: 0 } } },
		},
		mailReceived: { string: ["ccVault"] },
	});
	saved = readCalendarEventContext(document);
	expect(saved.birthdays.map((birthday) => birthday.name)).toEqual([
		"Sam",
		"Dwarf",
	]);
	expect(saved.desertAccessible).toBe(true);
});

it("omits unsupported deterministic inputs instead of silently choosing a seed", () => {
	const document = tinyFixture();
	Object.assign(document.SaveGame, {
		uniqueIDForThisGame: "9007199254740993",
		useLegacyRandom: false,
	});
	const saved = readCalendarEventContext(document);
	expect(saved.random).toBeUndefined();
	expect(
		saved.notes.some((note) =>
			note.startsWith("Bookseller dates are unavailable"),
		),
	).toBe(true);
	expect(
		calendarEventsForMonth(
			{ year: 1, season: CalendarSeason.Spring },
			saved,
		).some((event) => event.kind === "bookseller"),
	).toBe(false);
	expect(
		calendarEventsForMonth(
			{ year: Number.NaN, season: CalendarSeason.Spring },
			context,
		),
	).toEqual([]);
});

it("matches the reference Bookseller pair for legacy save 0 in Spring year 1", () => {
	// Utility seeds Random with 11*year + save ID + season index in legacy mode.
	// System.Random(11)'s first sample is 1015591673, so Next(5) is index 2.
	// The paired index is (2 + floor(5/2)) % 5 = 4: Spring days 21 and 25.
	const events = calendarEventsForMonth(
		{ year: 1, season: CalendarSeason.Spring },
		{ ...context, random: { seed: 0, legacy: true } },
	);
	expect(
		events
			.filter((event) => event.kind === "bookseller")
			.map((event) => event.day),
	).toEqual([21, 25]);
});
