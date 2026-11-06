import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { imageDimensionsFromData } from "image-dimensions";
import { generatePetAppearances } from "../codegen/pets.ts";
import appearances from "../generated/pets.json";

function source() {
	const breed = {
		Id: "opaque.breed",
		IconTexture: "LooseSprites\\Cursors_1_6",
		IconSourceRect: { X: 256, Y: 365, Width: 16, Height: 16 },
		CanBeChosenAtStart: false,
		CanBeAdoptedFromMarnie: false,
	};
	return {
		Cat: { Breeds: [{ ...breed }] as [typeof breed] },
		Dog: { Breeds: [{ ...breed }] as [typeof breed] },
		Turtle: { Breeds: [{ ...breed }] as [typeof breed] },
	};
}

describe("pet appearance extraction", () => {
	it("keeps opaque breed IDs and includes appearances unavailable as starter/adopted pets", () => {
		const result = generatePetAppearances(source());
		expect(result.map((entry) => [entry.petType, entry.breedId])).toEqual([
			["Cat", "opaque.breed"],
			["Dog", "opaque.breed"],
			["Turtle", "opaque.breed"],
		]);
		expect(result[2]?.icon).toEqual({
			sheet: "/assets/Cursors_1_6.png",
			x: 256,
			y: 365,
		});
	});
	it("rejects duplicate IDs instead of publishing ambiguous selector options", () => {
		const input = source();
		input.Cat.Breeds.push({ ...input.Cat.Breeds[0] });
		expect(() => generatePetAppearances(input)).toThrow("duplicate Cat breed");
	});
	it("rejects missing species and icon assets that the dump cannot supply", () => {
		expect(() => generatePetAppearances({})).toThrow("Missing breeds");
		const input = source();
		input.Dog.Breeds[0].IconTexture = "Mods/unknown";
		expect(() => generatePetAppearances(input)).toThrow(
			"Unsupported icon sheet",
		);
	});
	it("validates committed icon rectangles against the actual shipped sheets", () => {
		// Catch mismatched sheets or accidentally cropped coordinates without
		// needing a local game installation or network access in CI.
		const dimensions = new Map<string, { width: number; height: number }>();
		for (const entry of appearances) {
			const sheet = entry.icon.sheet;
			if (!dimensions.has(sheet)) {
				const size = imageDimensionsFromData(
					readFileSync(resolve("static", sheet.slice(1))),
				);
				if (!size) throw new Error(`Unreadable icon sheet ${sheet}`);
				dimensions.set(sheet, size);
			}
			const size = dimensions.get(sheet);
			if (!size) throw new Error(`Missing dimensions for ${sheet}`);
			expect(entry.icon.x).toBeGreaterThanOrEqual(0);
			expect(entry.icon.y).toBeGreaterThanOrEqual(0);
			expect(entry.icon.x + 16).toBeLessThanOrEqual(size.width);
			expect(entry.icon.y + 16).toBeLessThanOrEqual(size.height);
		}
	});
});
