import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { tinyFixture } from "./fixtures.ts";
import { inspectPets } from "../../src/lib/editor/pet-data.ts";

export const catId = "8a408e26-a044-4cba-ade7-1b53565265d0";
export const dogId = "8a408e26-a044-4cba-ade7-1b53565265d1";

/** Resolve a known fixture pet before deliberately corrupting its identity or
 * fields. Missing setup must fail the test, not silently skip a mutation. */
export function fixturePet(document: SaveDocument, id = catId) {
	const pet = inspectPets(document).pets.find((entry) => entry.id === id);
	if (!pet) throw new Error(`Missing fixture pet ${id}`);
	return pet.raw;
}

// Keep GUID, bowl assignment and daily player records distinct. The generated
// model uses arrays, bigint dictionary keys and null for a missing hat/interior.
export function savedPet(guid = catId, name = "Miso") {
	return {
		$type: "StardewValley.Characters.Pet" as const,
		guid,
		name,
		petType: "Cat",
		whichBreed: "0",
		friendshipTowardFarmer: 400,
		homeLocationName: "Farm",
		lastPetDay: [{ key: 1234567890123456789n, value: 23 }],
		grantedFriendshipForPet: true,
		timesPet: 5,
		CurrentBehavior: "Sleep",
		hat: null,
		modData: [{ key: "opaque", value: "007" }],
	};
}

export function withPets(document: SaveDocument = tinyFixture()) {
	// Cover outdoor and nested indoor pets with identical names and distinct IDs.
	// Unknown fields on known classes remain extension data through the codec.
	document.SaveGame.locations = [
		{
			$type: "StardewValley.Farm",
			name: "Farm",
			characters: [
				savedPet(),
				{ $type: "StardewValley.NPC", name: "Robin", future: "keep" },
			],
			buildings: [
				{
					$type: "StardewValley.Buildings.PetBowl",
					buildingType: "Pet Bowl",
					id: "8a408e26-a044-4cba-ade7-1b53565265d2",
					petGuid: catId,
					watered: true,
					indoors: null,
				},
				{
					$type: "StardewValley.Buildings.Building",
					buildingType: "Cabin",
					id: "8a408e26-a044-4cba-ade7-1b53565265d3",
					indoors: {
						$type: "StardewValley.Locations.Cabin",
						name: "Cabin",
						characters: [
							{
								...savedPet(dogId, "Miso"),
								petType: "Dog",
								whichBreed: "custom-breed",
							},
						],
					},
				},
			],
		},
	];
	return document;
}
