import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import catalog from "../../generated/progress.json";
import sources from "../../static/assets/achievements/sources.json";

it("ships original Steam artwork for both states of every supported saved achievement", () => {
	const mapping = new Map(Object.entries(sources.achievements));
	expect(mapping.size).toBe(catalog.achievements.length);
	for (const award of catalog.achievements) {
		const entry = mapping.get(String(award.id));
		if (!entry) throw new Error(`Missing Steam artwork for ${award.name}`);
		expect(entry.name).toBe(award.name);
		// Greenhorn has a prefixed Steam API key; filenames consistently retain
		// the game's saved ID so artwork cannot shift with Steam's display order.
		expect(entry.steamApiName).toBe(award.id === 0 ? "a0" : String(award.id));
		for (const [state, suffix] of [
			["unlocked", ""],
			["locked", "-locked"],
		] as const) {
			const image = entry[state];
			expect(image.file).toBe(`${award.id}${suffix}.jpg`);
			expect(new URL(image.url).hostname).toBe("shared.fastly.steamstatic.com");
			const bytes = readFileSync(
				new URL(
					`../../static/assets/achievements/${image.file}`,
					import.meta.url,
				),
			);
			// Hashes guard the original downloaded bytes, including the distinct
			// locked variant; the UI must not depend on later Steam/CDN changes.
			expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
			expect(createHash("sha256").update(bytes).digest("hex")).toBe(
				image.sha256,
			);
		}
	}
});
