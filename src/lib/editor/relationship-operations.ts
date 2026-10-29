import { Data, Effect, Result, Schema } from "effect";
import { characters, dateableCharacters } from "../NPCs.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/** Expected rejection of an ambiguous target or unsupported imported relationship. */
export class RelationshipInvalid extends Data.TaggedError(
	"RelationshipInvalid",
)<{ readonly message: string }> {}
const integer = (max: number) =>
	Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: 0, maximum: max }),
	);
const changeSchema = Schema.Union([
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("points"),
		name: Schema.String,
		value: integer(3749),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("gifts"),
		name: Schema.String,
		value: integer(7),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("add-missing"),
	}),
]);
export type RelationshipChange = typeof changeSchema.Type;
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const integerValue = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value);
const farmerId = (farmer: Record<string, unknown>) =>
	typeof farmer.UniqueMultiplayerID === "string" &&
	farmer.UniqueMultiplayerID.length > 0
		? farmer.UniqueMultiplayerID
		: typeof farmer.UniqueMultiplayerID === "number" &&
			  Number.isFinite(farmer.UniqueMultiplayerID)
			? String(farmer.UniqueMultiplayerID)
			: undefined;
const owners = (document: SaveDocument) =>
	farmers(document).flatMap((owner) => (record(owner) ? [owner] : []));

/** Presentation retains unknown villagers while exposing only independently checked fields. */
export interface RelationshipView {
	name: string;
	supported: boolean;
	reason?: string;
	points?: number;
	gifts?: number;
	giftsSupported: boolean;
	hearts?: number;
	maxHearts: number;
	maxPoints: number;
}
export interface RelationshipFarmerView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	relationships: RelationshipView[];
	missingCount: number;
}
function dictionary(farmer: Record<string, unknown>) {
	const raw = farmer.friendshipData;
	// Empty XML dictionaries are valid insertion targets. Opaque containers remain
	// read-only; opening the screen never normalizes their representation.
	if (raw === "")
		return { supported: true, entries: [] as unknown[], raw, singleton: false };
	if (!record(raw))
		return {
			supported: false,
			entries: [] as unknown[],
			raw,
			singleton: false,
		};
	const item = raw.item;
	return {
		supported: item === undefined || Array.isArray(item) || record(item),
		entries: item === undefined ? [] : Array.isArray(item) ? item : [item],
		raw,
		singleton: record(item),
	};
}
function entryName(entry: unknown) {
	return record(entry) &&
		record(entry.key) &&
		typeof entry.key.string === "string"
		? entry.key.string
		: undefined;
}
function friendship(entry: unknown) {
	return record(entry) && record(entry.value) && record(entry.value.Friendship)
		? entry.value.Friendship
		: undefined;
}
function project(
	farmer: Record<string, unknown>,
	unique: boolean,
): RelationshipFarmerView {
	const data = dictionary(farmer);
	const names = data.entries.map(entryName);
	// Duplicate names cannot be safely addressed through the game's dictionary key.
	// Keep the first visible row as read-only rather than accidentally selecting one.
	const shown = new Set<string>();
	const relationships = data.entries.flatMap((entry) => {
		const name = entryName(entry);
		if (name === undefined || shown.has(name)) return [];
		shown.add(name);
		const saved = friendship(entry);
		const points = saved?.Points;
		const gifts = saved?.GiftsThisWeek;
		const dateable = dateableCharacters.some((candidate) => candidate === name);
		const status = saved?.Status;
		const maxHearts = dateable
			? status === "Married"
				? 14
				: status === "Dating"
					? 10
					: 8
			: 10;
		const supported =
			unique &&
			data.supported &&
			names.filter((candidate) => candidate === name).length === 1 &&
			!!saved &&
			integerValue(points) &&
			(!dateable || typeof status === "string");
		return [
			{
				name,
				supported,
				reason: supported
					? undefined
					: "This saved relationship is malformed or has an ambiguous villager key.",
				points: integerValue(points) ? points : undefined,
				gifts:
					gifts === undefined ? 0 : integerValue(gifts) ? gifts : undefined,
				giftsSupported:
					supported && (gifts === undefined || integerValue(gifts)),
				hearts: integerValue(points) ? Math.floor(points / 250) : undefined,
				maxHearts,
				maxPoints: maxHearts * 250 + 249,
			},
		];
	});
	return {
		farmerId: farmerId(farmer) ?? "",
		name: typeof farmer.name === "string" ? farmer.name : "Unnamed farmer",
		supported: unique && data.supported,
		reason: !unique
			? "Choose a farmer with an unambiguous saved identifier."
			: !data.supported
				? "This farmer's relationship dictionary is unsupported."
				: undefined,
		relationships,
		missingCount: characters.filter((name) => !names.includes(name)).length,
	};
}
/** Read relationships without constructing proxies, filling defaults, or touching XML. */
export function readRelationships(
	document: SaveDocument,
): RelationshipFarmerView[] {
	const all = owners(document);
	return all.map((owner) => {
		const id = farmerId(owner);
		return project(
			owner,
			id !== undefined &&
				all.filter((other) => farmerId(other) === id).length === 1,
		);
	});
}

/** Apply one targeted relationship edit, preserving every unrelated entry and member. */
export const setRelationship = Effect.fn("Relationships.set")(function* (
	input: RelationshipChange,
) {
	// Copy own fields before decoding so inherited request values cannot authorize writes.
	const decoded = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(decoded))
		return yield* new RelationshipInvalid({
			message: "Choose a valid relationship edit.",
		});
	const request = decoded.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matching = owners(snapshot.state.document).filter(
		(owner) => farmerId(owner) === request.farmerId,
	);
	const owner = matching[0];
	if (matching.length !== 1 || !owner)
		return yield* new RelationshipInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	const view = project(owner, true);
	if (!view.supported)
		return yield* new RelationshipInvalid({
			message: view.reason ?? "Relationships are unavailable.",
		});
	const data = dictionary(owner);
	let label: string;
	if (request.kind === "add-missing") {
		const existing = data.entries.map(entryName);
		const missing = characters.filter((name) => !existing.includes(name));
		if (missing.length === 0) return;
		// This explicit action creates only the vanilla social NPCs. Existing modded,
		// duplicate, or opaque entries stay byte-for-byte represented in the snapshot.
		const entries = [
			...data.entries,
			...missing.map((name) => ({
				key: { string: name },
				value: {
					Friendship: {
						Points: 0,
						GiftsThisWeek: 0,
						GiftsToday: 0,
						TalkedToToday: false,
						ProposalRejected: false,
						Status: "Friendly",
						Proposer: 0,
						RoommateMarriage: false,
					},
				},
			})),
		];
		owner.friendshipData = {
			...(record(data.raw) ? data.raw : {}),
			item: entries,
		};
		label = `Add ${missing.length} missing villagers`;
	} else {
		const row = view.relationships.find((row) => row.name === request.name);
		if (!row?.supported || (request.kind === "gifts" && !row.giftsSupported))
			return yield* new RelationshipInvalid({
				message: row?.reason ?? "This relationship cannot be edited safely.",
			});
		if (request.kind === "points" && request.value > row.maxPoints)
			return yield* new RelationshipInvalid({
				message: `${request.name} currently supports at most ${row.maxPoints} friendship points.`,
			});
		const saved = friendship(
			data.entries.find((entry) => entryName(entry) === request.name),
		);
		if (!saved)
			return yield* new RelationshipInvalid({
				message: "This relationship is no longer available.",
			});
		const property = request.kind === "points" ? "Points" : "GiftsThisWeek";
		if ((request.kind === "points" ? row.points : row.gifts) === request.value)
			return;
		// Points and weekly gifts are independent direct save edits, matching v1.
		// Never infer dating status, gift dates, marriage, dialogue, or gameplay rewards.
		saved[property] = request.value;
		label = `Update ${request.name} ${request.kind === "points" ? "friendship" : "weekly gifts"}`;
	}
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label,
			emphasis: "standalone",
			tags: [
				"relationships",
				`relationships:${request.kind}`,
				`farmer:${request.farmerId}`,
			],
		}),
	);
});
