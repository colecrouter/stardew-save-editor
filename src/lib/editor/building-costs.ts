import buildings from "$generated/buildings.json";
import { guidanceItem } from "./item-guidance.ts";
import { immutableView } from "./immutable-view.ts";

// Keep descriptive construction prices separate from paid in-game purchases.
// An editor upgrade changes saved progression; it never spends this gold/material list.
const construction = new Map(
	buildings.map((building) => [
		building.name,
		immutableView({
			gold: "buildCost" in building ? building.buildCost : undefined,
			materials:
				"buildMaterials" in building
					? building.buildMaterials.map((material) => ({
							...guidanceItem(material.item),
							amount: material.amount,
						}))
					: [],
		}),
	]),
);
/** Unknown/modded buildings have no invented construction price. */
export const buildingConstructionCost = (name: string) =>
	construction.get(name);
