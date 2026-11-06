import { progressionFarmers } from "./progression-farmers.ts";
import { Data, Effect, Schema, Result } from "effect";
import { createFarmAnimal, newAnimalId } from "../farmAnimalData.ts";
import { changeBuildingTier } from "../animalBuildings.ts";
import { upgradeTiers, purchasedAnimalTopic } from "../animalBuildingData.ts";
import { type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import {
	record,
	integer,
	long,
	collection,
	append,
	residents,
	animalDictionary,
	inspectBuildings,
	readBuildings,
	tierRecord,
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

// Progression effects are validated as XML collections before adding entries.
// Unknown members and singleton representations survive unless insertion is needed.
const checkedStrings = Effect.fn("Buildings.strings")(function* (raw: unknown) {
	const values = collection(raw, "string");
	const entries = record(raw)
		? raw.string === undefined || raw.string === ""
			? []
			: Array.isArray(raw.string)
				? raw.string
				: [raw.string]
		: [];
	if (
		!(raw === undefined || raw === null || raw === "" || record(raw)) ||
		entries.some((value) => typeof value !== "string")
	)
		return yield* invalid("A progression mail/building list is unsupported.");
	return { ...values, entries };
});
const topic = Effect.fn("Buildings.topic")(function* (
	farmer: Record<string, unknown>,
	id: string,
) {
	const active = collection(farmer.activeDialogueEvents, "item"),
		previous = collection(farmer.previousActiveDialogueEvents, "item");
	if (
		!active.supported ||
		!previous.supported ||
		[...active.entries, ...previous.entries].some(
			(entry) =>
				!record(entry) ||
				!record(entry.key) ||
				typeof entry.key.string !== "string",
		)
	)
		return yield* invalid("A farmer's conversation topics are unsupported.");
	if (
		[...active.entries, ...previous.entries].some(
			(entry) => record(entry) && record(entry.key) && entry.key.string === id,
		)
	)
		return;
	farmer.activeDialogueEvents = append(farmer.activeDialogueEvents, "item", {
		key: { string: id },
		value: { int: 4 },
	});
});
const addString = Effect.fn("Buildings.addString")(function* (
	owner: Record<string, unknown>,
	property: string,
	value: string,
) {
	const data = yield* checkedStrings(owner[property]);
	if (!data.entries.includes(value))
		owner[property] = {
			...(record(data.raw) ? data.raw : {}),
			string: [...data.entries, value],
		};
});
const sendMail = Effect.fn("Buildings.mail")(function* (
	document: SaveDocument,
	key: string,
) {
	yield* addString(document.SaveGame, "broadcastedMail", `%&SM&%${key}`);
	for (const farmer of yield* progressionFarmers(document)) {
		if (!record(farmer))
			return yield* invalid("A farmer record is unsupported.");
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

/** Helpers move only checked object/furniture collections; opaque shapes must not be silently erased. */
function safeInterior(raw: Record<string, unknown> | undefined): boolean {
	if (!raw) return true;
	const vector = (value: unknown) =>
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
					record(box) &&
					typeof box.Width === "number" &&
					typeof box.Height === "number"),
		);
	const objects = collection(raw.objects, "item"),
		furniture = collection(raw.furniture, "Furniture");
	// Existing helpers expect arrays for nonempty collections. Conservatively leave
	// alternate imported shapes read-only instead of letting the helper drop them.
	return (
		objects.supported &&
		furniture.supported &&
		(!record(raw.objects) ||
			raw.objects.item === undefined ||
			Array.isArray(raw.objects.item)) &&
		(!record(raw.furniture) ||
			raw.furniture.Furniture === undefined ||
			Array.isArray(raw.furniture.Furniture)) &&
		objects.entries.every(
			(entry) =>
				record(entry) &&
				record(entry.key) &&
				vector(entry.key.Vector2) &&
				record(entry.value) &&
				item(entry.value.Object),
		) &&
		furniture.entries.every(item)
	);
}
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
			if (!record(farmer))
				return yield* invalid("A farmer record is unsupported.");
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
		(owner) => record(owner) && long(owner.UniqueMultiplayerID) === farmerId,
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
	const game: Record<string, unknown> = document.SaveGame;
	if (game.latestID !== undefined && long(game.latestID) === undefined)
		return yield* invalid("The saved animal ID sequence is unsupported.");
	const id = newAnimalId(farmerId, { latestId: long(game.latestID), taken });
	const raw = createFarmAnimal(type, trimmed, farmerId, id),
		interior = building.interior;
	// Deliberate insertion creates both game serializations while preserving
	// dictionary wrapper members; existing field edits never create missing mirrors.
	const dictionary = animalDictionary(interior);
	// If only the uppercase dictionary existed, retain those animals as well.
	interior.animals = {
		...(record(dictionary.lower.raw) ? dictionary.lower.raw : {}),
		item: [...dictionary.entries, raw],
	};
	interior.Animals = {
		...(record(interior.Animals) ? interior.Animals : {}),
		SerializableDictionaryOfInt64FarmAnimal: {
			...(record(dictionary.upper.raw) ? dictionary.upper.raw : {}),
			item: structuredClone([...dictionary.entries, raw]),
		},
	};
	const home = residents(interior);
	interior.animalsThatLiveHere = {
		...(record(interior.animalsThatLiveHere)
			? interior.animalsThatLiveHere
			: {}),
		long: [...home.ids, id],
	};
	building.raw.currentOccupants = dictionary.entries.length + 1;
	game.latestID = id;
	for (const farmer of yield* progressionFarmers(document)) {
		if (!record(farmer))
			return yield* invalid("A farmer record is unsupported.");
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
		const farms = collection(
			snapshot.state.document.SaveGame.locations,
			"GameLocation",
		).entries.filter((row) => record(row) && row.name === "Farm");
		if (
			typeof value !== "boolean" ||
			!view?.supported ||
			view.repaired === undefined ||
			farms.length !== 1 ||
			!record(farms[0])
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
