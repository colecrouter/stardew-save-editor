import type { Location, SaveDocument } from "./domain.ts";
import type { T_StardewValley_Characters_Pet } from "../../../generated/save-format/save.ts";

import { petAppearanceKey, petAppearances } from "./pet-appearance.ts";
import type { PetAppearanceData } from "./pet-appearance.ts";

// Known pet subclasses share generated fields. The editor currently writes only
// the concrete Pet class; opaque subclasses remain outside this representation.
type KnownPet = Exclude<
	T_StardewValley_Characters_Pet,
	{ readonly $type: "$unknown" }
>;
export type SavedPet = Extract<
	KnownPet,
	{ readonly $type: "StardewValley.Characters.Pet" }
>;

// Pet.guid is the persistent identity matched by the saved PetBowl.petGuid. Names and list
// positions are not identities: multiple pets can share a name or move indoors.
const guidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const petId = (value: string | undefined) =>
	value !== undefined &&
	guidPattern.test(value) &&
	value !== "00000000-0000-0000-0000-000000000000"
		? value.toLowerCase()
		: undefined;

/** Only the concrete generated Pet class has the field semantics edited here.
 * Opaque subclasses retain their XML and never receive writable identities. */
export const supportsPetRecord = (raw: KnownPet): raw is SavedPet =>
	raw.$type === "StardewValley.Characters.Pet";

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
	raw: KnownPet;
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
	function visit(value: Location, path: string) {
		// Opaque locations could hide another copy of a GUID. Repeated objects
		// likewise make traversal ambiguous, so keep discovered pets read-only.
		if (value.$type === "$unknown" || seen.has(value)) {
			supported = false;
			return;
		}
		seen.add(value);
		const location = value.name ?? "Unknown location";
		// The codec has already validated list shapes and scalar types. Null
		// slots represent saved nil entries and do not contribute an identity.
		for (const [index, raw] of (value.characters ?? []).entries()) {
			if (raw === null) continue;
			if (raw.$type === "$unknown") {
				supported = false;
				continue;
			}
			if (
				raw.$type === "StardewValley.Characters.Pet" ||
				raw.$type === "StardewValley.Characters.Cat" ||
				raw.$type === "StardewValley.Characters.Dog"
			) {
				pets.push({
					raw,
					path: `${path}/characters/${index}`,
					location,
					id: petId(raw.guid),
				});
			}
		}
		for (const [index, building] of (value.buildings ?? []).entries()) {
			if (building === null) continue;
			// Unknown buildings can contain an interior unavailable to typed
			// traversal. Never assume that interior cannot contain another pet.
			if (building.$type === "$unknown") {
				supported = false;
				continue;
			}
			if (building.indoors != null)
				visit(building.indoors, `${path}/buildings/${index}/indoors`);
		}
	}
	for (const [index, location] of (
		document.SaveGame.locations ?? []
	).entries()) {
		if (location !== null) visit(location, `/SaveGame/locations/${index}`);
	}
	const counts = new Map<string, number>();
	// GUIDs compare without letter case. A duplicate is ambiguous even when the
	// two records are byte-identical, so neither receives a writable identity.
	for (const pet of pets)
		if (pet.id) counts.set(pet.id, (counts.get(pet.id) ?? 0) + 1);
	return { pets, supported, counts };
}

/** Missing optional fields receive display-only defaults. Projection never
 * fills them in, and independent fields keep their own editing availability. */
export function readPets(document: SaveDocument): PetView[] {
	const graph = inspectPets(document);
	return graph.pets.map(({ raw, id, path, location }) => {
		const reason = !graph.supported
			? "A saved location or character collection is unreadable."
			: !id || graph.counts.get(id) !== 1
				? "This pet has a missing or duplicated saved identity."
				: !supportsPetRecord(raw)
					? "This pet class is read-only."
					: undefined;
		// A readable custom pair stays selected until the user deliberately
		// replaces it. Missing components cannot be filled in implicitly.
		const breed = raw.whichBreed || undefined;
		const type = raw.petType || undefined;
		const appearanceValue =
			type && breed ? petAppearanceKey(type, breed) : undefined;
		const appearance = petAppearances.find(
			(choice) => choice.value === appearanceValue,
		);
		return {
			key: id && graph.counts.get(id) === 1 ? id : path,
			id,
			name: raw.name ?? "Unnamed pet",
			nameEditable: raw.name !== undefined,
			type: raw.petType ?? "Unknown pet type",
			breed: breed ?? "Unknown",
			location,
			friendship:
				raw.friendshipTowardFarmer !== undefined &&
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
