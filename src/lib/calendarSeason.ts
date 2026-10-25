import type { Season as SaveSeason } from "$types/save";

// Checked against each save enum member, without loading an enum runtime in Node.
const value = <T extends SaveSeason>(text: `${T}`): T => text as T;
export const CalendarSeason = {
	Spring: value<SaveSeason.Spring>("spring"),
	Summer: value<SaveSeason.Summer>("summer"),
	Fall: value<SaveSeason.Fall>("fall"),
	Winter: value<SaveSeason.Winter>("winter"),
} as const satisfies {
	readonly [K in keyof typeof SaveSeason]: (typeof SaveSeason)[K];
};
