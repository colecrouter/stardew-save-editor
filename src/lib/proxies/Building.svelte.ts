import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { Building as BuildingType } from "$types/save";
import { type DataProxy, Raw } from ".";

export class Building implements DataProxy<BuildingType> {
	[Raw]: BuildingType;

	public location: GameLocation | undefined;

	constructor(building: BuildingType) {
		this[Raw] = building;

		this.location = $state(
			this[Raw].indoors && new GameLocation(this[Raw].indoors),
		);
		$effect(() => {
			this[Raw].indoors = this.location?.[Raw];
		});
	}
}
