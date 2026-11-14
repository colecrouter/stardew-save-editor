import characterNames from "../../../generated/character-names.json";
import { farmers, type Location, type SaveDocument } from "./domain.ts";
import {
	type ItemVisual,
	readItemPresentation,
	resolveItemMetadata,
} from "./item-presentation.ts";
import { isKnownLocation, type KnownLocation } from "./saved-types.ts";

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

type Resident = NonNullable<NonNullable<KnownLocation["characters"]>[number]>;
interface LocatedResident {
	key: string;
	home: KnownLocation;
	resident: Resident;
}

/** Keep addresses separate from names. Traverse only generated location/building
 * contracts; an opaque branch cannot prove that a rename has no collisions. */
function residentGraph(document: SaveDocument) {
	const residents: LocatedResident[] = [];
	let complete = true;
	const seen = new WeakSet<object>();
	function visit(knownLocation: Location | null | undefined, path: string) {
		if (knownLocation == null) return;
		if (!isKnownLocation(knownLocation) || seen.has(knownLocation)) {
			complete = false;
			return;
		}
		seen.add(knownLocation);
		for (const [index, resident] of (
			knownLocation.characters ?? []
		).entries()) {
			if (resident !== null)
				residents.push({
					key: `${path}/characters/${index}`,
					home: knownLocation,
					resident,
				});
		}
		// Farmhand homes are nested building interiors. Saved addresses and null
		// slots retain their original positions throughout this read-only traversal.
		for (const [index, building] of (knownLocation.buildings ?? []).entries()) {
			if (building === null) continue;
			if (building.$type === "$unknown") {
				complete = false;
				continue;
			}
			visit(building.indoors, `${path}/buildings/${index}/indoors`);
		}
	}
	for (const [index, location] of (document.SaveGame.locations ?? []).entries())
		visit(location, `/SaveGame/locations/${index}`);
	return { residents, complete };
}
/** Snapshot-local references used by commands; never exposed as UI state. */
export const inspectResidents = (document: SaveDocument) =>
	residentGraph(document).residents;

/** Missing dictionaries need no defaults. Present dictionaries must have unique
 * text keys before any coordinated rename can safely preserve their entries. */
export function childDictionariesSupported(document: SaveDocument) {
	return farmers(document).every((farmer) =>
		[farmer.friendshipData, farmer.giftedItems].every(
			(dictionary) =>
				dictionary === undefined ||
				new Set(dictionary.map((entry) => entry.key)).size ===
					dictionary.length,
		),
	);
}

/** Projection never fills missing parent IDs: the game has fallback ownership
 * repair, but an editor cannot infer that repair from an ambiguous imported save. */
export function readChildren(document: SaveDocument): ChildView[] {
	const { residents: all, complete } = residentGraph(document);
	const owners = farmers(document);
	const dictionariesSupported = childDictionariesSupported(document);
	return all.flatMap(({ key, home, resident }): ChildView[] => {
		const homeName = home.uniqueName || home.name || "Unknown home";
		if (resident.$type === "$unknown") {
			if (resident.$xmlType.name !== "Child") return [];
			// Only a readable display name crosses the opaque-class boundary. Its
			// apparent age, parent and equipment fields cannot authorize vanilla edits.
			return [
				{
					key,
					home: homeName,
					name: typeof resident.name === "string" ? resident.name : "",
					parent: "Unknown parent",
					appearance: "Unknown appearance",
					hat: {
						present: resident.hat != null,
						name: resident.hat != null ? "Unknown hat" : "No hat",
					},
					supported: false,
					reason: "This custom child class is read-only.",
				},
			];
		}
		if (resident.$type !== "StardewValley.Characters.Child") return [];
		const parentId = resident.idOfParent?.toString();
		const parents = owners.filter(
			(owner) =>
				parentId !== undefined &&
				owner.UniqueMultiplayerID?.toString() === parentId,
		);
		const name = resident.name ?? "";
		// Report the first failed boundary so an opaque class never appears
		// editable merely because its fields resemble those of a vanilla child.
		let reason: string | undefined;
		if (!complete)
			reason =
				"Opaque or repeated home data prevents checking child identities safely.";
		else if (
			!name.trim() ||
			characterNames.includes(name) ||
			all.filter(({ resident: other }) => other.name === name).length !== 1
		)
			reason = "This child has a missing or ambiguous saved name.";
		else if (parentId === undefined || parentId === "0" || parents.length !== 1)
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
		const hatRecord = resident.hat;
		const hatMetadata = resolveItemMetadata(resident.hat);
		return [
			{
				key,
				name,
				parentId,
				home: homeName,
				parent:
					parents.length === 1
						? (parents[0]?.name ?? "Unnamed farmer")
						: "Unknown parent",
				daysOld:
					resident.daysOld !== undefined && resident.daysOld >= 0
						? resident.daysOld
						: undefined,
				appearance: `${resident.gender ?? "Unknown gender"}, ${resident.darkSkinned === true ? "dark skin" : resident.darkSkinned === false ? "light skin" : "unknown skin tone"}`,
				// Portraits describe the stored stage; elapsed days are not simulated.
				// Unknown/custom representations keep their text and a neutral initial.
				stage:
					resident.age !== undefined && resident.age >= 0 && resident.age <= 3
						? resident.age
						: undefined,
				gender: resident.gender,
				darkSkinned: resident.darkSkinned,
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
									hatRecord?.hairDrawType !== undefined
										? hatRecord.hairDrawType !== 0
										: hatMetadata?._type === "Hat"
											? !hatMetadata.showRealHair
											: false,
							},
				supported: reason === undefined,
				reason,
			},
		];
	});
}
