import animalData from "$generated/farmanimals.json";

import {
	type T_StardewValley_FarmAnimal as FarmAnimal,
	type T_Microsoft_Xna_Framework_Rectangle as Rectangle,
	type T_StardewValley_Buildings_Building as SavedBuilding,
	type T_StardewValley_Objects_Furniture as SavedFurniture,
	type T_StardewValley_Object as SavedObject,
	type T_Microsoft_Xna_Framework_Vector2 as Vector,
} from "../../../generated/save-format/save.ts";
import {
	animalOptions,
	buildingTierBlocker,
	upgradeTiers,
} from "../animalBuildingData.ts";
import { type Building } from "./animal-buildings.ts";
import { buildingConstructionCost } from "./building-costs.ts";
import { type Location, type SaveDocument } from "./domain.ts";
import { nonemptyText, samePlainData } from "./plain-data.ts";
import {
	isKnownLocation,
	type KnownLocation,
	savedType,
} from "./saved-types.ts";

export { isKnownLocation, type KnownLocation } from "./saved-types.ts";

// Saved IDs are decoded Int64 values. Only absence needs handling before
// converting them into display/selection keys.
export const long = (value: bigint | undefined) => value?.toString();

export function residents(interior: KnownLocation | undefined) {
	// Resident semantics belong to AnimalHouse, not a similarly named extension
	// on another location class. Preserve unsupported extension data without edits.
	if (interior && interior.$type !== "StardewValley.AnimalHouse")
		return { ids: [], supported: interior["animalsThatLiveHere"] == null };
	const ids = (interior?.animalsThatLiveHere ?? []).map((value) =>
		value.toString(),
	);
	return { ids, supported: new Set(ids).size === ids.length };
}
/** Keep the mirror as a second serialization of the same dictionary, never a second animal. */
export function animalDictionary(location: KnownLocation) {
	const lower = { entries: location.animals ?? [] };
	const wrapper = location.Animals;
	const upper = { entries: wrapper ?? [] };
	const hasLower = Object.hasOwn(location, "animals");
	const hasUpper = Object.hasOwn(location, "Animals");
	const entries = hasLower ? lower.entries : upper.entries;
	// A nil mirror is not an editable dictionary; conflicting populated mirrors
	// must likewise remain read-only rather than choosing one arbitrarily.
	const supported =
		wrapper !== null &&
		(!hasLower || !hasUpper || samePlainData(lower.entries, upper.entries));
	return { entries, lower, upper, hasLower, hasUpper, supported };
}
export interface LocatedAnimal {
	id?: string | undefined;
	container: KnownLocation;
	location: string;
	raw?: FarmAnimal | undefined;
	mirrors: FarmAnimal[];
	supported: boolean;
}
export interface LocatedBuilding {
	id: string;
	raw: SavedBuilding;
	location: string;
	interior?: KnownLocation | undefined;
	supported: boolean;
}
/** Private DTO lens. Raw references live only as long as the supplied engine snapshot. */
export function inspectBuildings(document: SaveDocument) {
	const buildings: LocatedBuilding[] = [],
		animals: LocatedAnimal[] = [];
	const locations = document.SaveGame.locations ?? [];
	let supported = true;
	const seen = new WeakSet<object>();
	function visit(
		value: Location | null | undefined,
		path: string,
		label: string,
	) {
		if (!isKnownLocation(value) || seen.has(value)) {
			supported = false;
			return;
		}
		seen.add(value);
		const location = value.name ?? label;
		// Mirror equality was checked before pairing by index; a conflicting copy
		// keeps the whole local dictionary read-only instead of choosing a winner.
		const dictionary = animalDictionary(value);
		supported &&= dictionary.supported;
		for (const [index, entry] of dictionary.entries.entries()) {
			const raw = entry.value;
			const id = entry.key.toString();
			const other = dictionary.upper.entries[index];
			const mirror =
				dictionary.hasLower && dictionary.hasUpper && other !== undefined
					? other.value
					: undefined;
			animals.push({
				id,
				raw,
				container: value,
				location,
				mirrors: [...new Set([raw, ...(mirror ? [mirror] : [])])],
				supported:
					dictionary.supported &&
					Boolean(id) &&
					Boolean(raw) &&
					long(raw.myID) === id,
			});
		}
		for (const [index, raw] of (value.buildings ?? []).entries()) {
			if (!raw) {
				supported = false;
				continue;
			}
			// Opaque buildings have no trusted interior or identity. Retain a disabled
			// row instead of interpreting extension fields as generated building data.
			if (raw.$type === "$unknown") {
				supported = false;
				buildings.push({
					id: `building-path:${path}:${index}`,
					raw,
					location,
					supported: false,
				});
				continue;
			}
			const id = nonemptyText(raw.id) ?? undefined;
			const interior = isKnownLocation(raw.indoors) ? raw.indoors : undefined;
			buildings.push({
				id: id ?? `building-path:${path}:${index}`,
				raw,
				location,
				interior,
				supported: Boolean(id) && (raw.indoors == null || Boolean(interior)),
			});
			if (interior) visit(interior, `${path}/building:${index}`, location);
		}
	}
	for (const [index, value] of locations.entries()) {
		visit(value, `location:${index}`, "Unknown location");
	}
	// Real serialized IDs survive list reordering. Ambiguity is visible but never writable.
	for (const building of buildings)
		building.supported &&=
			buildings.filter((row) => row.id === building.id).length === 1;
	for (const animal of animals)
		animal.supported &&=
			animals.filter((row) => row.id === animal.id).length === 1;
	return { buildings, animals, supported };
}

export interface AnimalView {
	id: string;
	name: string;
	nameEditable: boolean;
	type: string;
	location: string;
	outside: boolean;
	supported: boolean;
	reason?: string | undefined;
	daysOwned?: number | undefined;
	friendship?: number | undefined;
	happiness?: number | undefined;
	fullness?: number | undefined;
	gender?: string | undefined;
	reproduction?: boolean | undefined;
	cracker?: boolean | undefined;
	canReproduce: boolean;
	canEatCracker: boolean;
}
export interface BuildingView {
	id: string;
	name: string;
	description?: string | undefined;
	constructionCost?: ReturnType<typeof buildingConstructionCost> | undefined;
	location: string;
	supported: boolean;
	reason?: string | undefined;
	capacity?: number | undefined;
	residents: number;
	outside: number;
	animalHouse: boolean;
	construction: boolean;
	upgrading: boolean;
	repaired?: boolean | undefined;
	tiers: { name: string; reason?: string | undefined }[];
	animalOptions: {
		type: string;
		allowed: boolean;
		reason?: string | undefined;
	}[];
	adoptionReason?: string | undefined;
	animals: AnimalView[];
}
export interface BuildingsView {
	buildings: BuildingView[];
	unhoused: AnimalView[];
}
function projectAnimal(
	animal: LocatedAnimal | undefined,
	id: string,
	outside: boolean,
): AnimalView {
	const raw = animal?.raw;
	const data = animalData.find((row) => row.name === raw?.type);
	// The game treats negative daysOwned as an uninitialized counter and reads
	// age instead. Omitted booleans likewise expose game defaults without writes.
	const days =
		raw?.daysOwned !== undefined
			? raw.daysOwned < 0
				? raw.age
				: raw.daysOwned
			: undefined;
	return {
		id,
		nameEditable: raw?.name !== undefined,
		name: raw?.name ?? (raw ? "Unnamed animal" : "Missing animal"),
		type: raw?.type ?? "Unknown type",
		location: animal?.location ?? "Not found in the save",
		outside,
		supported: Boolean(animal?.supported),
		reason:
			animal?.supported === true
				? undefined
				: "This animal is missing or has ambiguous saved records.",
		daysOwned: days !== undefined && days >= 0 ? days : undefined,
		friendship: raw?.friendshipTowardFarmer,
		happiness: raw?.happiness,
		fullness: raw?.fullness,
		gender:
			raw?.Gender !== undefined &&
			["Male", "Female", "Undefined"].includes(raw.Gender)
				? raw.Gender
				: undefined,
		reproduction: raw?.allowReproduction ?? true,
		cracker: raw?.hasEatenAnimalCracker ?? false,
		canReproduce: data?.canReproduce ?? false,
		canEatCracker: data?.canEatGoldenCrackers ?? false,
	};
}
/** Helpers move only checked object/furniture collections; opaque shapes must not be silently erased. */
export function safeInterior(raw: KnownLocation | null | undefined): boolean {
	if (!raw) return true;
	const vector = (value: Vector | null | undefined) =>
		value != null &&
		value.X !== undefined &&
		value.Y !== undefined &&
		Number.isFinite(value.X) &&
		Number.isFinite(value.Y);
	const rectangle = (box: Rectangle | null | undefined) =>
		box === undefined ||
		(box !== null &&
			vector(box) &&
			box.Width !== undefined &&
			box.Height !== undefined);
	const item = (value: SavedObject | SavedFurniture | null) =>
		value !== null &&
		value.$type !== "$unknown" &&
		(value.tileLocation === undefined || vector(value.tileLocation)) &&
		rectangle(value.boundingBox);
	const objects = raw.objects ?? [],
		furniture = raw.furniture ?? [];
	// Collection shapes are decoded already. Placement still needs complete
	// coordinates on every object and furniture record before it can move them.
	return (
		objects.every(
			(entry) =>
				vector(entry.key) &&
				item(entry.value) &&
				entry.value.defaultBoundingBox === undefined,
		) &&
		furniture.every(
			(piece) =>
				item(piece) &&
				piece !== null &&
				piece.$type !== "$unknown" &&
				rectangle(piece.defaultBoundingBox),
		)
	);
}
/** The placement helper needs complete coordinates, not merely decoded optional members.
 * Check those algorithm preconditions once before exposing its mutable view. */
function safeTierRecord(raw: SavedBuilding): raw is SavedBuilding & Building {
	return (
		raw.$type !== "$unknown" &&
		raw.buildingType !== undefined &&
		(raw.indoors == null ||
			(isKnownLocation(raw.indoors) && safeInterior(raw.indoors)))
	);
}
/** The legacy tier helper consumes only these checked fields and the private interior. */
export function tierRecord(building: LocatedBuilding): Building | undefined {
	const raw = building.raw;
	if (
		!building.supported ||
		!safeTierRecord(raw) ||
		raw.buildingType === undefined ||
		raw.daysOfConstructionLeft === undefined ||
		raw.daysUntilUpgrade === undefined
	)
		return;
	return raw;
}
export function readBuildings(document: SaveDocument): BuildingsView {
	const graph = inspectBuildings(document);
	const housed = new Set<string>();
	// Ambiguous IDs remain one explicit read-only row; duplicate keys must never
	// prevent the rest of the editor from rendering. The raw graph retains all copies.
	const locatedBuildings = graph.buildings
		.filter(
			(row, index, all) =>
				all.findIndex((candidate) => candidate.id === row.id) === index,
		)
		.map((locatedBuilding) => {
			const building = locatedBuilding.raw;
			if (building.$type === "$unknown")
				return {
					id: locatedBuilding.id,
					name: "Unknown building",
					location: locatedBuilding.location,
					supported: false,
					reason: "This building uses an unsupported saved class.",
					residents: 0,
					outside: 0,
					animalHouse: false,
					construction: false,
					upgrading: false,
					tiers: [],
					animalOptions: [],
					animals: [],
					adoptionReason:
						"Animals cannot be assigned to an unsupported building.",
				};
			const interior = locatedBuilding.interior,
				home = residents(interior),
				checked = tierRecord(locatedBuilding);
			const animalHouse = savedType(interior) === "AnimalHouse";
			// Prefer the saved animal-house limit; older saves may rely on the
			// generated building default, as the legacy editor does.
			const capacity =
				(interior?.$type === "StardewValley.AnimalHouse"
					? interior.animalLimit
					: undefined) ??
				upgradeTiers(building.buildingType).find(
					(tier) => tier.name === building.buildingType,
				)?.maxOccupants ??
				building.maxOccupants;
			const tiers = upgradeTiers(building.buildingType);
			const supported = locatedBuilding.supported && home.supported;
			const animals = [...new Set(home.ids)].map((id) => {
				housed.add(id);
				const animal = graph.animals.find((row) => row.id === id);
				return projectAnimal(animal, id, animal?.container !== interior);
			});
			const adoptionReason =
				!graph.supported ||
				graph.animals.some((row) => !row.supported) ||
				!supported
					? "The saved animal or resident lists are unsupported."
					: !animalHouse
						? "Animals cannot live in this building."
						: capacity === undefined || capacity < 0
							? "The saved capacity is unsupported."
							: building.daysOfConstructionLeft !== 0
								? "This building is still under construction."
								: home.ids.length >= capacity
									? "This building is full, including residents outside."
									: undefined;
			return {
				id: locatedBuilding.id,
				name: building.buildingType ?? "Unknown building",
				// Descriptive game metadata belongs in the domain view alongside prices,
				// without exposing the generated building DTO to the component.
				description: tiers.find((tier) => tier.name === building.buildingType)
					?.description,
				constructionCost: buildingConstructionCost(building.buildingType ?? ""),
				location: locatedBuilding.location,
				supported,
				reason: supported
					? undefined
					: "This building has missing/ambiguous IDs or unsupported residents.",
				capacity,
				residents: home.ids.length,
				outside: animals.filter((row) => row.outside).length,
				animalHouse,
				construction:
					building.daysOfConstructionLeft !== undefined &&
					building.daysOfConstructionLeft > 0,
				upgrading:
					building.daysUntilUpgrade !== undefined &&
					building.daysUntilUpgrade > 0,
				repaired:
					building.buildingType === "Greenhouse"
						? greenhouseFlag(document)
						: undefined,
				tiers: tiers.map((tier) => ({
					name: tier.name,
					reason:
						!checked || !supported
							? "This saved building is unsupported."
							: buildingTierBlocker(checked, tier, home.ids.length),
				})),
				animalOptions: animalHouse
					? animalOptions(tiers, building.buildingType)
					: [],
				adoptionReason,
				animals,
			};
		});
	return {
		buildings: locatedBuildings,
		unhoused: graph.animals
			.filter((row) => row.id == null || row.id === "" || !housed.has(row.id))
			.filter(
				(row, index, all) =>
					row.id == null ||
					row.id === "" ||
					all.findIndex((candidate) => candidate.id === row.id) === index,
			)
			.map((animal, index) =>
				projectAnimal(animal, animal.id ?? `unknown:${index}`, true),
			),
	};
}
/** A greenhouse building toggles the farm's unlock flag, never its local record. */
export function greenhouseFlag(document: SaveDocument): boolean | undefined {
	const farms = (document.SaveGame.locations ?? []).filter(
		(row) => row?.name === "Farm",
	);
	const farm = farms.length === 1 ? farms[0] : undefined;
	// Only the generated Farm class owns greenhouse unlock semantics.
	return farm?.$type === "StardewValley.Farm"
		? farm.greenhouseUnlocked
		: undefined;
}
