export interface PetAppearanceData {
	petType: string;
	breedId: string;
	icon: { sheet: string; x: number; y: number };
}

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/** Extract the vanilla appearance pairs from Data/Pets. Breed IDs are opaque
 * strings, not array positions; never infer the range from a count. */
export function generatePetAppearances(source: unknown): PetAppearanceData[] {
	if (!record(source)) throw new Error("Expected a Data/Pets dictionary.");
	const appearances: PetAppearanceData[] = [];
	for (const petType of ["Cat", "Dog", "Turtle"]) {
		const data = source[petType];
		if (
			!record(data) ||
			!Array.isArray(data.Breeds) ||
			data.Breeds.length === 0
		)
			throw new Error(`Missing breeds for ${petType}.`);
		const seen = new Set<string>();
		for (const breed of data.Breeds) {
			// Appearance editing is independent of adoption/character creation.
			// Include turtles even though CanBeChosenAtStart is false.
			if (
				!record(breed) ||
				typeof breed.Id !== "string" ||
				!breed.Id ||
				seen.has(breed.Id)
			)
				throw new Error(`Invalid or duplicate ${petType} breed ID.`);
			seen.add(breed.Id);
			const rect = breed.IconSourceRect;
			if (
				!record(rect) ||
				rect.Width !== 16 ||
				rect.Height !== 16 ||
				typeof rect.X !== "number" ||
				!Number.isSafeInteger(rect.X) ||
				rect.X < 0 ||
				typeof rect.Y !== "number" ||
				!Number.isSafeInteger(rect.Y) ||
				rect.Y < 0
			)
				throw new Error(
					`Unsupported icon rectangle for ${petType}/${breed.Id}.`,
				);
			// These are the two shipped sheets copied by the dump. Fail explicitly
			// if game metadata changes instead of publishing broken icon URLs.
			if (
				breed.IconTexture !== "LooseSprites\\Cursors" &&
				breed.IconTexture !== "LooseSprites\\Cursors_1_6"
			)
				throw new Error(`Unsupported icon sheet for ${petType}/${breed.Id}.`);
			appearances.push({
				petType,
				breedId: breed.Id,
				icon: {
					sheet: `/assets/${breed.IconTexture.slice("LooseSprites\\".length)}.png`,
					x: rect.X,
					y: rect.Y,
				},
			});
		}
	}
	return appearances;
}
