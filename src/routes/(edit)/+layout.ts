import type { ObjectInformation, BigCraftable, Boots, Clothing, Furniture, Hat, Weapon, Tool } from "../../types/dump";

export const ssr = false;

// Prefetch dumped data
export const load = async ({ fetch }) => {
    const data = await fetch('/iteminfo.json');

    const Items = new Map<string, ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool>(await data.json() as any);
    return {
        itemData: Items,
    };
};