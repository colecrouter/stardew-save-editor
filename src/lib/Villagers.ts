import villagerData from "$generated/villagers.json";
import type { VillagerInfo } from "$types/wikiVillager";

/** Wiki descriptions for each villager, from `npm run dump:villagers` */
export const Villagers: ReadonlyMap<string, VillagerInfo> = new Map(
	Object.entries(villagerData as Record<string, VillagerInfo>),
);
