import animals from "$generated/farmanimals.json";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { type AnimalsKV, Gender } from "$types/save";
import { type DataProxy, Raw } from ".";

// function getRandomLong() {
//     const array = new Uint32Array(2);
//     window.crypto.getRandomValues(array);
//     // return (BigInt(array?.[0] ?? 0) << 32n) | BigInt(array?.[1] ?? 0);
//     return `${array[0]}${array[1]}`;
// }

function getRandomInt() {
	return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

export class FarmAnimal implements DataProxy<AnimalsKV> {
	public [Raw]: AnimalsKV;

	public name: string;
	public gender: Gender;
	public daysOwned: number;
	public happiness: number;
	public ownerID: number;

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

		this.daysOwned = $state(animal.daysOwned);
		$effect(() => {
			animal.daysOwned = this.daysOwned;
			animal.age = this.daysOwned;
		});

		this.happiness = $state(animal.happiness);
		$effect(() => {
			animal.happiness = this.happiness;
		});

		this.ownerID = $state(animal.ownerID);
		$effect(() => {
			animal.ownerID = this.ownerID;
		});
	}

	static fromName(type: string, name: string, farmhand: Farmer) {
		const animal = animals.find((a) => a.name === type);
		if (!animal) throw new Error(`No animal found with name ${type}`);

		// This should be a long, but I don't think I can make fast-xml-parser use a string or bigint
		const newId = getRandomInt();
		const raw: AnimalsKV = {
			key: { long: newId },
			value: {
				FarmAnimal: {
					name,
					displayName: name,
					type,
					age: 0,
					daysOwned: 0,
					health: 3,
					happiness: 8,
					allowReproduction: animal.canReproduce,
					buildingTypeILiveIn: animal.house,
					coloredBorder: false,
					CurrentEmote: 20,
					daysSinceLastLay: 0,
					drawOnTop: false,
					faceAwayFromFarmer: false,
					faceTowardFarmer: false,
					fullness: 0,
					FacingDirection: 0,
					moodMessage: 3,
					flip: false,
					isEmoting: false,
					isEating: false,
					ignoreMovementAnimation: false,
					forceOneTileWide: false,
					friendshipTowardFarmer: 0,
					Gender: Gender.Female,
					glowingTransparency: 0,
					glowRate: 0,
					isGlowing: false,
					hasEatenAnimalCracker: false,
					isCharging: false,
					IsEmoting: false,
					myID: newId,
					ownerID: farmhand.uniqueID,
					parentId: -1,
					Position: {
						// TODO
						X: 0,
						Y: 0,
					},
					produceQuality: 0,
					isSwimming: { boolean: false },
					Scale: 1,
					scale: { float: 1 },
					Speed: 2,
					willDestroyObjectsUnderfoot: false,
					wasAutoPet: false,
					wasPet: false,
				},
			},
		};

		return new FarmAnimal(raw);
	}
}
