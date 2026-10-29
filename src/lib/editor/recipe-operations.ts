import { Data, Effect, Result, Schema } from "effect";
import { farmers, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { recipeDefinitions, type RecipeKind } from "./recipe-data.ts";

export class RecipeInvalid extends Data.TaggedError("RecipeInvalid")<{
	readonly message: string;
}> {}
const target = {
	farmerId: Schema.String,
	recipeKind: Schema.Literals(["cooking", "crafting"]),
	name: Schema.String,
};
const changeSchema = Schema.Union([
	Schema.Struct({
		...target,
		kind: Schema.Literal("known"),
		value: Schema.Boolean,
	}),
	Schema.Struct({
		...target,
		kind: Schema.Literal("count"),
		value: Schema.Number.check(
			Schema.isInt(),
			Schema.isBetween({ minimum: 0, maximum: 2147483647 }),
		),
	}),
	Schema.Struct({ ...target, kind: Schema.Literal("reset") }),
]);
export type RecipeChange = typeof changeSchema.Type;
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});
const record = (v: unknown): v is Record<string, unknown> =>
	v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number =>
	typeof v === "number" && Number.isSafeInteger(v);
const id = (v: unknown) =>
	typeof v === "string" && v.length > 0
		? v
		: typeof v === "number" && Number.isFinite(v)
			? String(v)
			: undefined;
const owners = (doc: SaveDocument) =>
	farmers(doc).flatMap((owner) => (record(owner) ? [owner] : []));
const keyOf = (entry: unknown, numeric = false) =>
	record(entry) && record(entry.key)
		? numeric
			? id(entry.key.string)
			: typeof entry.key.string === "string"
				? entry.key.string
				: undefined
		: undefined;
function savedCount(entry: unknown) {
	return record(entry) && record(entry.value) && integer(entry.value.int)
		? entry.value.int
		: undefined;
}
function dictionary(raw: unknown) {
	// Empty XML dictionaries are safe explicit insertion targets. Omitted/opaque
	// containers remain unsupported; reading never manufactures save structure.
	if (raw === "") return { supported: true, raw, entries: [] as unknown[] };
	if (!record(raw) || raw["@_xsi:nil"] === true || raw["@_xsi:nil"] === "true")
		return { supported: false, raw, entries: [] as unknown[] };
	const item = raw.item;
	return {
		supported: item === undefined || Array.isArray(item) || record(item),
		raw,
		entries: item === undefined ? [] : Array.isArray(item) ? item : [item],
	};
}
type Dictionary = ReturnType<typeof dictionary>;
function replaceEntries(
	owner: Record<string, unknown>,
	property: string,
	data: Dictionary,
	entries: unknown[],
) {
	// Retain singleton form when there is still one entry. Array containers retain
	// their representation and all wrapper metadata through updates/removals.
	const raw = record(data.raw) ? data.raw : {};
	const singleton = record(raw.item);
	owner[property] = {
		...raw,
		...(entries.length === 0 && singleton
			? {}
			: { item: singleton && entries.length === 1 ? entries[0] : entries }),
	};
	if (entries.length === 0 && singleton && record(owner[property]))
		delete owner[property].item;
}
export interface RecipeRow {
	name: string;
	known: boolean;
	supported: boolean;
	reason?: string;
	count?: number;
	hasCookedEntry: boolean;
	countSupported: boolean;
	countReason?: string;
	outputName?: string;
	outputId?: string;
}
export interface RecipeFarmerView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	cooking: RecipeRow[];
	crafting: RecipeRow[];
}
const propertyFor = (kind: RecipeKind) =>
	kind === "cooking" ? "cookingRecipes" : "craftingRecipes";
function rows(
	owner: Record<string, unknown>,
	kind: RecipeKind,
	unique: boolean,
): RecipeRow[] {
	const knowledge = dictionary(owner[propertyFor(kind)]);
	const counts =
		kind === "cooking" ? dictionary(owner.recipesCooked) : knowledge;
	const definitions = recipeDefinitions(kind);
	const names = [
		...definitions.map((row) => row.name),
		...knowledge.entries.flatMap((entry) => {
			const name = keyOf(entry);
			return name && !definitions.some((row) => row.name === name)
				? [name]
				: [];
		}),
	];
	return [...new Set(names)].map((name) => {
		const definition = definitions.find((row) => row.name === name);
		const matches = knowledge.entries.filter((entry) => keyOf(entry) === name);
		const known = matches.length > 0;
		const supported =
			unique &&
			knowledge.supported &&
			matches.length <= 1 &&
			(!known || savedCount(matches[0]) !== undefined);
		const outputId = definition?.outputId;
		// Cooking knowledge values are not production counters. The game reads
		// recipesCooked by output item ID, while crafting stores counts in knowledge.
		const countKeysSupported = counts.entries.every(
			(entry) => keyOf(entry, kind === "cooking") !== undefined,
		);
		const counted =
			kind === "crafting"
				? matches
				: outputId === undefined
					? []
					: counts.entries.filter((entry) => keyOf(entry, true) === outputId);
		const countSupported =
			unique &&
			counts.supported &&
			countKeysSupported &&
			(kind === "crafting" ? supported && known : outputId !== undefined) &&
			counted.length <= 1 &&
			(counted.length === 0 || savedCount(counted[0]) !== undefined);
		return {
			name,
			known,
			supported,
			reason: supported
				? undefined
				: "This saved recipe knowledge is unsupported or ambiguous.",
			count:
				!counts.supported || !countKeysSupported
					? undefined
					: counted.length === 0
						? 0
						: savedCount(counted[0]),
			hasCookedEntry: kind === "cooking" && counted.length > 0,
			countSupported,
			countReason: countSupported
				? undefined
				: kind === "crafting" && !known
					? "Learn this recipe before changing its crafted count."
					: !outputId && kind === "cooking"
						? "The output of this imported recipe is unknown; its cooked count cannot be edited safely."
						: "This saved production counter is unsupported or ambiguous.",
			outputName: definition?.outputName,
			outputId,
		};
	});
}
/** Project supported vanilla and imported recipes without adding known recipes or counts. */
export function readRecipes(document: SaveDocument): RecipeFarmerView[] {
	const all = owners(document);
	return all.map((owner) => {
		const farmerId = id(owner.UniqueMultiplayerID);
		const supported =
			farmerId !== undefined &&
			all.filter((other) => id(other.UniqueMultiplayerID) === farmerId)
				.length === 1;
		return {
			farmerId: farmerId ?? "",
			name: typeof owner.name === "string" ? owner.name : "Unnamed farmer",
			supported,
			reason: supported
				? undefined
				: "Choose a farmer with an unambiguous saved identifier.",
			cooking: rows(owner, "cooking", supported),
			crafting: rows(owner, "crafting", supported),
		};
	});
}
/** Revalidate the captured farmer/recipe against the queued document and publish atomically. */
export const setRecipe = Effect.fn("Recipes.set")(function* (
	input: RecipeChange,
) {
	const decoded = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(decoded))
		return yield* new RecipeInvalid({
			message: "Choose a valid recipe change.",
		});
	const request = decoded.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = owners(snapshot.state.document).filter(
		(owner) => id(owner.UniqueMultiplayerID) === request.farmerId,
	);
	const owner = matches[0];
	if (matches.length !== 1 || !owner)
		return yield* new RecipeInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	const row = rows(owner, request.recipeKind, true).find(
		(row) => row.name === request.name,
	);
	if (!row)
		return yield* new RecipeInvalid({
			message: "This recipe is not available.",
		});
	const property = propertyFor(request.recipeKind);
	const data = dictionary(owner[property]);
	let label: string;
	if (request.kind === "known") {
		if (!row.supported)
			return yield* new RecipeInvalid({
				message: row.reason ?? "This recipe cannot be edited.",
			});
		if (row.known === request.value) return;
		if (request.value) {
			if (
				!recipeDefinitions(request.recipeKind).some(
					(def) => def.name === request.name,
				)
			)
				return yield* new RecipeInvalid({
					message: "Unknown recipes cannot be created.",
				});
			replaceEntries(owner, property, data, [
				...data.entries,
				{ key: { string: request.name }, value: { int: 0 } },
			]);
		} else
			replaceEntries(
				owner,
				property,
				data,
				data.entries.filter((entry) => keyOf(entry) !== request.name),
			);
		// Forgetting cooking knowledge intentionally retains historical recipesCooked.
		// Crafting has one dictionary, so forgetting removes its counter as in the game.
		label = `${request.value ? "Learn" : "Forget"} ${request.name}`;
	} else {
		if (!row.countSupported)
			return yield* new RecipeInvalid({
				message: row.countReason ?? "This production counter cannot be edited.",
			});
		const value = request.kind === "reset" ? 0 : request.value;
		// The cooking achievement check counts existing keys even at zero. A reset
		// deliberately removes that record; ordinary numeric zero retains its shape.
		if (
			row.count === value &&
			!(
				request.kind === "reset" &&
				request.recipeKind === "cooking" &&
				row.hasCookedEntry
			)
		)
			return;
		const countProperty =
			request.recipeKind === "cooking" ? "recipesCooked" : property;
		const counts = dictionary(owner[countProperty]);
		const counterKey =
			request.recipeKind === "cooking" ? row.outputId : request.name;
		if (counterKey === undefined)
			return yield* new RecipeInvalid({
				message: "This recipe's output is unknown.",
			});
		const found = counts.entries.find(
			(entry) => keyOf(entry, request.recipeKind === "cooking") === counterKey,
		);
		// Update only the integer member of an existing entry, retaining original key
		// spelling/type and opaque dictionary/entry/value members byte-for-byte in JSON.
		if (request.kind === "reset" && request.recipeKind === "cooking")
			replaceEntries(
				owner,
				countProperty,
				counts,
				counts.entries.filter((entry) => keyOf(entry, true) !== counterKey),
			);
		else if (record(found) && record(found.value)) found.value.int = value;
		else
			replaceEntries(owner, countProperty, counts, [
				...counts.entries,
				{ key: { string: counterKey }, value: { int: value } },
			]);
		label = `${request.kind === "reset" ? "Reset" : "Update"} ${request.name} ${request.recipeKind === "cooking" ? "cooked" : "crafted"} count`;
	}
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label,
			emphasis: "standalone",
			tags: [
				"recipes",
				`recipes:${request.recipeKind}`,
				`farmer:${request.farmerId}`,
			],
		}),
	);
});
