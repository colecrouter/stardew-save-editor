import data from "$generated/pets.json";
import type { PetAppearanceData } from "../../../codegen/pets.ts";

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

/** The codec reads numeric breed IDs as numbers. Project the game's string ID
 * without rewriting the imported scalar representation during inspection. */
export function savedBreedId(value: unknown): string | undefined {
	return typeof value === "string"
		? value
		: typeof value === "number" && Number.isSafeInteger(value)
			? String(value)
			: undefined;
}
