import { Data, Effect, Result, Schema } from "effect";
import { farmers, type SaveDocument } from "./domain.ts";
import { toEventId } from "../eventId.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/** Expected rejection of unsupported imported data or a stale event target. */
export class EventInvalid extends Data.TaggedError("EventInvalid")<{
	readonly message: string;
}> {}
const changeSchema = Schema.Struct({
	farmerId: Schema.String,
	id: Schema.String,
	seen: Schema.Boolean,
});
export type EventChange = typeof changeSchema.Type;
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});
const record = (v: unknown): v is Record<string, unknown> =>
	v !== null && typeof v === "object" && !Array.isArray(v);
const farmerId = (v: unknown) =>
	typeof v === "string" && v.length > 0
		? v
		: typeof v === "number" && Number.isFinite(v)
			? String(v)
			: undefined;
const owners = (doc: SaveDocument) =>
	farmers(doc).flatMap((owner) => (record(owner) ? [owner] : []));
function eventId(v: unknown) {
	// Imported scalar spelling remains authoritative. Never normalize an imported
	// string or accept an unsafe parsed integer as a reliable target identity.
	return typeof v === "string"
		? v
		: typeof v === "number" &&
			  Number.isFinite(v) &&
			  (!Number.isInteger(v) || Number.isSafeInteger(v))
			? String(v)
			: undefined;
}
function container(owner: Record<string, unknown>) {
	const raw = owner.eventsSeen;
	if (raw === "")
		return { supported: true, raw, entries: [] as unknown[], array: false };
	if (!record(raw) || raw["@_xsi:nil"] === true || raw["@_xsi:nil"] === "true")
		return { supported: false, raw, entries: [] as unknown[], array: false };
	const value = raw.int;
	// A singleton scalar is retained until an explicit insertion needs a list.
	// Opaque members in a valid array remain preserved during independent edits.
	return {
		supported:
			value === undefined ||
			Array.isArray(value) ||
			typeof value === "string" ||
			typeof value === "number",
		raw,
		entries: value === undefined ? [] : Array.isArray(value) ? value : [value],
		array: Array.isArray(value),
	};
}
export interface EventSeenView {
	id: string;
	supported: boolean;
	reason?: string;
}
export interface EventFarmerView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	seen: EventSeenView[];
	seenCount: number;
	unsupportedCount: number;
}
function project(
	owner: Record<string, unknown>,
	unique: boolean,
): EventFarmerView {
	const data = container(owner);
	const ids = data.entries.map(eventId);
	// The game treats membership as a set. Show one row per readable identity,
	// but retain every imported occurrence in storage and disable ambiguous rows.
	const distinct = [
		...new Set(ids.filter((id): id is string => id !== undefined)),
	];
	const supported = unique && data.supported;
	return {
		farmerId: farmerId(owner.UniqueMultiplayerID) ?? "",
		name: typeof owner.name === "string" ? owner.name : "Unnamed farmer",
		supported,
		reason: !unique
			? "Choose a farmer with an unambiguous saved identifier."
			: !data.supported
				? "This farmer's saved event list is unsupported."
				: undefined,
		seen: distinct.map((id) => {
			const editable =
				supported &&
				toEventId(id) === id &&
				ids.filter((candidate) => candidate === id).length === 1;
			return {
				id,
				supported: editable,
				reason: editable
					? undefined
					: "This imported event ID is ambiguous or cannot be edited without changing its saved representation.",
			};
		}),
		seenCount: distinct.length,
		unsupportedCount: ids.filter((id) => id === undefined).length,
	};
}
/** Detached event IDs; merely opening the page never deduplicates or normalizes them. */
export function readEvents(document: SaveDocument): EventFarmerView[] {
	const all = owners(document);
	return all.map((owner) => {
		const id = farmerId(owner.UniqueMultiplayerID);
		return project(
			owner,
			id !== undefined &&
				all.filter((other) => farmerId(other.UniqueMultiplayerID) === id)
					.length === 1,
		);
	});
}
/** Set one event's membership without simulating its rewards or undoing past rewards. */
export const setEventSeen = Effect.fn("Events.setSeen")(function* (
	input: EventChange,
) {
	// Only own request fields authorize writes; unexpected properties reject the
	// whole operation before it can obtain and publish a transaction draft.
	const decoded = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(decoded))
		return yield* new EventInvalid({ message: "Choose a valid event edit." });
	const request = decoded.success;
	const id = toEventId(request.id);
	if (id === undefined)
		return yield* new EventInvalid({
			message:
				"Use a plain, exact event ID without spaces, slashes, boolean literals or imprecise numbers.",
		});
	// Typed additions may drop leading zeros. Removals must address the exact
	// existing spelling, so a stale custom-ID command cannot delete another ID.
	if (!request.seen && id !== request.id)
		return yield* new EventInvalid({
			message: "Choose the exact saved event ID to remove.",
		});
	// Resolve the captured farmer against the current queued snapshot, rather
	// than a position or a view that may predate selection/document changes.
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = owners(snapshot.state.document).filter(
		(owner) => farmerId(owner.UniqueMultiplayerID) === request.farmerId,
	);
	const owner = matches[0];
	if (matches.length !== 1 || !owner)
		return yield* new EventInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	const view = project(owner, true);
	if (!view.supported)
		return yield* new EventInvalid({
			message: view.reason ?? "Events are unavailable.",
		});
	const saved = view.seen.find((row) => row.id === id);
	if (saved && !saved.supported)
		return yield* new EventInvalid({
			message: saved.reason ?? "This imported event cannot be edited.",
		});
	// Repeating an already satisfied membership action is a true no-op: it
	// neither repairs imported shapes nor manufactures an Undo entry.
	if (request.seen === (saved !== undefined)) return;
	const data = container(owner);
	const entries = request.seen
		? [...data.entries, id]
		: data.entries.filter((value) => eventId(value) !== id);
	// Preserve dictionary metadata and singleton form. Empty singleton removal
	// deletes only its payload; an existing array remains an array for exact Undo.
	const next = record(data.raw) ? { ...data.raw } : {};
	if (entries.length === 0 && !data.array) delete next.int;
	else next.int = !data.array && entries.length === 1 ? entries[0] : entries;
	owner.eventsSeen = next;
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Mark event ${id} as ${request.seen ? "seen" : "not seen"}`,
			emphasis: "standalone",
			tags: ["events", `farmer:${request.farmerId}`],
		}),
	);
});
