import {
	tinyEditorFixture,
	exportDocument,
	parser,
} from "../helpers/editor-document.ts";
import { readChildren } from "../../src/lib/editor/children-data.ts";

/** Two homes exercise host and offline-farmhand references without a full save.
 * Normalize through the production codec so equality checks include XML reality. */
export function childrenFixture() {
	const document = tinyEditorFixture();
	const child = {
		$type: "StardewValley.Characters.Child" as const,
		name: "Juniper",
		idOfParent: 1n,
		daysOld: 64,
		age: 3,
		gender: "Female",
		darkSkinned: true,
		hat: { $type: "StardewValley.Objects.Hat" as const, itemId: "0", which: 0 },
		modData: [{ key: "example/keep", value: "007" }],
	};
	document.SaveGame.locations = [
		{
			$type: "StardewValley.Locations.FarmHouse",
			name: "FarmHouse",
			cribStyle: 1,
			characters: [child],
		},
		{
			$type: "StardewValley.Farm",
			name: "Farm",
			buildings: [
				{
					$type: "StardewValley.Buildings.Building",
					buildingType: "Log Cabin",
					indoors: {
						$type: "StardewValley.Locations.Cabin",
						name: "Cabin",
						uniqueName: "Cabin_guest",
						cribStyle: 1,
						characters: [{ ...child, name: "Rowan", idOfParent: 2n }],
					},
				},
			],
		},
	];
	for (const [index, farmer] of [
		document.SaveGame.player,
		...document.SaveGame.farmhands,
	].entries()) {
		farmer.friendshipData = [
			{
				key: "Juniper",
				value: { Points: 250 + index, TalkedToToday: true, opaque: "007" },
			},
			{ key: "Abigail", value: { Points: 99, Status: "Friendly" } },
		];
		farmer.giftedItems = [
			{ key: "Juniper", value: [{ key: "194", value: 3 }] },
		];
	}
	return parser.parse(exportDocument(document));
}

export function renameRequest(document = childrenFixture(), newName = "Hazel") {
	const child = readChildren(document)[0];
	if (!child?.parentId) throw Error("Missing child fixture");
	return {
		key: child.key,
		name: child.name,
		parentId: child.parentId,
		newName,
	};
}
