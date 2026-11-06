/** Catalog-only rules shared by legacy and v2. Importing these does not load the item factory. */
import buildings from "$generated/buildings.json";
import farmAnimals from "$generated/farmanimals.json";
import type { BuildingUpgradeData } from "$types/buildingUpgrade";
import type { Building } from "$types/save";
export type BuildingInfo = (typeof buildings)[number] & BuildingUpgradeData;
const allBuildings = buildings as BuildingInfo[];

/**
    Every tier of the building family `type` belongs to, from the first one
    built to the last upgrade (e.g. Coop, Big Coop, Deluxe Coop). Each tier
    names the one it upgrades (`BuildingToUpgrade` in Data/Buildings).
*/
export function upgradeTiers(type: string | undefined): BuildingInfo[] {
	let base = allBuildings.find((b) => b.name === type);
	if (!base) return [];
	const tiers = [base];
	while (base.buildingToUpgrade) {
		const previous = allBuildings.find(
			(b) => b.name === base?.buildingToUpgrade,
		);
		if (!previous || tiers.includes(previous)) break;
		tiers.unshift(previous);
		base = previous;
	}
	for (;;) {
		const top = tiers.at(-1);
		const next = allBuildings.find((b) => b.buildingToUpgrade === top?.name);
		if (!next || tiers.includes(next)) break;
		tiers.push(next);
	}
	return tiers;
}

export interface AnimalOption {
	type: string;
	/** Whether this tier of building can house it */
	allowed: boolean;
	/** Why not, when it can't */
	reason?: string;
}

/**
    The animals that can live in a building (by `ValidOccupantTypes`, as
    `FarmAnimal.CanLiveIn` checks), and whether this tier is big enough for
    each one: Marnie only sells an animal for its `RequiredBuilding` or an
    upgrade of it. Animals with no required building need just the first tier.
*/
export function animalOptions(
	tiers: readonly BuildingInfo[],
	current: string | undefined,
): AnimalOption[] {
	const tier = tiers.findIndex((t) => t.name === current);
	const houses = tiers[tier]?.validOccupantTypes ?? [];
	return farmAnimals
		.filter((animal) => houses.includes(animal.house))
		.map((animal) => {
			const required = animal.requiredBuilding ?? tiers[0]?.name;
			const index = tiers.findIndex((t) => t.name === required);
			return index !== -1 && index <= tier
				? { type: animal.name, allowed: true }
				: { type: animal.name, allowed: false, reason: `needs a ${required}` };
		});
}

/** "Duck", or "Duck 2", "Duck 3"... whichever isn't taken */
export function defaultAnimalName(type: string, taken: ReadonlySet<string>) {
	if (!taken.has(type)) return type;
	for (let n = 2; ; n++) if (!taken.has(`${type} ${n}`)) return `${type} ${n}`;
}

/**
    The conversation topic for buying an animal (AnimalHouse.adoptAnimal). It
    goes by the animal's display type, which in English is its name, except
    that white and brown chickens are both just "Chicken".
*/
export function purchasedAnimalTopic(type: string) {
	const displayType =
		type === "White Chicken" || type === "Brown Chicken" ? "Chicken" : type;
	return `purchasedAnimal_${displayType}`;
}

/** Why a family-tier transition cannot proceed. Outside residents count toward capacity. */
export function buildingTierBlocker(
	raw: Building,
	target: BuildingInfo,
	residents: number,
): string | undefined {
	const tiers = upgradeTiers(raw.buildingType);
	const from = tiers.findIndex((t) => t.name === raw.buildingType);
	const to = tiers.findIndex((t) => t.name === target.name);
	if (from === -1 || to === -1)
		return `A ${raw.buildingType} can't become a ${target.name}`;
	if (raw.daysOfConstructionLeft > 0)
		return `The ${raw.buildingType} is still being built`;
	if (raw.daysUntilUpgrade > 0)
		return `Robin is already upgrading the ${raw.buildingType}`;
	const limit = target.maxOccupants;
	if (to < from && residents > limit)
		return `${residents} animals live here; a ${target.name} holds ${limit}`;
	return undefined;
}
