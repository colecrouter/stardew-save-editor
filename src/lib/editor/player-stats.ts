import type { T_StardewValley_Farmer as Player } from "../../../generated/save-format/save.ts";

// The game matches stat keys case-insensitively, so "MasteryExp" and "masteryExp" are one stat
const isStat = (key: string) => (stat: { key: unknown }) =>
	String(stat.key).toLowerCase() === key.toLowerCase();

export const getStatValue = (player: Player, key: string): number =>
	player.stats?.Values?.find(isStat(key))?.value ?? 0;

const UINT_MAX = 4_294_967_295;

/** Set a stat, which the game leaves out when it's 0 (Stats.Set) */
export const setStatValue = (player: Player, key: string, value: number) => {
	// Stats are unsigned ints (Stats.Values); the game can't load anything else
	if (!Number.isInteger(value) || value < 0 || value > UINT_MAX)
		throw new Error(
			`The ${key} stat must be a whole number from 0 to ${UINT_MAX}`,
		);
	// Explicit edits can initialize a missing statistics dictionary.
	player.stats ??= {};
	if (!Array.isArray(player.stats.Values)) player.stats.Values = [];

	const stats = player.stats.Values;
	const index = stats.findIndex(isStat(key));
	const stat = stats[index];
	if (value === 0) {
		if (stat) stats.splice(index, 1);
	} else if (stat) {
		stat.value = value;
	} else {
		stats.push({ key, value });
	}
};
