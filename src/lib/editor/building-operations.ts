import { progressionFarmers } from "./progression-farmers.ts";
import { Data, Effect, Schema, Result } from "effect";
import { createFarmAnimal, newAnimalId } from "./farm-animal-data.ts";
import { changeBuildingTier } from "./animal-buildings.ts";
import { upgradeTiers, purchasedAnimalTopic } from "../animalBuildingData.ts";
import type { Farmer, SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import {
	long,
	residents,
	animalDictionary,
	inspectBuildings,
	readBuildings,
	tierRecord,
	safeInterior,
	isKnownLocation,
} from "./building-data.ts";

export class BuildingInvalid extends Data.TaggedError("BuildingInvalid")<{
	readonly message: string;
}> {}
const invalid = (message: string) =>
	Effect.fail(new BuildingInvalid({ message }));
const bounded = (max: number) =>
	Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: 0, maximum: max }),
	);
const handles = { animalId: Schema.String };
const animalSchema = Schema.Union([
	Schema.Struct({
		...handles,
		kind: Schema.Literal("name"),
		value: Schema.String,
	}),
	Schema.Struct({
		...handles,
		kind: Schema.Literal("daysOwned"),
		value: bounded(2147483647),
	}),
	Schema.Struct({
		...handles,
		kind: Schema.Literal("friendship"),
		value: bounded(1000),
	}),
	Schema.Struct({
		...handles,
		kind: Schema.Literals(["happiness", "fullness"]),
		value: bounded(255),
	}),
	Schema.Struct({
		...handles,
		kind: Schema.Literal("gender"),
		value: Schema.String.check(Schema.isPattern(/^(Male|Female|Undefined)$/)),
	}),
	Schema.Struct({
		...handles,
		kind: Schema.Literals(["reproduction", "cracker"]),
		value: Schema.Boolean,
	}),
]);
export type AnimalChange = typeof animalSchema.Type;
const decode = Schema.decodeUnknownResult(animalSchema, {
	onExcessProperty: "error",
});
/** Captured animal IDs resolve in the current transaction; both saved mirrors receive field-only edits. */
export const setAnimal = Effect.fn("Buildings.setAnimal")(function* (
	input: AnimalChange,
) {
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* invalid("Choose a valid animal field value.");
	const change = decoded.success;
	const draft = yield* TransactionDraft,
		snapshot = yield* draft.read;
	// Resolve current identities before touching either mirror. A stale selection
	// cannot edit a different animal after another queued command changes the save.
	const graph = inspectBuildings(snapshot.state.document);
	const target = graph.animals.find((row) => row.id === change.animalId);
	const view = readBuildings(snapshot.state.document);
	const animal = [
		...view.buildings.flatMap((row) => row.animals),
		...view.unhoused,
	].find((row) => row.id === change.animalId);
	if (!target?.supported || !target.raw || !animal?.supported)
		return yield* invalid(
			"This animal no longer has an unambiguous saved record.",
		);
	if (animal[change.kind] === undefined)
		return yield* invalid("This saved field is unsupported.");
	if (change.kind === "reproduction" && !animal.canReproduce)
		return yield* invalid("This animal cannot reproduce.");
	if (change.kind === "cracker" && !animal.canEatCracker)
		return yield* invalid("This animal cannot eat Golden Animal Crackers.");
	if (change.kind === "name" && !animal.nameEditable)
		return yield* invalid("This saved name is unsupported.");
	if (change.kind === "name" && !change.value.trim())
		return yield* invalid("The animal needs a name.");
	const property = {
		name: "name",
		daysOwned: "daysOwned",
		friendship: "friendshipTowardFarmer",
		happiness: "happiness",
		fullness: "fullness",
		gender: "Gender",
		reproduction: "allowReproduction",
		cracker: "hasEatenAnimalCracker",
	}[change.kind];
	// Read defaults remain virtual. Deliberate edits synchronize only the requested
	// value and the game's paired display/age fields, preserving unrelated mod data.
	for (const raw of target.mirrors) {
		raw[property] = change.value;
		if (change.kind === "name") raw.displayName = change.value;
		if (change.kind === "daysOwned") raw.age = change.value;
	}
	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${animal.name} ${change.kind}`,
			tags: ["buildings", "animals", `animal:${change.animalId}`],
		}),
	);
});

// Progression collections expose decoded string values, with absence allowed for new fields.
const checkedStrings = Effect.fn("Buildings.strings")(function* (
	raw: (string | null)[] | undefined,
) {
	const entries = raw ?? [];
	// Nullable strings are decoded faithfully; progression edits require every
	// entry to name a flag, rather than silently dropping null slots.
	if (entries.some((value) => value === null))
		return yield* invalid("A progression mail/building list is unsupported.");
	return {
		entries: entries.filter((value): value is string => value !== null),
	};
});
const topic = Effect.fn("Buildings.topic")(function* (
	farmer: Farmer,
	id: string,
) {
	const active = farmer.activeDialogueEvents ?? [];
	const previous = farmer.previousActiveDialogueEvents ?? [];
	if ([...active, ...previous].some((entry) => entry.key === id)) return;
	farmer.activeDialogueEvents = [...active, { key: id, value: 4 }];
});
const addString = Effect.fn("Buildings.addString")(function* <K extends string>(
	owner: { [P in K]?: (string | null)[] },
	property: K,
	value: string,
) {
	const data = yield* checkedStrings(owner[property]);
	if (!data.entries.includes(value)) owner[property] = [...data.entries, value];
});
const sendMail = Effect.fn("Buildings.mail")(function* (
	document: SaveDocument,
	key: string,
) {
	yield* addString(document.SaveGame, "broadcastedMail", `%&SM&%${key}`);
	for (const farmer of yield* progressionFarmers(document)) {
		const received = yield* checkedStrings(farmer.mailReceived),
			mailbox = yield* checkedStrings(farmer.mailbox),
			tomorrow = yield* checkedStrings(farmer.mailForTomorrow);
		if (
			![...received.entries, ...mailbox.entries, ...tomorrow.entries].some(
				(value) => value === key || value === `${key}%&NL&%`,
			)
		)
			yield* addString(farmer, "mailbox", key);
	}
});

/** Inventory's private replay repeats only the checked structural transition; progression is outside its authority. */
export function replayBuildingUpgrade(
	document: SaveDocument,
	buildingId: string,
	targetName: string,
) {
	const building = inspectBuildings(document).buildings.find(
		(row) => row.id === buildingId,
	);
	const raw = building && tierRecord(building),
		target = upgradeTiers(raw?.buildingType).find(
			(row) => row.name === targetName,
		);
	if (!raw || !target)
		throw new Error("Approved building upgrade disappeared during replay");
	changeBuildingTier(raw, target, {
		constructed: () => {},
		mail: () => {},
		topic: () => {},
	});
}
/** Prepare a complete tier transition on a private snapshot; caller owns publication and inventory authority. */
export const prepareBuildingUpgrade = Effect.fn("Buildings.prepareUpgrade")(
	function* (document: SaveDocument, buildingId: string, targetName: string) {
		const building = inspectBuildings(document).buildings.find(
			(row) => row.id === buildingId,
		);
		const view = readBuildings(document).buildings.find(
			(row) => row.id === buildingId,
		);
		const raw = building && tierRecord(building),
			option = view?.tiers.find((row) => row.name === targetName);
		if (!building || !raw || !view?.supported || !option || option.reason)
			return yield* invalid(
				option?.reason ?? "Choose a supported building tier.",
			);
		if (!safeInterior(building.interior))
			return yield* invalid(
				"This interior has unsupported object or furniture data.",
			);
		const target = upgradeTiers(raw.buildingType).find(
			(row) => row.name === targetName,
		);
		if (!target)
			return yield* invalid("This building tier is no longer available.");
		// Collect the shared engine's progression consequences, then validate and
		// stage them on this same private snapshot. A later failure discards all writes.
		const built: string[] = [],
			mail: string[] = [],
			topics: string[] = [];
		const warnings = changeBuildingTier(raw, target, {
			constructed: (value) => {
				built.push(value);
			},
			mail: (value) => {
				mail.push(value);
			},
			topic: (value) => {
				topics.push(value);
			},
		});
		for (const name of built)
			yield* addString(document.SaveGame, "constructedBuildings", name);
		for (const key of mail) yield* sendMail(document, key);
		for (const farmer of yield* progressionFarmers(document)) {
			for (const id of topics) yield* topic(farmer, id);
		}
		return warnings;
	},
);
/** A building upgrade also owns any placed-chest relocation and its session handles. */
export const upgradeBuilding = Effect.fn("Buildings.upgrade")(function* (
	buildingId: string,
	target: string,
) {
	const inventory = yield* InventoryEdits;
	return yield* recordAnnotatedOperation(
		inventory.upgradeBuilding(buildingId, target),
	).pipe(
		withReviewMetadata({
			label: `Change building to ${target}`,
			tags: ["buildings", "buildings:tier", `building:${buildingId}`],
		}),
	);
});

/** Adoption writes the animal, mirrors, residents, occupancy, ID sequence and topics in one transaction. */
export const adoptAnimal = Effect.fn("Buildings.adopt")(function* (
	buildingId: string,
	type: string,
	name: string,
	farmerId: string,
) {
	if (
		typeof buildingId !== "string" ||
		typeof type !== "string" ||
		typeof name !== "string" ||
		typeof farmerId !== "string"
	)
		return yield* invalid("Choose a building, animal, name and owner.");
	const draft = yield* TransactionDraft,
		snapshot = yield* draft.read,
		document = snapshot.state.document;
	const graph = inspectBuildings(document),
		building = graph.buildings.find((row) => row.id === buildingId);
	const view = readBuildings(document).buildings.find(
		(row) => row.id === buildingId,
	);
	const option = view?.animalOptions.find((row) => row.type === type);
	if (
		!graph.supported ||
		graph.animals.some((row) => !row.supported) ||
		!building?.supported ||
		building.raw.$type === "$unknown" ||
		!building.interior ||
		!view ||
		view.adoptionReason ||
		!option?.allowed
	)
		return yield* invalid(
			view?.adoptionReason ??
				option?.reason ??
				"This animal cannot be adopted here.",
		);
	const trimmed = name.trim();
	if (!trimmed || graph.animals.some((row) => row.raw?.name === trimmed))
		return yield* invalid(
			trimmed
				? "Another animal already has this name."
				: "The animal needs a name.",
		);
	const owners = (yield* progressionFarmers(document)).filter(
		(owner) => owner.UniqueMultiplayerID?.toString() === farmerId,
	);
	const owner = owners.length === 1 ? owners[0] : undefined;
	if (!owner || long(owner.UniqueMultiplayerID) === undefined)
		return yield* invalid("Choose an owner with a unique saved player ID.");
	// Reserve every live and resident ID, including absent/outside animals, so
	// the new 64-bit key cannot collide with a home list that outlives its record.
	const taken = new Set(
		graph.animals
			.flatMap((row) => [row.id, long(row.raw?.myID)])
			.filter((id): id is string => id !== undefined),
	);
	for (const row of graph.buildings)
		for (const id of residents(row.interior).ids) taken.add(id);
	const game = document.SaveGame;
	if (game.latestID !== undefined && long(game.latestID) === undefined)
		return yield* invalid("The saved animal ID sequence is unsupported.");
	const id = newAnimalId(farmerId, { latestId: long(game.latestID), taken });
	const raw = createFarmAnimal(type, trimmed, farmerId, id),
		interior = building.interior;
	// Deliberate insertion updates both saved dictionaries; ordinary property edits
	// still leave a missing mirror absent.
	const dictionary = animalDictionary(interior);
	// If only the uppercase dictionary existed, retain those animals as well.
	interior.animals = [...dictionary.entries, raw];
	interior.Animals = structuredClone(interior.animals);
	const home = residents(interior);
	interior.animalsThatLiveHere = [...home.ids.map(BigInt), BigInt(id)];
	building.raw.currentOccupants = dictionary.entries.length + 1;
	game.latestID = BigInt(id);
	for (const farmer of yield* progressionFarmers(document)) {
		yield* topic(farmer, purchasedAnimalTopic(type));
	}
	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Adopt ${trimmed} the ${type}`,
			tags: ["buildings", "animals:adopt", `building:${buildingId}`],
		}),
	);
	return { animalId: id };
});
/** The Greenhouse checkbox belongs to the farm unlock flag, with ordinary immediate Undo. */
export const setGreenhouseRepaired = Effect.fn("Buildings.greenhouse")(
	function* (buildingId: string, value: boolean) {
		const draft = yield* TransactionDraft,
			snapshot = yield* draft.read;
		const view = readBuildings(snapshot.state.document).buildings.find(
			(row) => row.id === buildingId,
		);
		const farms = (snapshot.state.document.SaveGame.locations ?? []).filter(
			(row) => row?.name === "Farm",
		);
		if (
			typeof value !== "boolean" ||
			!view?.supported ||
			view.repaired === undefined ||
			farms.length !== 1 ||
			!isKnownLocation(farms[0])
		)
			return yield* invalid("The saved Greenhouse flag is unsupported.");
		farms[0].greenhouseUnlocked = value;
		yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
			withReviewMetadata({
				label: value ? "Repair Greenhouse" : "Unrepair Greenhouse",
				tags: ["buildings", "greenhouse"],
			}),
		);
	},
);
