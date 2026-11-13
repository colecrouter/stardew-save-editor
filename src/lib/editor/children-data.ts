import characterNames from "../../../generated/character-names.json";
import { farmers, type SaveDocument } from "./domain.ts";
import {
	type ItemVisual,
	readItemPresentation,
	resolveItemMetadata,
} from "./item-presentation.ts";
import { record } from "./plain-data.ts";

/** Child.dayUpdate increments daysOld, then selects these inclusive thresholds. */
export const childStages = [
	{ label: "Newborn", days: 0 },
	{ label: "Baby", days: 13 },
	{ label: "Crawler", days: 27 },
	{ label: "Toddler", days: 55 },
] as const;
export function childStage(days: number) {
	return days >= 55 ? 3 : days >= 27 ? 2 : days >= 13 ? 1 : 0;
}

export interface ChildView {
	readonly key: string;
	readonly name: string;
	readonly home: string;
	readonly parent: string;
	readonly parentId?: string;
	readonly daysOld?: number;
	readonly appearance: string;
	readonly stage?: number;
	readonly gender?: string;
	readonly darkSkinned?: boolean;
	readonly hat: {
		readonly present: boolean;
		readonly name: string;
		readonly visual?: ItemVisual;
		readonly hideHair?: boolean;
	};
	readonly supported: boolean;
	readonly reason?: string;
}

/** Keep addresses separate from names: a rename changes the friendship key,
 * but must still describe the same resident in review and command validation. */
export function inspectResidents(document: SaveDocument) {
	const residents: {
		key: string;
		home: Record<string, unknown>;
		resident: Record<string, unknown>;
	}[] = [];
	function visit(raw: unknown, path: string) {
		if (!record(raw)) return;
		if (Array.isArray(raw.characters))
			raw.characters.forEach((resident, index) => {
				if (record(resident))
					residents.push({
						key: `${path}/characters/${index}`,
						home: raw,
						resident,
					});
			});
		// Farmhand homes are nested building interiors, including cabins on other
		// supported locations. Walk without repairing or flattening the saved world.
		if (Array.isArray(raw.buildings))
			raw.buildings.forEach((building, index) => {
				if (record(building))
					visit(building.indoors, `${path}/buildings/${index}/indoors`);
			});
	}
	if (document.SaveGame.locations) {
		for (let index = 0; index < document.SaveGame.locations.length; index++) {
			const location = document.SaveGame.locations[index];
			visit(location, `/SaveGame/locations/${index}`);
		}
	}

	return residents;
}

/** Missing dictionaries need no defaults. Present dictionaries must have unique
 * text keys before any coordinated rename can safely preserve their entries. */
export function childDictionariesSupported(document: SaveDocument) {
	return farmers(document).every((farmer) =>
		[farmer.friendshipData, farmer.giftedItems].every(
			(dictionary) =>
				dictionary === undefined ||
				(Array.isArray(dictionary) &&
					dictionary.every(
						(entry) => record(entry) && typeof entry.key === "string",
					) &&
					new Set(dictionary.map((entry) => entry.key)).size ===
						dictionary.length),
		),
	);
}

/** Projection never fills missing parent IDs: the game has fallback ownership
 * repair, but an editor cannot infer that repair from an ambiguous imported save. */
export function readChildren(document: SaveDocument): ChildView[] {
	const all = inspectResidents(document);
	const owners = farmers(document);
	const dictionariesSupported = childDictionariesSupported(document);
	return all
		.filter(
			({ resident }) =>
				resident.$type === "StardewValley.Characters.Child" ||
				(resident.$type === "$unknown" &&
					record(resident.$xmlType) &&
					resident.$xmlType.name === "Child"),
		)
		.map(({ key, home, resident }) => {
			const parentId =
				typeof resident.idOfParent === "bigint"
					? resident.idOfParent.toString()
					: undefined;
			const parents = owners.filter(
				(owner) =>
					parentId !== undefined &&
					owner.UniqueMultiplayerID?.toString() === parentId,
			);
			const name = typeof resident.name === "string" ? resident.name : "";
			// Report the first failed boundary so an opaque class never appears
			// editable merely because its fields resemble those of a vanilla child.
			let reason: string | undefined;
			if (resident.$type !== "StardewValley.Characters.Child")
				reason = "This custom child class is read-only.";
			else if (
				!name.trim() ||
				characterNames.includes(name) ||
				all.filter(({ resident: other }) => other.name === name).length !== 1
			)
				reason = "This child has a missing or ambiguous saved name.";
			else if (
				parentId === undefined ||
				parentId === "0" ||
				parents.length !== 1
			)
				reason = "This child's saved parent is missing or ambiguous.";
			else if (
				home.$type !== "StardewValley.Locations.FarmHouse" &&
				home.$type !== "StardewValley.Locations.Cabin"
			)
				reason = "Renaming children in this location type is unsupported.";
			else if (!dictionariesSupported)
				reason = "A farmer's friendship or gift-history keys are ambiguous.";
			const hat =
				resident.hat == null ? undefined : readItemPresentation(resident.hat);
			const hatRecord = record(resident.hat) ? resident.hat : undefined;
			const hatMetadata = resolveItemMetadata(resident.hat);
			return {
				key,
				name,
				parentId,
				home:
					typeof home.uniqueName === "string" && home.uniqueName
						? home.uniqueName
						: typeof home.name === "string"
							? home.name
							: "Unknown home",
				parent:
					parents.length === 1
						? (parents[0]?.name ?? "Unnamed farmer")
						: "Unknown parent",
				daysOld:
					typeof resident.daysOld === "number" &&
					Number.isSafeInteger(resident.daysOld) &&
					resident.daysOld >= 0
						? resident.daysOld
						: undefined,
				appearance: `${typeof resident.gender === "string" ? resident.gender : "Unknown gender"}, ${resident.darkSkinned === true ? "dark skin" : resident.darkSkinned === false ? "light skin" : "unknown skin tone"}`,
				// Portraits describe the stored stage; elapsed days are not simulated.
				// Unknown/custom representations keep their text and a neutral initial.
				stage:
					resident.$type === "StardewValley.Characters.Child" &&
					typeof resident.age === "number" &&
					Number.isInteger(resident.age) &&
					resident.age >= 0 &&
					resident.age <= 3
						? resident.age
						: undefined,
				gender:
					typeof resident.gender === "string" ? resident.gender : undefined,
				darkSkinned:
					typeof resident.darkSkinned === "boolean"
						? resident.darkSkinned
						: undefined,
				// Present imported hats are projected without rebuilding them; keep is
				// the default action even for custom/unrecognized item metadata.
				hat:
					resident.hat == null
						? { present: false, name: "No hat" }
						: {
								present: true,
								name:
									hat?.name === "Unknown item"
										? "Unknown hat"
										: (hat?.name ?? "Unknown hat"),
								visual: hat?.visual,
								// Child.draw hides the first idle frame's hair whenever the
								// saved hair mode is nonzero. Catalog metadata is a fallback.
								hideHair:
									typeof hatRecord?.hairDrawType === "number"
										? hatRecord.hairDrawType !== 0
										: hatMetadata?._type === "Hat"
											? !hatMetadata.showRealHair
											: false,
							},
				supported: reason === undefined,
				reason,
			};
		});
}
