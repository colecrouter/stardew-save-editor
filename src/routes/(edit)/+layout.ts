import { base } from "$app/paths";
import type { ItemInformation } from "$types/items";

// Prefetch dumped data
export const load = async ({ fetch }) => {
    const data = await fetch(base + '/iteminfo.json');

    const Items = new Map<string, ItemInformation>(await data.json() as any);
    return {
        itemData: Items,
    };
};