import buildings from "$generated/buildings.json";
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

	get data() {
		return buildings.find((b) => b.name === this[Raw].buildingType);
	}

	get indoorLocation() {
		if (this[Raw].buildingType === "Farmhouse") {
			// This building is weird(?) It doesn't contain their own location, unlike farm buildings.
			// Need to find the matching GameLocation in the context
			return this.#context.locations.find((l) => l[Raw].name === "FarmHouse");
		}
		return (
			this[Raw].indoors && new GameLocation(this[Raw].indoors, this.#context)
		);
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
	}

	get name() {
		return this.#name;
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
