import buildings from "$generated/buildings.json";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { Building as BuildingType } from "$types/save";
import { type DataProxy, Raw } from ".";

export class Building implements DataProxy<BuildingType> {
	[Raw]: BuildingType;
	#context: SaveProxy;
	#name = $state<string>();

	constructor(building: BuildingType, context: SaveProxy) {
		this[Raw] = building;
		this.#context = context;
		this.#name = this[Raw].buildingType;
	}

	get farmBuildingUpgrades() {
		// Each building in buildings.json has a "upgradedFrom" field, which is the name of the building it upgrades from.
		// This maps to a linked list of sorts, where each building has a reference to the building it upgrades from.

		let keyword = this[Raw].buildingType.replace(/(?:Big|Deluxe)\s/, "");
		const upgrades = keyword
			? [buildings.find((b) => b.name === keyword)?.name]
			: [];
		while (keyword) {
			const building = buildings.find((b) => b.upgradedFrom === keyword);
			if (!building) break;
			upgrades.push(building.name);
			keyword = building.name;
		}

		return upgrades;
	}

	get data() {
		return buildings.find((b) => b.name === this[Raw].buildingType);
	}

	get indoorLocation() {
		if (this[Raw].buildingType === "Farmhouse") {
			// This building is weird(?) It doesn't contain their own location, unlike farm buildings.
			// Need to find the matching GameLocation in the context
			return this.#context.locations.find((l) => l[Raw].name === "FarmHouse");
		}
		return this[Raw].indoors && new GameLocation(this[Raw].indoors);
	}

	set indoorLocation(value) {
		if (this[Raw].buildingType === "FarmHouse") {
			if (!value) throw new Error("Value cannot be undefined");

			const index = this.#context.locations.findIndex(
				(l) => l[Raw].name === "FarmHouse",
			);
			this.#context.locations[index] = new GameLocation(value[Raw]);
			return;
		}

		this[Raw].indoors = value?.[Raw];
	}

	get name() {
		return this.#name;
	}

	get upgradeLevel() {
		if (!["Farmhouse", "Cabin"].includes(this[Raw].buildingType))
			return undefined;

		const playerId = this[Raw].indoors?.farmhandReference;
		const player = !playerId
			? this.#context.players[0]
			: this.#context.players.find((p) => p.uniqueID === playerId);
		if (!player) throw new Error("Player not found");

		return player.raw.houseUpgradeLevel;
	}

	get farmUpgradeLevel() {
		return this[Raw].buildingType;
	}

	get homeOf() {
		if (!this[Raw].indoors) return undefined;
		if (!["Farmhouse", "Cabin"].includes(this[Raw].buildingType))
			return undefined;

		return this.#context.players.filter(
			(p) => p && p.raw.homeLocation === this[Raw].indoors?.uniqueName,
		) as Farmer[];
	}

	set homeOf(value) {
		if (!value) throw new Error("Value cannot be undefined");
		if (!["Farmhouse", "Cabin"].includes(this[Raw].buildingType))
			throw new Error("Building type not supported");
		if (!this[Raw].indoors) throw new Error("Building has no indoors");
		if (!this[Raw].indoors.uniqueName)
			throw new Error("Building has no uniqueName");

		for (const player of value) {
			player.raw.homeLocation = this[Raw].indoors.uniqueName;
		}
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
}
