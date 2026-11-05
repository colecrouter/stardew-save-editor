import { XMLCodec } from "../src/lib/xmlCodec.ts";
import type { SaveDocument } from "../src/lib/editor/domain.ts";

// Keep Node and browser qualification on one deterministic public-derived
// fixture. Existing hashes are a guard against accidentally changing the workload.
export function makeLargeProfileFixture(
	fixtureBytes: Uint8Array,
	extraChests = 250,
) {
	const codec = new XMLCodec();
	const document = codec.parse<SaveDocument>(fixtureBytes);
	const farm = document.SaveGame.locations.GameLocation.find(
		(location) => location.name === "Farm",
	);
	if (!farm) throw new Error("Fixture has no Farm");
	// Objects are a dictionary list in the production fixture. The generated
	// coordinates are unique and fixed; every chest has 36 ordinary item records.
	const items =
		typeof farm.objects === "object" && farm.objects
			? farm.objects.item
			: undefined;
	if (!Array.isArray(items))
		throw new Error("Fixture farm objects are unsupported");
	for (let chest = 0; chest < extraChests; chest++)
		items.push({
			key: { Vector2: { X: 2000 + chest, Y: 2000 } },
			value: {
				Object: {
					"@_xsi:type": "Chest",
					name: "Chest",
					items: {
						Item: Array.from({ length: 36 }, (_, slot) => ({
							"@_xsi:type": "Object",
							itemId: "390",
							name: "Stone",
							stack: 20,
							quality: 0,
							bigCraftable: false,
							modData: {
								fixture: "synthetic",
								slot: String(slot),
								payload: "x".repeat(256),
							},
						})),
					},
				},
			},
		});
	return codec.stringify(document);
}
