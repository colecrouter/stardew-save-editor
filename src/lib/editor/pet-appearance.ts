import data from "$generated/pets.json";

// The asset pipeline owns this compact catalog. Keep its UI contract beside
// the consuming feature rather than importing generator implementation code.
export interface PetAppearanceData {
	petType: string;
	breedId: string;
	icon: { sheet: string; x: number; y: number };
}

// Use the complete pair as a selector value. One discrete choice updates both
// saved fields atomically, so changing species cannot leave an invalid breed.
export const petAppearanceKey = (petType: string, breedId: string) =>
	JSON.stringify([petType, breedId]);

export const petAppearances = (data satisfies PetAppearanceData[]).map(
	(entry) => ({
		...entry,
		value: petAppearanceKey(entry.petType, entry.breedId),
		label: `${entry.petType} — breed ${entry.breedId}`,
	}),
);
