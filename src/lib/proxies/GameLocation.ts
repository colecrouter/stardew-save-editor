import { Building } from "$lib/proxies/Building";
import { FarmAnimal } from "$lib/proxies/FarmAnimal";
import type { GameLocation as Location } from "$types/save";

export class GameLocation {
    raw: Location;

    constructor(location: Location) {
        this.raw = location;
    }

    get buildings() {
        return this.raw.buildings?.Building.map((b) => new Building(b));
    }

    set buildings(value) {
        this.raw.buildings = value && { Building: value.map((b) => b.raw) };
    }

    get animals() {
        return this.raw.animals?.item.map((a) => new FarmAnimal(a));
    }

    set animals(value) {
        if (!value) {
            this.raw.animals = null;
            this.raw.Animals.SerializableDictionaryOfInt64FarmAnimal = null;
        } else {
            this.raw.animals = value && { item: value.map((a) => a.raw) };
            this.raw.Animals.SerializableDictionaryOfInt64FarmAnimal =
                this.raw.animals;
        }
    }
}
