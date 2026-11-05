import generatedGifts from "$generated/gifttastes.json";
import { immutableView } from "./immutable-view.ts";
import { guidanceItem, type GuidanceItem } from "./item-guidance.ts";

interface GeneratedGift {
	name: string;
	item: string;
	items?: string[];
}
interface GeneratedTastes {
	loves: GeneratedGift[];
	universalLoves: GeneratedGift[];
}
const tastes: Readonly<Record<string, GeneratedTastes>> = generatedGifts;
export interface LovedGift extends GuidanceItem {
	/** A grouped recommendation still searches every item it represents. */
	readonly matchingNames: readonly string[];
	readonly tooltip: string;
}
const cache = new Map<string, ReturnType<typeof projectGifts>>();
function projectGifts(name: string) {
	const project = (gifts: readonly GeneratedGift[]) =>
		gifts.map((gift): LovedGift => ({
			...guidanceItem(gift.item),
			name: gift.name,
			matchingNames: [...(gift.items ?? [gift.name])],
			tooltip: gift.items
				? `${gift.name}: ${gift.items.join(", ")}`
				: gift.name,
		}));
	return immutableView({
		loves: project(tastes[name]?.loves ?? []),
		universalLoves: project(tastes[name]?.universalLoves ?? []),
	});
}
const unknownGifts: ReturnType<typeof projectGifts> = immutableView({
	loves: [],
	universalLoves: [],
});
/** Personal and universal recommendations already include the game's taste overrides. */
export function relationshipGifts(name: string) {
	// Only the fixed game catalog belongs in this process-lifetime cache. Modded
	// names from successive saves must not accumulate as retained cache keys.
	if (!Object.hasOwn(tastes, name)) return unknownGifts;
	const existing = cache.get(name);
	if (existing) return existing;
	const projected = projectGifts(name);
	cache.set(name, projected);
	return projected;
}
/** Gift search is read-only and does not add a missing villager to the save. */
export function relationshipMatches(name: string, query: string) {
	const needle = query.trim().toLocaleLowerCase();
	if (name.toLocaleLowerCase().includes(needle)) return true;
	const gifts = relationshipGifts(name);
	return [...gifts.loves, ...gifts.universalLoves].some((gift) =>
		[gift.name, ...gift.matchingNames].some((item) =>
			item.toLocaleLowerCase().includes(needle),
		),
	);
}
