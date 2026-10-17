import giftData from "$generated/gifttastes.json";
import type { VillagerGifts } from "$types/giftTastes";

/** Each villager's loved gifts, from the game's gift tastes (`npm run dump`) */
export const LovedGifts: ReadonlyMap<string, VillagerGifts> = new Map(
	Object.entries(giftData as Record<string, VillagerGifts>),
);

/** The name of everything a villager loves, universal loves included, for searching */
export function lovedGiftNames(villager: string) {
	const gifts = LovedGifts.get(villager);
	if (!gifts) return [];
	return [...gifts.loves, ...gifts.universalLoves].flatMap((gift) => [
		gift.name,
		...(gift.items ?? []),
	]);
}
