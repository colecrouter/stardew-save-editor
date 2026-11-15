import { writeOptionalField } from "../optional-field.ts";
// Locations own buildings, and buildings own interior locations. Keep both
// recursive facades in one module so construction never depends on an import cycle.
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
import { type BaseItemProxy, createItemProxy } from "$lib/proxies/items";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type {
	Building as BuildingType,
	GameLocation as Location,
	Item as SaveItem,
	TileLocation,
} from "$types/save";

import { type DataProxy, Dispose, Raw } from ".";
import type { BuildingInfo } from "../animalBuildings.ts";

export class Building implements DataProxy<BuildingType> {
	[Raw]: BuildingType;
	#context: SaveProxy | undefined;
	#type = $state<string>();
	/** The building's own interior (not the farmhouse's, which is a separate location) */
	#indoors = $state<GameLocation>();

	constructor(building: BuildingType, context?: SaveProxy) {
		this[Raw] = building;
		this.#context = context;
		this.#type = this[Raw].buildingType;
		// Made once, so its animals and their edits stay in sync with the save
		this.#indoors =
			this[Raw].indoors && new GameLocation(this[Raw].indoors, context);
	}

	// Only operations involving the wider save require a context. Standalone
	// interior facades remain usable for local inspection and animal edits.
	private requiredContext(): SaveProxy {
		if (this.#context === undefined)
			throw new Error("Building requires a save context for this operation");
		return this.#context;
	}

	get data(): BuildingInfo | undefined {
		return buildings.find((b) => b.name === this.#type);
	}

	get indoorLocation() {
		if (this[Raw].buildingType === "Farmhouse") {
			// This building is weird(?) It doesn't contain their own location, unlike farm buildings.
			// Need to find the matching GameLocation in the context
			return this.requiredContext().locations.find(
				(l) => l[Raw].name === "FarmHouse",
			);
		}
		return this.#indoors;
	}

	set indoorLocation(value) {
		if (this[Raw].buildingType === "Farmhouse") {
			if (!value) throw new Error("Value cannot be undefined");

			const index = this.requiredContext().locations.findIndex(
				(l) => l[Raw].name === "FarmHouse",
			);
			this.requiredContext().locations[index] = new GameLocation(
				value[Raw],
				this.requiredContext(),
			);
			return;
		}

		writeOptionalField(this[Raw], "indoors", value?.[Raw]);
		this.#indoors = value;
	}

	get name() {
		return this.#type;
	}

	// This needs to be typed for some reason
	get repaired(): boolean | undefined {
		if (this[Raw].buildingType !== "Greenhouse") return undefined;

		const farm = this.requiredContext().farm;
		return farm?.[Raw]?.greenhouseUnlocked;
	}

	set repaired(value) {
		if (this[Raw].buildingType !== "Greenhouse")
			throw new Error("Building type not supported");
		if (value === undefined) throw new Error("Value cannot be undefined");

		const farm = this.requiredContext().farm;
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
		if (!(trimmed !== "")) throw new Error("The animal needs a name");
		// Utility.areThereAnyOtherAnimalsWithThisName
		if (this.requiredContext().farmAnimals.some((a) => a.name === trimmed))
			throw new Error(`Another animal is already called ${trimmed}`);

		const save = this.requiredContext()[Raw].SaveGame;
		const id = newAnimalId(owner.uniqueID, {
			latestId: save.latestID,
			taken: this.requiredContext().farmAnimalIds,
		});
		save.latestID = id;

		const animal = FarmAnimal.fromName(type, trimmed, owner, id);
		indoors.adoptAnimal(animal);
		this.requiredContext().addDialogueEventForEveryone(
			purchasedAnimalTopic(type),
		);
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
		if (blocker != null && blocker !== "") throw new Error(blocker);

		const problems = changeBuildingTier(this[Raw], target, {
			constructed: (name) =>
				this.requiredContext().addConstructedBuilding(name),
			mail: (key) => this.requiredContext().sendMailToEveryone(key),
			topic: (key) => this.requiredContext().addDialogueEventForEveryone(key),
		});
		// Keep the legacy reactive facade aligned with the shared raw transition.
		this.#type = target.name;
		if (this.#indoors && this.isAnimalHouse)
			this.#indoors.animalLimit = target.maxOccupants;
		return problems;
	}
}

/** A list of longs from the save, as strings (big ones are parsed as strings anyway) */
const readLongs = (container: { long: unknown } | "" | undefined) => {
	if (container === undefined || container === "") return [];
	const values = Array.isArray(container.long)
		? container.long
		: [container.long];
	return values.filter((v) => v !== undefined && v !== "").map(String);
};

export class GameLocation implements DataProxy<Location> {
	[Raw]: Location;
	#context: SaveProxy | undefined;

	public buildings: Building[];
	/** Animals that are in this location right now */
	public animals: FarmAnimal[];
	/** AnimalHouse: IDs of the animals that live here, including any that are outside */
	public animalsThatLiveHere: string[];
	/** AnimalHouse: how many animals can live here */
	public animalLimit: number | undefined;
	public items: (BaseItemProxy | null)[][];
	public piecesOfHay: number;

	constructor(location: Location, context?: SaveProxy) {
		this[Raw] = location;
		this.#context = context;

		this.buildings = $state(this.getBuildings());
		$effect(() => this.setBuildings(this.buildings));

		this.animals = $state(this.getAnimals());
		$effect(() => this.setAnimals(this.animals));
		// Adopted animals have effect roots of their own (FarmAnimal.fromName), so end them with the save
		$effect(() => () => {
			for (const animal of this.animals) animal[Dispose]?.();
		});

		this.animalsThatLiveHere = $state(readLongs(this[Raw].animalsThatLiveHere));
		$effect(() => this.setAnimalsThatLiveHere(this.animalsThatLiveHere));

		this.animalLimit = $state(this[Raw].animalLimit);
		$effect(() => {
			if (this.animalLimit !== undefined)
				this[Raw].animalLimit = this.animalLimit;
		});

		this.items = $state(this.getItems());
		// $effect(() => this.setItems(this.items));

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
		return (
			this[Raw].buildings?.Building?.map(
				(b) => new Building(b, this.#context),
			) ?? []
		);
	}

	private setBuildings(value: ReturnType<typeof this.getBuildings>) {
		// Preserve an empty <buildings /> tag to maintain element order in XML
		this[Raw].buildings =
			value.length !== 0 ? { Building: value?.map((b) => b[Raw]) } : {};
	}

	private getAnimals() {
		return this[Raw].animals?.item?.map((a) => new FarmAnimal(a)) ?? [];
	}

	// `animals` and `Animals` are the same dictionary, saved twice. Who lives
	// here is kept separately (animalsThatLiveHere), since residents can be
	// outside; see AnimalHouse.adoptAnimal.
	private setAnimals(value: ReturnType<typeof this.getAnimals>) {
		const animals =
			value.length !== 0 ? { item: value.map((a) => a[Raw]) } : null;

		this[Raw].animals = animals;
		this[Raw].Animals = {
			SerializableDictionaryOfInt64FarmAnimal: animals,
		};
	}

	private setAnimalsThatLiveHere(value: string[]) {
		const current = readLongs(this[Raw].animalsThatLiveHere);
		// Leave it as loaded unless it changed (the parser may have kept small IDs as numbers)
		if (
			current.length === value.length &&
			current.every((id, i) => id === value[i])
		)
			return;
		this[Raw].animalsThatLiveHere =
			value.length !== 0 ? { long: [...value] } : "";
	}

	/** Make an animal live here, and put it inside (AnimalHouse.adoptAnimal) */
	adoptAnimal(animal: FarmAnimal) {
		this.animals.push(animal);
		this.animalsThatLiveHere.push(String(animal[Raw].value.FarmAnimal.myID));
	}

	private getItems() {
		// Construct a 2D array of items
		// A building's interior is named after the building, but isn't its size
		const building = this[Raw].isStructure
			? undefined
			: buildings.find((b) => b.name === this[Raw].name);

		const { X: width, Y: height } = building?.footprint ?? { X: 100, Y: 100 };
		const items = Array.from<BaseItemProxy | null>({ length: height }).map(() =>
			Array.from<BaseItemProxy | null>({ length: width }).fill(null),
		);

		for (const { key, value } of this[Raw].objects?.item ?? []) {
			const x = key.Vector2.X;
			const y = key.Vector2.Y;

			// Check for out-of-bounds items (temporarily disabled to avoid dropping interior objects)
			if (x >= width || y >= height || items[y] === undefined) {
				if (import.meta.env["TEST"] !== true)
					console.warn(`Item out of bounds, skipping: ${x}, ${y}`);
				continue;
			}

			if (value.Object === undefined)
				throw new Error("Item value is undefined");

			items[y][x] = createItemProxy(value.Object);
		}

		return items;
	}

	private setItems(value: ReturnType<typeof this.getItems>) {
		this[Raw].objects = {
			item: value
				.flat()
				.filter((i) => i !== null)
				.map((i) => {
					const tileLocation = (
						i[Raw] as SaveItem & { tileLocation?: TileLocation }
					).tileLocation; // preserve optional property
					return {
						key: {
							Vector2: {
								X: tileLocation?.X ?? 0,
								Y: tileLocation?.Y ?? 0,
							},
						},
						value: { Object: i[Raw] },
					};
				}),
		};
	}
}
