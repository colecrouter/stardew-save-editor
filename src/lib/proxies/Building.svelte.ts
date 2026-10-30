import buildings from "$generated/buildings.json";
import {
	type AnimalOption,
	animalOptions,
	buildingTierBlocker,
	changeBuildingTier,
	purchasedAnimalTopic,
	type UnplacedItem,
	upgradeTiers,
} from "$lib/animalBuildings";
import { FarmAnimal, newAnimalId } from "$lib/proxies/FarmAnimal.svelte";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";

import type { Building as BuildingType } from "$types/save";
import { type DataProxy, Raw } from ".";

/** Generated building info, with every upgrade field typed (each building only has some) */
export type { BuildingInfo } from "../animalBuildings.ts";
import type { BuildingInfo } from "../animalBuildings.ts";

export class Building implements DataProxy<BuildingType> {
	[Raw]: BuildingType;
	#context: SaveProxy;
	#type = $state<string>();
	/** The building's own interior (not the farmhouse's, which is a separate location) */
	#indoors = $state<GameLocation>();

	constructor(building: BuildingType, context: SaveProxy) {
		this[Raw] = building;
		this.#context = context;
		this.#type = this[Raw].buildingType;
		// Made once, so its animals and their edits stay in sync with the save
		this.#indoors =
			this[Raw].indoors && new GameLocation(this[Raw].indoors, context);
	}

	get data(): BuildingInfo | undefined {
		return buildings.find((b) => b.name === this.#type);
	}

	get indoorLocation() {
		if (this[Raw].buildingType === "Farmhouse") {
			// This building is weird(?) It doesn't contain their own location, unlike farm buildings.
			// Need to find the matching GameLocation in the context
			return this.#context.locations.find((l) => l[Raw].name === "FarmHouse");
		}
		return this.#indoors;
	}

	set indoorLocation(value) {
		if (this[Raw].buildingType === "Farmhouse") {
			if (!value) throw new Error("Value cannot be undefined");

			const index = this.#context.locations.findIndex(
				(l) => l[Raw].name === "FarmHouse",
			);
			this.#context.locations[index] = new GameLocation(
				value[Raw],
				this.#context,
			);
			return;
		}

		this[Raw].indoors = value?.[Raw];
		this.#indoors = value;
	}

	get name() {
		return this.#type;
	}

	// This needs to be typed for some reason
	get repaired(): boolean | undefined {
		if (this[Raw].buildingType !== "Greenhouse") return undefined;

		const farm = this.#context.farm;
		return farm?.[Raw]?.greenhouseUnlocked;
	}

	set repaired(value) {
		if (this[Raw].buildingType !== "Greenhouse")
			throw new Error("Building type not supported");
		if (value === undefined) throw new Error("Value cannot be undefined");

		const farm = this.#context.farm;
		if (!farm) throw new Error("Farm not found");

		farm[Raw].greenhouseUnlocked = value;
	}

	/** Whether animals live here: a coop or barn, of any size */
	get isAnimalHouse() {
		return this.#indoors?.[Raw]["@_xsi:type"] === "AnimalHouse";
	}

	/**
	    Every size this kind of building comes in, smallest first (like Coop, Big
	    Coop, Deluxe Coop). Just the one for a building that can't be upgraded,
	    and none if the editor doesn't know it.
	*/
	get tiers() {
		return upgradeTiers(this.#type);
	}

	/** How many animals can live here (AnimalHouse.animalLimit) */
	get capacity() {
		return (
			this.#indoors?.animalLimit ??
			this.data?.maxOccupants ??
			this[Raw].maxOccupants
		);
	}

	/** IDs of the animals that live here, including any that are outside */
	get residentIds(): readonly string[] {
		return this.#indoors?.animalsThatLiveHere ?? [];
	}

	/** How many of the residents are outside (e.g. on the farm) */
	get animalsOutside() {
		const inside = new Set(
			this.#indoors?.animals.map((a) => String(a[Raw].key.long)),
		);
		return this.residentIds.filter((id) => !inside.has(id)).length;
	}

	/** Is full by AnimalHouse.isFull: residents outside count too */
	get isFull() {
		return this.residentIds.length >= this.capacity;
	}

	get underConstruction() {
		return this[Raw].daysOfConstructionLeft > 0;
	}

	/** The animals that can live in this kind of building, and whether this size can house each */
	get animalOptions(): AnimalOption[] {
		return this.isAnimalHouse ? animalOptions(this.tiers, this.#type) : [];
	}

	/**
	    Add a new animal that lives here, the way buying one from Marnie does
	    (PurchaseAnimalsMenu, then AnimalHouse.adoptAnimal), but free. Like the
	    game, it starts a conversation topic so villagers can mention it.

	    @param owner The player it's bought for
	*/
	adoptAnimal(type: string, name: string, owner: Farmer) {
		const indoors = this.#indoors;
		if (!indoors || !this.isAnimalHouse)
			throw new Error(`Animals can't live in a ${this.#type}`);
		if (this.underConstruction)
			throw new Error(`The ${this.#type} is still being built`);
		const option = this.animalOptions.find((o) => o.type === type);
		if (!option) throw new Error(`A ${type} can't live in a ${this.#type}`);
		if (!option.allowed) throw new Error(`A ${type} ${option.reason}`);
		if (this.isFull)
			throw new Error(
				`The ${this.#type} is full (${this.residentIds.length}/${this.capacity} animals)`,
			);
		const trimmed = name.trim();
		if (!trimmed) throw new Error("The animal needs a name");
		// Utility.areThereAnyOtherAnimalsWithThisName
		if (this.#context.farmAnimals.some((a) => a.name === trimmed))
			throw new Error(`Another animal is already called ${trimmed}`);

		const save = this.#context[Raw].SaveGame;
		const id = newAnimalId(owner.uniqueID, {
			latestId: save.latestID,
			taken: this.#context.farmAnimalIds,
		});
		save.latestID = id;

		const animal = FarmAnimal.fromName(type, trimmed, owner, id);
		indoors.adoptAnimal(animal);
		this.#context.addDialogueEventForEveryone(purchasedAnimalTopic(type));
		// Building.dayUpdate counts the animals inside
		this[Raw].currentOccupants = indoors.animals.length;
		return animal;
	}

	/** Why this building can't be changed to `target`, if it can't */
	tierChangeBlocker(target: BuildingInfo): string | undefined {
		return buildingTierBlocker(this[Raw], target, this.residentIds.length);
	}

	/**
	    Upgrade or downgrade to another tier, changing what the game changes when
	    Robin finishes an upgrade (Building.FinishConstruction): the type, size,
	    doors and capacity; moving things inside out of the way, and adding the
	    new tier's items (like the incubator). It's remembered as built, with the
	    letter and conversation topic that go with it. Upgrades step through each
	    tier in between. A downgrade undoes those steps: it takes the items back
	    out (unless they're in use) and moves things back.

	    @returns Items that couldn't be added, taken out or moved back
	*/
	changeType(target: BuildingInfo): UnplacedItem[] {
		const blocker = this.tierChangeBlocker(target);
		if (blocker) throw new Error(blocker);

		const problems = changeBuildingTier(this[Raw], target, {
			constructed: (name) => this.#context.addConstructedBuilding(name),
			mail: (key) => this.#context.sendMailToEveryone(key),
			topic: (key) => this.#context.addDialogueEventForEveryone(key),
		});
		// Keep the legacy reactive facade aligned with the shared raw transition.
		this.#type = target.name;
		if (this.#indoors && this.isAnimalHouse)
			this.#indoors.animalLimit = target.maxOccupants;
		return problems;
	}
}
