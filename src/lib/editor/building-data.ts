import animalData from "$generated/farmanimals.json";
import type {
	T_StardewValley_FarmAnimal as FarmAnimal,
	T_StardewValley_Buildings_Building as SavedBuilding,
} from "../../../generated/save-format/save.ts";
import {
	animalOptions,
	buildingTierBlocker,
	upgradeTiers,
} from "../animalBuildingData.ts";
import type { Building } from "./animal-buildings.ts";
import { buildingConstructionCost } from "./building-costs.ts";
import type { Location, SaveDocument } from "./domain.ts";
import { savedType } from "./saved-types.ts";

// Known locations share the game's base collections. Opaque mod classes remain
// visible at the boundary, but their unvalidated fields never become edit targets.
export type KnownLocation = Exclude<Location, { readonly $type: "$unknown" }>;
export function isKnownLocation(
	value: Location | null | undefined,
): value is KnownLocation {
	return value != null && value.$type !== "$unknown";
}

import { record, samePlainData } from "./plain-data.ts";

export { record } from "./plain-data.ts";

const empty = (value: unknown) =>
	value === undefined || value === null || value === "";
export const long = (value: unknown): string | undefined =>
	typeof value === "string" && /^-?\d+$/.test(value)
		? value
		: typeof value === "bigint" ||
			  (typeof value === "number" && Number.isSafeInteger(value))
			? String(value)
			: undefined;
export const integer = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value);

export function residents(interior: KnownLocation | undefined) {
	const raw = interior?.animalsThatLiveHere;
	// Other known location classes can carry this animal-house field only as
	// extension data, so its array shape still needs checking at this boundary.
	const values = Array.isArray(raw) ? raw : [];
	const ids = values.flatMap((value) =>
		long(value) === undefined ? [] : [String(value)],
	);
	return {
		ids,
		supported:
			(empty(raw) || (Array.isArray(raw) && values.length === ids.length)) &&
			new Set(ids).size === ids.length,
	};
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
	id?: string;
	container: KnownLocation;
	location: string;
	raw?: FarmAnimal;
	mirrors: FarmAnimal[];
	supported: boolean;
}
export interface LocatedBuilding {
	id: string;
	raw: SavedBuilding;
	location: string;
	interior?: KnownLocation;
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
		const location = typeof value.name === "string" ? value.name : label;
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
				mirrors: raw ? [...new Set([raw, ...(mirror ? [mirror] : [])])] : [],
				supported:
					dictionary.supported && !!id && !!raw && long(raw.myID) === id,
			});
		}
		for (const [index, raw] of (value.buildings ?? []).entries()) {
			if (!raw) {
				supported = false;
				continue;
			}
			const id = typeof raw.id === "string" && raw.id ? raw.id : undefined;
			const interior =
				raw.$type !== "$unknown" && isKnownLocation(raw.indoors)
					? raw.indoors
					: undefined;
			buildings.push({
				id: id ?? `building-path:${path}:${index}`,
				raw,
				location,
				interior,
				supported: !!id && (empty(raw.indoors) || !!interior),
			});
			if (interior) visit(interior, `${path}/building:${index}`, location);
		}
	}
	locations.forEach((value, index) => {
		visit(value, `location:${index}`, "Unknown location");
	});
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
	reason?: string;
	daysOwned?: number;
	friendship?: number;
	happiness?: number;
	fullness?: number;
	gender?: string;
	reproduction?: boolean;
	cracker?: boolean;
	canReproduce: boolean;
	canEatCracker: boolean;
}
export interface BuildingView {
	id: string;
	name: string;
	description?: string;
	constructionCost?: ReturnType<typeof buildingConstructionCost>;
	location: string;
	supported: boolean;
	reason?: string;
	capacity?: number;
	residents: number;
	outside: number;
	animalHouse: boolean;
	construction: boolean;
	upgrading: boolean;
	repaired?: boolean;
	tiers: { name: string; reason?: string }[];
	animalOptions: { type: string; allowed: boolean; reason?: string }[];
	adoptionReason?: string;
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
		raw && integer(raw.daysOwned)
			? raw.daysOwned < 0
				? raw.age
				: raw.daysOwned
			: undefined;
	return {
		id,
		nameEditable: typeof raw?.name === "string",
		name:
			typeof raw?.name === "string"
				? raw.name
				: raw
					? "Unnamed animal"
					: "Missing animal",
		type: typeof raw?.type === "string" ? raw.type : "Unknown type",
		location: animal?.location ?? "Not found in the save",
		outside,
		supported: !!animal?.supported,
		reason: animal?.supported
			? undefined
			: "This animal is missing or has ambiguous saved records.",
		daysOwned: integer(days) && days >= 0 ? days : undefined,
		friendship: integer(raw?.friendshipTowardFarmer)
			? raw.friendshipTowardFarmer
			: undefined,
		happiness: integer(raw?.happiness) ? raw.happiness : undefined,
		fullness: integer(raw?.fullness) ? raw.fullness : undefined,
		gender:
			typeof raw?.Gender === "string" &&
			["Male", "Female", "Undefined"].includes(raw.Gender)
				? raw.Gender
				: undefined,
		reproduction:
			raw?.allowReproduction === undefined
				? true
				: typeof raw.allowReproduction === "boolean"
					? raw.allowReproduction
					: undefined,
		cracker:
			raw?.hasEatenAnimalCracker === undefined
				? false
				: typeof raw.hasEatenAnimalCracker === "boolean"
					? raw.hasEatenAnimalCracker
					: undefined,
		canReproduce: data?.canReproduce ?? false,
		canEatCracker: data?.canEatGoldenCrackers ?? false,
	};
}
/** Helpers move only checked object/furniture collections; opaque shapes must not be silently erased. */
export function safeInterior(raw: KnownLocation | null | undefined): boolean {
	if (!raw) return true;
	const vector = (
		value: unknown,
	): value is { X: number; Y: number } & Record<string, unknown> =>
		record(value) &&
		typeof value.X === "number" &&
		Number.isFinite(value.X) &&
		typeof value.Y === "number" &&
		Number.isFinite(value.Y);
	const item = (value: unknown) =>
		record(value) &&
		(value.tileLocation === undefined || vector(value.tileLocation)) &&
		[value.boundingBox, value.defaultBoundingBox].every(
			(box) =>
				box === undefined ||
				(vector(box) &&
					typeof box.Width === "number" &&
					typeof box.Height === "number"),
		);
	const objects = raw.objects ?? [],
		furniture = raw.furniture ?? [];
	// Collection shapes are decoded already. Placement still needs complete
	// coordinates on every object and furniture record before it can move them.
	return (
		objects.every((entry) => vector(entry.key) && item(entry.value)) &&
		furniture.every(item)
	);
}
/** The placement helper needs complete coordinates, not merely decoded optional members.
 * Check those algorithm preconditions once before exposing its mutable view. */
function safeTierRecord(raw: SavedBuilding): raw is SavedBuilding & Building {
	return (
		raw.$type !== "$unknown" &&
		typeof raw.buildingType === "string" &&
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
		typeof raw.buildingType !== "string" ||
		!integer(raw.daysOfConstructionLeft) ||
		!integer(raw.daysUntilUpgrade)
	)
		return;
	return raw;
}
export function readBuildings(document: SaveDocument): BuildingsView {
	const graph = inspectBuildings(document);
	const housed = new Set<string>();
	// Ambiguous IDs remain one explicit read-only row; duplicate keys must never
	// prevent the rest of the editor from rendering. The raw graph retains all copies.
	const buildings = graph.buildings
		.filter(
			(row, index, all) =>
				all.findIndex((candidate) => candidate.id === row.id) === index,
		)
		.map((building) => {
			const raw = building.raw,
				interior = building.interior,
				home = residents(interior),
				checked = tierRecord(building);
			const animalHouse = savedType(interior) === "AnimalHouse";
			// Prefer the saved animal-house limit; older saves may rely on the
			// generated building default, as the legacy editor does.
			const capacity =
				interior?.animalLimit ??
				upgradeTiers(
					typeof raw.buildingType === "string" ? raw.buildingType : undefined,
				).find((tier) => tier.name === raw.buildingType)?.maxOccupants ??
				raw.maxOccupants;
			const tiers = upgradeTiers(
				typeof raw.buildingType === "string" ? raw.buildingType : undefined,
			);
			const supported = building.supported && home.supported;
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
						: !integer(capacity) || capacity < 0
							? "The saved capacity is unsupported."
							: raw.daysOfConstructionLeft !== 0
								? "This building is still under construction."
								: home.ids.length >= capacity
									? "This building is full, including residents outside."
									: undefined;
			return {
				id: building.id,
				name:
					typeof raw.buildingType === "string"
						? raw.buildingType
						: "Unknown building",
				// Descriptive game metadata belongs in the domain view alongside prices,
				// without exposing the generated building DTO to the component.
				description: tiers.find((tier) => tier.name === raw.buildingType)
					?.description,
				constructionCost: buildingConstructionCost(
					typeof raw.buildingType === "string" ? raw.buildingType : "",
				),
				location: building.location,
				supported,
				reason: supported
					? undefined
					: "This building has missing/ambiguous IDs or unsupported residents.",
				capacity: integer(capacity) ? capacity : undefined,
				residents: home.ids.length,
				outside: animals.filter((row) => row.outside).length,
				animalHouse,
				construction:
					typeof raw.daysOfConstructionLeft === "number" &&
					raw.daysOfConstructionLeft > 0,
				upgrading:
					typeof raw.daysUntilUpgrade === "number" && raw.daysUntilUpgrade > 0,
				repaired:
					raw.buildingType === "Greenhouse"
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
					? animalOptions(
							tiers,
							typeof raw.buildingType === "string"
								? raw.buildingType
								: undefined,
						)
					: [],
				adoptionReason,
				animals,
			};
		});
	return {
		buildings,
		unhoused: graph.animals
			.filter((row) => !row.id || !housed.has(row.id))
			.filter(
				(row, index, all) =>
					!row.id ||
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
	// Unknown location subclasses can expose an opaque flag, so its scalar
	// type still needs checking before the view treats it as a boolean.
	return typeof farm?.greenhouseUnlocked === "boolean"
		? farm.greenhouseUnlocked
		: undefined;
}
