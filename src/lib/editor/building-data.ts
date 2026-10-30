import animalData from "$generated/farmanimals.json";
import {
	animalOptions,
	buildingTierBlocker,
	upgradeTiers,
} from "../animalBuildingData.ts";
import type { Building } from "$types/save";
import type { SaveDocument } from "./domain.ts";
import { samePlainData } from "./plain-data.ts";

export const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const empty = (value: unknown) =>
	value === undefined || value === null || value === "";
export const list = (value: unknown): unknown[] =>
	empty(value) ? [] : Array.isArray(value) ? value : [value];
export const long = (value: unknown): string | undefined =>
	typeof value === "string" && /^-?\d+$/.test(value)
		? value
		: typeof value === "number" && Number.isSafeInteger(value)
			? String(value)
			: undefined;
export const integer = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value);

/** Read XML empty/singleton/array collections without changing their saved shape. */
export function collection(raw: unknown, key: string) {
	const supported =
		empty(raw) ||
		(record(raw) &&
			(empty(raw[key]) || Array.isArray(raw[key]) || record(raw[key])));
	return { raw, entries: record(raw) ? list(raw[key]) : [], supported };
}
/** Deliberate insertion may expand a singleton; retained container members remain untouched. */
export function append(raw: unknown, key: string, value: unknown) {
	return {
		...(record(raw) ? raw : {}),
		[key]: [...collection(raw, key).entries, value],
	};
}
export function residents(interior: Record<string, unknown> | undefined) {
	const raw = interior?.animalsThatLiveHere;
	const values = record(raw) ? list(raw.long) : [];
	const ids = values.flatMap((value) =>
		long(value) === undefined ? [] : [String(value)],
	);
	return {
		ids,
		supported:
			(empty(raw) || (record(raw) && values.length === ids.length)) &&
			new Set(ids).size === ids.length,
	};
}
/** Keep the mirror as a second serialization of the same dictionary, never a second animal. */
export function animalDictionary(location: Record<string, unknown>) {
	const lower = collection(location.animals, "item");
	const wrapper = location.Animals;
	const upper = collection(
		record(wrapper)
			? wrapper.SerializableDictionaryOfInt64FarmAnimal
			: undefined,
		"item",
	);
	const hasLower = Object.hasOwn(location, "animals");
	const hasUpper =
		record(wrapper) &&
		Object.hasOwn(wrapper, "SerializableDictionaryOfInt64FarmAnimal");
	const entries = hasLower ? lower.entries : upper.entries;
	const supported =
		lower.supported &&
		upper.supported &&
		(empty(wrapper) || record(wrapper)) &&
		(!hasLower || !hasUpper || samePlainData(lower.entries, upper.entries));
	return { entries, lower, upper, hasLower, hasUpper, supported };
}
export interface LocatedAnimal {
	id?: string;
	container: Record<string, unknown>;
	location: string;
	raw?: Record<string, unknown>;
	mirrors: Record<string, unknown>[];
	supported: boolean;
}
export interface LocatedBuilding {
	id: string;
	raw: Record<string, unknown>;
	location: string;
	interior?: Record<string, unknown>;
	supported: boolean;
}
/** Private DTO lens. Raw references live only as long as the supplied engine snapshot. */
export function inspectBuildings(document: SaveDocument) {
	const buildings: LocatedBuilding[] = [],
		animals: LocatedAnimal[] = [];
	const locations = collection(document.SaveGame.locations, "GameLocation");
	let supported = locations.supported;
	const seen = new WeakSet<object>();
	function visit(value: unknown, path: string, label: string) {
		if (!record(value) || seen.has(value)) {
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
			const raw =
				record(entry) && record(entry.value) && record(entry.value.FarmAnimal)
					? entry.value.FarmAnimal
					: undefined;
			const id =
				record(entry) && record(entry.key) ? long(entry.key.long) : undefined;
			const other = dictionary.upper.entries[index];
			const mirror =
				dictionary.hasLower &&
				dictionary.hasUpper &&
				record(other) &&
				record(other.value) &&
				record(other.value.FarmAnimal)
					? other.value.FarmAnimal
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
		const rows = collection(value.buildings, "Building");
		supported &&= rows.supported;
		for (const [index, raw] of rows.entries.entries()) {
			if (!record(raw)) {
				supported = false;
				continue;
			}
			const id = typeof raw.id === "string" && raw.id ? raw.id : undefined;
			const interior = record(raw.indoors) ? raw.indoors : undefined;
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
	locations.entries.forEach((value, index) => {
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
/** The legacy tier helper consumes only these checked fields and the private interior. */
export function tierRecord(building: LocatedBuilding): Building | undefined {
	const raw = building.raw;
	if (
		!building.supported ||
		typeof raw.buildingType !== "string" ||
		!integer(raw.daysOfConstructionLeft) ||
		!integer(raw.daysUntilUpgrade)
	)
		return;
	// This is the compatibility boundary to the existing helper, not a complete raw-save schema.
	return raw as unknown as Building;
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
			const animalHouse = interior?.["@_xsi:type"] === "AnimalHouse";
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
	const farms = collection(
		document.SaveGame.locations,
		"GameLocation",
	).entries.filter((row) => record(row) && row.name === "Farm");
	return farms.length === 1 &&
		record(farms[0]) &&
		typeof farms[0].greenhouseUnlocked === "boolean"
		? farms[0].greenhouseUnlocked
		: undefined;
}
