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

// Keep GUID, bowl assignment and daily player records distinct: none are a
// renamed display string or a per-player copy of the shared friendship points.
export function savedPet(guid = catId, name = "Miso") {
	return {
		"@_xsi:type": "Pet",
		guid,
		name,
		petType: "Cat",
		whichBreed: 0,
		friendshipTowardFarmer: 400,
		homeLocationName: "Farm",
		lastPetDay: {
			item: { key: { long: "1234567890123456789" }, value: { int: 23 } },
		},
		grantedFriendshipForPet: true,
		timesPet: 5,
		CurrentBehavior: "Sleep",
		hat: { "@_xsi:nil": "true" },
		modData: { opaque: "007" },
	};
}

export function withPets(document: SaveDocument = tinyFixture()) {
	// Exercise outdoor, nested indoor and singleton character collections in the
	// same save. An unrelated NPC and future fields must survive every operation.
	document.SaveGame.locations = {
		GameLocation: [
			{
				name: "Farm",
				characters: {
					NPC: [
						savedPet(),
						{ "@_xsi:type": "NPC", name: "Robin", future: "keep" },
					],
				},
				buildings: {
					Building: [
						{
							"@_xsi:type": "PetBowl",
							buildingType: "Pet Bowl",
							id: "8a408e26-a044-4cba-ade7-1b53565265d2",
							petGuid: catId,
							watered: true,
							indoors: { "@_xsi:nil": "true" },
						},
						{
							"@_xsi:type": "Building",
							buildingType: "Cabin",
							id: "8a408e26-a044-4cba-ade7-1b53565265d3",
							indoors: {
								name: "Cabin",
								characters: {
									NPC: {
										...savedPet(dogId, "Miso"),
										petType: "Dog",
										whichBreed: "custom-breed",
									},
								},
							},
						},
					],
				},
			},
		],
	};
	return document;
}
