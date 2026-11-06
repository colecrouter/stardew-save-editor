import type { Player } from "$types/save";

// The game matches stat keys case-insensitively, so "MasteryExp" and "masteryExp" are one stat
const isStat = (key: string) => (stat: { key: { string: unknown } }) =>
	String(stat.key.string).toLowerCase() === key.toLowerCase();

export const getStatValue = (player: Player, key: string): number =>
	player.stats.Values?.item?.find(isStat(key))?.value.unsignedInt ?? 0;

const UINT_MAX = 4_294_967_295;

/** Set a stat, which the game leaves out when it's 0 (Stats.Set) */
export const setStatValue = (player: Player, key: string, value: number) => {
	// Stats are unsigned ints (Stats.Values); the game can't load anything else
	if (!Number.isInteger(value) || value < 0 || value > UINT_MAX)
		throw new Error(
			`The ${key} stat must be a whole number from 0 to ${UINT_MAX}`,
		);
	// An empty <Values /> parses as ""
	if (typeof player.stats.Values !== "object" || !player.stats.Values)
		player.stats.Values = { item: [] };
	player.stats.Values.item ??= [];
	const stats = player.stats.Values.item;
	const index = stats.findIndex(isStat(key));
	const stat = stats[index];
	if (value === 0) {
		if (stat) stats.splice(index, 1);
	} else if (stat) {
		stat.value.unsignedInt = value;
	} else {
		stats.push({ key: { string: key }, value: { unsignedInt: value } });
	}
};
