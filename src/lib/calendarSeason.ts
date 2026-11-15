import { Season as SaveSeason } from "../../codegen/save.ts";

// Use the enum's actual values through a relative module path so Node tooling
// shares the same season contract without depending on application aliases.
export const CalendarSeason = {
	Spring: SaveSeason.Spring,
	Summer: SaveSeason.Summer,
	Fall: SaveSeason.Fall,
	Winter: SaveSeason.Winter,
} as const;
