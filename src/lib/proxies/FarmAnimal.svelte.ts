import animals from "$generated/farmanimals.json";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { type AnimalsKV, Gender } from "$types/save";
import { type DataProxy, Dispose, Raw } from ".";

const MAX_FRIENDSHIP = 1000;
const FRIENDSHIP_PER_HEART = 200;

/** `DateTime.UtcNow.Ticks / 10000` at the Unix epoch (milliseconds since 0001-01-01) */
const TICKS_EPOCH_MS = 62_135_596_800_000;

const isLong = (value: unknown) => /^-?\d+$/.test(String(value));

/**
    A new ID for a farm animal, as `Multiplayer.getNewID` makes them: the time in
    milliseconds, 16 bits from the player's ID, then a sequence number that
    counts on from the save's `latestID`. IDs are longs, too big for a number,
    so (like the save parser) they're kept as strings.

    @param taken IDs already in use; they're skipped, in case several animals
        are added within the same millisecond
*/
export function newAnimalId(
	ownerId: number | string,
	{
		latestId,
		taken = new Set(),
		now = Date.now(),
	}: {
		latestId?: number | string;
		taken?: ReadonlySet<string>;
		now?: number;
	} = {},
): string {
	// BigInt() rather than literals, which the legacy build can't transpile
	const big = (value: number | string) =>
		BigInt.asUintN(64, BigInt(isLong(value) ? String(value) : 0));
	const owner = big(ownerId);
	let node = (owner >> BigInt(32)) ^ (owner & BigInt(0xffffffff));
	node = ((node >> BigInt(16)) ^ (node & BigInt(0xffff))) & BigInt(0xffff);
	const timestamp = BigInt(Math.floor(now) + TICKS_EPOCH_MS);

	let sequence =
		latestId === undefined ? 0 : Number(big(latestId) & BigInt(0xff));
	for (let i = 0; i < 256; i++) {
		sequence = (sequence + 1) & 0xff;
		const id = BigInt.asIntN(
			64,
			(timestamp << BigInt(24)) | (node << BigInt(8)) | BigInt(sequence),
		).toString();
		if (!taken.has(id)) return id;
	}
	// Every sequence number for this millisecond is taken; try the next one
	return newAnimalId(ownerId, { latestId, taken, now: now + 1 });
}

const randomInt = (min: number, max: number) =>
	min + Math.floor(Math.random() * (max - min + 1));

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
		const data = animals.find((a) => a.name === type);
		if (!data) throw new Error(`No animal found with name ${type}`);

		const raw: AnimalsKV = {
			key: { long: id as unknown as number },
			value: {
				FarmAnimal: {
					name,
					forceOneTileWide: false,
					isEmoting: false,
					isCharging: false,
					isGlowing: false,
					coloredBorder: false,
					flip: false,
					drawOnTop: false,
					faceTowardFarmer: false,
					ignoreMovementAnimation: false,
					faceAwayFromFarmer: false,
					scale: { float: 1 },
					glowingTransparency: 0,
					glowRate: 0,
					// The game goes by the animal data (or the ID) for gender, not this
					Gender: Gender.Undefined,
					willDestroyObjectsUnderfoot: true,
					// A random spot indoors; the game moves animals somewhere free when you go in
					Position: { X: 64 * randomInt(2, 8), Y: 64 * randomInt(4, 7) },
					Speed: 2,
					FacingDirection: 2,
					IsEmoting: false,
					CurrentEmote: 0,
					Scale: 1,
					isSwimming: { boolean: false },
					friendshipTowardFarmer: 0,
					age: 0,
					daysOwned: 0,
					health: 3,
					produceQuality: 0,
					daysSinceLastLay: 0,
					happiness: 255,
					fullness: 255,
					wasAutoPet: false,
					wasPet: false,
					allowReproduction: true,
					type: data.name,
					buildingTypeILiveIn: data.house,
					myID: id as unknown as number,
					ownerID: owner.uniqueID,
					parentId: -1,
					hasEatenAnimalCracker: false,
					moodMessage: 0,
					isEating: false,
					displayName: name,
				},
			},
		};

		let animal!: FarmAnimal;
		const dispose = $effect.root(() => {
			animal = new FarmAnimal(raw);
		});
		animal[Dispose] = dispose;
		return animal;
	}
}
