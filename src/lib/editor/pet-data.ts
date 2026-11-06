import type { SaveDocument } from "./domain.ts";
import { collection, record } from "./saved-collections.ts";
import {
	petAppearanceKey,
	petAppearances,
	savedBreedId,
} from "./pet-appearance.ts";
import type { PetAppearanceData } from "../../../codegen/pets.ts";

// Pet.guid is the persistent identity matched by the saved PetBowl.petGuid. Names and list
// positions are not identities: multiple pets can share a name or move indoors.
const guidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const petId = (value: unknown) =>
	typeof value === "string" &&
	guidPattern.test(value) &&
	value !== "00000000-0000-0000-0000-000000000000"
		? value.toLowerCase()
		: undefined;

// Review pointers must match the imported representation: a singleton has no
// array index, while a collection with multiple entries does. Never normalize it.
function entryPath(raw: unknown, key: string, path: string, index: number) {
	const suffix = record(raw) && Array.isArray(raw[key]) ? `/${index}` : "";
	return `${path}/${key}${suffix}`;
}

// Do not coerce arbitrary imported objects: even a saved toString property can
// be opaque data. These are the two scalar XML-nil forms understood here.
const nil = (raw: Record<string, unknown>) =>
	raw["@_xsi:nil"] === true || raw["@_xsi:nil"] === "true";

/** Only the game's concrete, present Pet record has known field semantics. */
export const supportsPetRecord = (raw: Record<string, unknown>) =>
	raw["@_xsi:type"] === "Pet" && !nil(raw);

export interface PetView {
	readonly key: string;
	readonly id?: string;
	readonly name: string;
	readonly nameEditable: boolean;
	readonly type: string;
	readonly breed: string;
	readonly location: string;
	readonly friendship?: number;
	readonly appearance: {
		readonly value?: string;
		readonly available: boolean;
		readonly known: boolean;
		readonly reason?: string;
		readonly icon?: PetAppearanceData["icon"];
	};
	readonly supported: boolean;
	readonly reason?: string;
}

interface LocatedPet {
	raw: Record<string, unknown>;
	path: string;
	location: string;
	id?: string;
}

/** Snapshot-local raw references are private to inspection and mutation. The UI
 * receives detached scalar views, never mutable saved characters. */
export function inspectPets(document: SaveDocument) {
	const pets: LocatedPet[] = [];
	let supported = true;
	const seen = new WeakSet<object>();
	function visit(value: unknown, path: string) {
		// An unreadable location could hide a second copy of a pet GUID. Inspection
		// can still show known pets, but mutations must not guess which copy wins.
		if (!record(value) || seen.has(value)) {
			supported = false;
			return;
		}
		seen.add(value);
		const location =
			typeof value.name === "string" ? value.name : "Unknown location";
		const characters = collection(value.characters, "NPC");
		supported &&= characters.supported;
		for (const [index, raw] of characters.entries.entries()) {
			if (!record(raw)) {
				supported = false;
				continue;
			}
			// A custom subclass with pet fields remains visible, but only the known
			// Pet serialization is writable. Other NPCs are left completely alone.
			if (raw["@_xsi:type"] === "Pet" || Object.hasOwn(raw, "petType"))
				pets.push({
					raw,
					path: entryPath(value.characters, "NPC", `${path}/characters`, index),
					location,
					id: petId(raw.guid),
				});
		}
		const buildings = collection(value.buildings, "Building");
		supported &&= buildings.supported;
		for (const [index, building] of buildings.entries.entries()) {
			if (!record(building)) {
				supported = false;
				continue;
			}
			const indoors = building.indoors;
			// Empty and XML-nil interiors represent outdoor-only buildings.
			if (
				indoors === undefined ||
				indoors === null ||
				indoors === "" ||
				(record(indoors) && nil(indoors))
			)
				continue;
			visit(
				indoors,
				`${entryPath(value.buildings, "Building", `${path}/buildings`, index)}/indoors`,
			);
		}
	}
	const locations = collection(document.SaveGame.locations, "GameLocation");
	supported &&= locations.supported;
	for (const [index, location] of locations.entries.entries()) {
		visit(
			location,
			entryPath(
				document.SaveGame.locations,
				"GameLocation",
				"/SaveGame/locations",
				index,
			),
		);
	}
	const counts = new Map<string, number>();
	// GUIDs compare without letter case. A duplicate is ambiguous even when the
	// two records are byte-identical, so neither receives a writable identity.
	for (const pet of pets)
		if (pet.id) counts.set(pet.id, (counts.get(pet.id) ?? 0) + 1);
	return { pets, supported, counts };
}

/** Read defaults are display-only; missing or malformed saved fields are never
 * filled in during projection. A supported field can be edited independently. */
export function readPets(document: SaveDocument): PetView[] {
	const graph = inspectPets(document);
	return graph.pets.map(({ raw, id, path, location }) => {
		const reason = !graph.supported
			? "A saved location or character collection is unreadable."
			: !id || graph.counts.get(id) !== 1
				? "This pet has a missing or duplicated saved identity."
				: !supportsPetRecord(raw)
					? "This custom pet class is read-only."
					: undefined;
		// A readable custom pair stays selected until the user deliberately
		// replaces it. Missing/opaque components cannot be normalized safely.
		const breed = savedBreedId(raw.whichBreed);
		const type =
			typeof raw.petType === "string" && raw.petType ? raw.petType : undefined;
		const appearanceValue =
			type && breed ? petAppearanceKey(type, breed) : undefined;
		const appearance = petAppearances.find(
			(choice) => choice.value === appearanceValue,
		);
		return {
			key: id && graph.counts.get(id) === 1 ? id : path,
			id,
			name: typeof raw.name === "string" ? raw.name : "Unnamed pet",
			nameEditable: typeof raw.name === "string",
			type: typeof raw.petType === "string" ? raw.petType : "Unknown pet type",
			breed: breed ?? "Unknown",
			location,
			friendship:
				typeof raw.friendshipTowardFarmer === "number" &&
				Number.isSafeInteger(raw.friendshipTowardFarmer)
					? raw.friendshipTowardFarmer
					: undefined,
			appearance: {
				value: appearanceValue,
				available: reason === undefined && appearanceValue !== undefined,
				known: appearance !== undefined,
				reason:
					reason ??
					(appearanceValue === undefined
						? "The saved appearance is unreadable."
						: undefined),
				icon: appearance ? { ...appearance.icon } : undefined,
			},
			supported: reason === undefined,
			reason,
		};
	});
}
