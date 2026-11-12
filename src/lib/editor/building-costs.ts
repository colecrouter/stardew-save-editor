import buildings from "$generated/buildings.json";
import { guidanceItem } from "./item-guidance.ts";
import { immutableView } from "./immutable-view.ts";

// Definitions are safe to index during module loading. Resolve their drawings
// only when requested: item presentation also imports building/domain code, so
// eagerly calling it here would observe partially initialized modules.
const definitions = new Map(
	buildings.map((building) => [building.name, building]),
);
function describe(building: (typeof buildings)[number]) {
	// Editor upgrades never spend this descriptive in-game gold/material list.
	return immutableView({
		gold: "buildCost" in building ? building.buildCost : undefined,
		materials:
			"buildMaterials" in building
				? building.buildMaterials.map((material) => ({
						...guidanceItem(material.item),
						amount: material.amount,
					}))
				: [],
	});
}
const cache = new Map<string, ReturnType<typeof describe>>();
/** Unknown/modded buildings have no invented construction price. */
export function buildingConstructionCost(name: string) {
	const building = definitions.get(name);
	if (!building) return undefined;
	const existing = cache.get(name);
	if (existing) return existing;
	const result = describe(building);
	cache.set(name, result);
	return result;
}
