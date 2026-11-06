import { createFarmAnimal, newAnimalId } from "../farmAnimalData.ts";
export { newAnimalId } from "../farmAnimalData.ts";
import animals from "$generated/farmanimals.json";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { type AnimalsKV, type Gender } from "$types/save";
import { type DataProxy, Dispose, Raw } from ".";

const MAX_FRIENDSHIP = 1000;
const FRIENDSHIP_PER_HEART = 200;

/**
 * Represents the different types of farm animals.
 *
 * @todo slime hutch
 */
export enum FarmAnimalType {
	WhiteChicken = "White Chicken",
	BrownChicken = "Brown Chicken",
	BlueChicken = "Blue Chicken",
	VoidChicken = "Void Chicken",
	GoldChicken = "Golden Chicken",
	Duck = "Duck",
	Rabbit = "Rabbit",
	Dino = "Dinosaur",
	WhiteCow = "White Cow",
	BrownCow = "Brown Cow",
	Goat = "Goat",
	Sheep = "Sheep",
	Pig = "Pig",
	Ostrich = "Ostrich",
}

/**
 * Represents a farm animal.
 */
export class FarmAnimal implements DataProxy<AnimalsKV> {
	public [Raw]: AnimalsKV;
	public [Dispose]?: () => void;

	/** Personal name of the animal */
	public name: string;
	public gender: Gender;
	#daysOwned = $state(0);
	public friendshipTowardFarmer: number;
	/** Current happiness level of the animal (0-47?) */
	public happiness: number;
	/** Fullness level of the animal (0-255) */
	public fullness: number;
	/** `UniqueMultiplayerID` of the player who owns this animal */
	public ownerID: number;
	/** Whether it may get pregnant: the toggle on its info menu, for animals that {@link canReproduce} */
	public allowReproduction: boolean;
	/** Whether it has eaten a Golden Animal Cracker, which doubles its produce */
	public hasEatenAnimalCracker: boolean;

	public readonly type: FarmAnimalType;

	constructor(raw: AnimalsKV) {
		this[Raw] = raw;

		// Initialize reactive state from raw animal
		const animal = this[Raw].value.FarmAnimal;
		this.name = $state(animal.name);
		$effect(() => {
			animal.name = this.name;
			animal.displayName = this.name;
		});

		this.gender = $state(animal.Gender);
		$effect(() => {
			animal.Gender = this.gender;
		});

		// -1 means "not counted yet"; the game then uses the animal's age (FarmAnimal.GetDaysOwned)
		this.#daysOwned = animal.daysOwned < 0 ? animal.age : animal.daysOwned;

		this.friendshipTowardFarmer = $state(animal.friendshipTowardFarmer);
		$effect(() => {
			animal.friendshipTowardFarmer = this.friendshipTowardFarmer;
		});

		this.happiness = $state(animal.happiness);
		$effect(() => {
			animal.happiness = this.happiness;
		});

		this.fullness = $state(animal.fullness);
		$effect(() => {
			animal.fullness = this.fullness;
		});

		this.ownerID = $state(animal.ownerID);
		$effect(() => {
			animal.ownerID = this.ownerID;
		});

		// The game's defaults, if a save leaves them out
		this.allowReproduction = $state(animal.allowReproduction ?? true);
		$effect(() => {
			animal.allowReproduction = this.allowReproduction;
		});

		this.hasEatenAnimalCracker = $state(animal.hasEatenAnimalCracker ?? false);
		$effect(() => {
			animal.hasEatenAnimalCracker = this.hasEatenAnimalCracker;
		});

		this.type = $derived(animal.type as FarmAnimalType);
	}

	get daysOwned() {
		return this.#daysOwned;
	}

	/** Also sets the animal's age, so it grows up accordingly */
	set daysOwned(value: number) {
		// Only written when edited, so loading a save never changes an animal's age
		this.#daysOwned = value;
		const animal = this[Raw].value.FarmAnimal;
		animal.daysOwned = value;
		animal.age = value;
	}

	/** The game's data for this kind of animal, unless it's one the editor doesn't know */
	get data() {
		return animals.find((a) => a.name === this.type);
	}

	/** Whether this kind of animal can get pregnant (cows, goats, sheep and pigs) */
	get canReproduce() {
		return this.data?.canReproduce ?? false;
	}

	/** Whether this kind of animal will eat a Golden Animal Cracker (all but pigs) */
	get canEatGoldenCrackers() {
		return this.data?.canEatGoldenCrackers ?? false;
	}

	get maxFriendship() {
		return MAX_FRIENDSHIP;
	}

	get hearts() {
		return Math.floor(this.friendshipTowardFarmer / FRIENDSHIP_PER_HEART);
	}

	set hearts(value: number) {
		this.friendshipTowardFarmer = Math.max(
			0,
			Math.min(MAX_FRIENDSHIP, value * FRIENDSHIP_PER_HEART),
		);
	}

	/**
	    A newly bought animal, as `new FarmAnimal(type, id, ownerID)` makes it,
	    with its fields in the order the game saves them. It still needs a home;
	    see `Building.adoptAnimal`.

	    @param owner The player buying it
	    @param id A new ID; see {@link newAnimalId}
	*/
	static fromName(
		type: FarmAnimalType | string,
		name: string,
		owner: Farmer,
		id = newAnimalId(owner.uniqueID),
	) {
		const raw = createFarmAnimal(type, name, owner.uniqueID, id);

		let animal!: FarmAnimal;
		const dispose = $effect.root(() => {
			animal = new FarmAnimal(raw);
		});
		animal[Dispose] = dispose;
		return animal;
	}
}
