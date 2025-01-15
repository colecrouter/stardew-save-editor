import buildings from "$generated/buildings.json";
import { Building } from "$lib/proxies/Building.svelte";
import { FarmAnimal } from "$lib/proxies/FarmAnimal";
import { Item } from "$lib/proxies/Item";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { isNil, nil } from "$types/nil";
import type { GameLocation as Location } from "$types/save";

export class GameLocation {
    raw: Location;
    #context: SaveProxy;

    constructor(location: Location, context: SaveProxy) {
        this.raw = location;
        this.#context = context;
    }

    get name() {
        return this.raw.name;
    }

    set name(value) {
        this.raw.name = value;
    }

    get buildings() {
        console.log(this.#context);
        return (
            this.raw.buildings?.Building?.map((b) =>
                isNil(b) ? undefined : new Building(b, this.#context),
            ) ?? []
        );
    }

    set buildings(value) {
        this.raw.buildings = value && {
            Building: value.map((b) => (!b ? nil : b.raw)),
        };
    }

    get animals() {
        if (typeof this.raw.animals === "string") return undefined;

        return this.raw.animals?.item.map((a) => new FarmAnimal(a));
    }

    set animals(value) {
        if (!value) {
            this.raw.animals = "";
            this.raw.Animals.SerializableDictionaryOfInt64FarmAnimal = null;
        } else {
            this.raw.animals = value && { item: value.map((a) => a.raw) };
            this.raw.Animals.SerializableDictionaryOfInt64FarmAnimal =
                this.raw.animals;
            this.raw.animalsThatLiveHere = {
                long: value.map((a) => a.raw.key.long),
            };
        }
    }

    get items() {
        // Construct a 2D array of items
        const building = buildings.find((b) => b.name === this.raw.name);

        const { X: width, Y: height } = building?.size ?? { X: 100, Y: 100 };
        const items = Array.from<Item | null>({ length: height }).map(() =>
            Array.from<Item | null>({ length: width }).fill(null),
        );

        for (const { key, value } of this.raw.objects?.item ?? []) {
            const x = key.Vector2.X;
            const y = key.Vector2.Y;

            // Check for out-of-bounds items
            if (x >= width || y >= height || items[y] === undefined) {
                console.warn(`Item out of bounds, skipping: ${x}, ${y}`);
                continue;
            }

            if (value.Object === undefined)
                throw new Error("Item value is undefined");

            items[y][x] = new Item(value.Object);
        }

        return items;
    }

    set items(value) {
        this.raw.objects = {
            item: value
                .flat()
                .filter((i) => i !== null)
                .map((i) => ({
                    key: {
                        Vector2: {
                            X: i.raw.tileLocation?.X ?? 0,
                            Y: i.raw.tileLocation?.Y ?? 0,
                        },
                    },
                    value: { Object: i.raw },
                })),
        };
    }

    get piecesOfHay() {
        return this.raw.piecesOfHay;
    }

    set piecesOfHay(value) {
        this.raw.piecesOfHay = value;
    }
}
