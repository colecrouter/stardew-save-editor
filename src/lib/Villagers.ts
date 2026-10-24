// Villager descriptions aren't in the game files. `wiki/villagers.json` is copied
// by hand from the Stardew Valley Wiki (https://stardewvalleywiki.com, the intro
// of each villager's page), licensed under CC BY-NC-SA 3.0. It isn't fetched by a
// script because the wiki sits behind Cloudflare, so edit it by hand.
import villagerData from "$lib/wiki/villagers.json";

export interface VillagerInfo {
	/** First paragraph of the villager's wiki page, as plain text */
	description: string;
}

/** Wiki descriptions for each villager */
export const Villagers: ReadonlyMap<string, VillagerInfo> = new Map(
	Object.entries(villagerData as Record<string, VillagerInfo>),
);
