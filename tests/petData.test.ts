import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { imageDimensionsFromData } from "image-dimensions";
import appearances from "../generated/pets.json";

describe("committed pet appearance assets", () => {
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
