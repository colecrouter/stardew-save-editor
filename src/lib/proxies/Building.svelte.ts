import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { Building as BuildingType } from "$types/save";

export class Building {
	raw: BuildingType;

	constructor(building: BuildingType) {
		this.raw = building;
	}

	get location() {
		return this.raw.indoors && new GameLocation(this.raw.indoors);
	}

	set location(value) {
		this.raw.indoors = value?.raw;
	}
}
