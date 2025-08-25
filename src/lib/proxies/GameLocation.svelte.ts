import buildings from "$generated/buildings.json";
import { Building } from "$lib/proxies/Building.svelte";
import { FarmAnimal } from "$lib/proxies/FarmAnimal.svelte";
import { Item } from "$lib/proxies/Item.svelte";
import type { GameLocation as Location } from "$types/save";
import { type DataProxy, Raw } from ".";

export class GameLocation implements DataProxy<Location> {
	[Raw]: Location;

	public buildings: Building[];
	public animals: FarmAnimal[];
	public items: (Item | null)[][];
	public piecesOfHay: number;

	constructor(location: Location) {
		this[Raw] = location;

		this.buildings = $state(this.getBuildings());
		$effect(() => this.setBuildings(this.buildings));

		this.animals = $state(this.getAnimals());
		$effect(() => this.setAnimals(this.animals));

		this.items = $state(this.getItems());
		$effect(() => this.setItems(this.items));

		this.piecesOfHay = $state(this[Raw].piecesOfHay);
		$effect(() => {
			this[Raw].piecesOfHay = this.piecesOfHay;
		});
	}

	// Setters must take in a value in order for the constructed effects to run.
	// This is because if we don't read the corresponding $state inside of the $effect, it won't become a dependency.
	// Getters must simply return the wrapped data. They don't need to be reactive.
	// I have arbitrarily decided this is the pattern I will use here.

	private getBuildings() {
		return this[Raw].buildings?.Building?.map((b) => new Building(b)) ?? [];
	}

	private setBuildings(value: ReturnType<typeof this.getBuildings>) {
		this[Raw].buildings = value.length
			? { Building: value?.map((b) => b[Raw]) }
			: undefined;
	}

	private getAnimals() {
		return this[Raw].animals?.item?.map((a) => new FarmAnimal(a)) ?? [];
	}

	private setAnimals(value: ReturnType<typeof this.getAnimals>) {
		if (!value.length) {
			this[Raw].animals = null;
			this[Raw].Animals.SerializableDictionaryOfInt64FarmAnimal = null;
		} else {
			this[Raw].animals = { item: value.map((a) => a[Raw]) };
			this[Raw].Animals.SerializableDictionaryOfInt64FarmAnimal =
				this[Raw].animals;
			this[Raw].animalsThatLiveHere = {
				long: value.map((a) => a[Raw].key.long),
			};
		}
	}

	private getItems() {
		// Construct a 2D array of items
		const building = buildings.find((b) => b.name === this[Raw].name);

		const { X: width, Y: height } = building?.size ?? { X: 100, Y: 100 };
		const items = Array.from<Item | null>({ length: height }).map(() =>
			Array.from<Item | null>({ length: width }).fill(null),
		);

		for (const { key, value } of this[Raw].objects?.item ?? []) {
			const x = key.Vector2.X;
			const y = key.Vector2.Y;

			// Check for out-of-bounds items
			if (x >= width || y >= height || items[y] === undefined) {
				!import.meta.env.TEST &&
					console.warn(`Item out of bounds, skipping: ${x}, ${y}`);
				continue;
			}

			if (value.Object === undefined)
				throw new Error("Item value is undefined");

			items[y][x] = new Item(value.Object);
		}

		return items;
	}

	private setItems(value: ReturnType<typeof this.getItems>) {
		this[Raw].objects = {
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
}
