import { Data, Effect, Result, Schema, SchemaIssue } from "effect";
import {
	readCharacterDetails,
	type CharacterDetailsView,
} from "./character-details.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

import {
	skillDefinitions,
	skillXpForLevel,
	masteryXpForLevel,
	professionDefinitions,
	type SkillKey,
} from "./character-data.ts";
// Preserve existing operation consumers while presentation imports the pure data.
export {
	skillDefinitions,
	skillXpForLevel,
	masteryXpForLevel,
	professionDefinitions,
	type SkillKey,
} from "./character-data.ts";
/** Requested edits validate separately from imported baselines, which may be custom. */
export class CharacterInvalid extends Data.TaggedError("CharacterInvalid")<{
	readonly message: string;
}> {}
const skill = Schema.Literals([
	"farming",
	"fishing",
	"foraging",
	"mining",
	"combat",
]);
const integer = (min: number, max: number) =>
	Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: min, maximum: max }),
	);
export const CharacterChangeSchema = Schema.Union([
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("skill-xp"),
		skill,
		value: integer(0, 99999),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("skill-level"),
		skill,
		value: integer(0, 10),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("profession"),
		profession: integer(0, 29),
		enabled: Schema.Boolean,
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("mastery-xp"),
		value: integer(0, 2147483647),
	}),
]);
export type CharacterChange = typeof CharacterChangeSchema.Type;
const decode = Schema.decodeUnknownResult(CharacterChangeSchema, {
	onExcessProperty: "error",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
/** Only own request fields can authorize an edit; callers share this decoder with the UI. */
export function decodeCharacterChange(
	input: unknown,
): Result.Result<CharacterChange, CharacterInvalid> {
	const result = decode(record(input) ? { ...input } : input);
	return Result.isFailure(result)
		? Result.fail(
				new CharacterInvalid({
					message:
						formatter(result.failure.issue).issues[0]?.message ??
						"Choose valid character settings.",
				}),
			)
		: Result.succeed(result.success);
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const uint = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= 4294967295;
// The narrow core Farmer interface intentionally omits character data. Inspect a
// checked plain-record lens rather than asserting the entire generated save type.
const characterFarmers = (document: SaveDocument): Record<string, unknown>[] =>
	farmers(document).flatMap((value) => (record(value) ? [value] : []));
const scalarId = (farmer: Record<string, unknown>) => {
	const value = farmer.UniqueMultiplayerID;
	return typeof value === "string" && value.length > 0
		? value
		: typeof value === "number" && Number.isFinite(value)
			? String(value)
			: undefined;
};
/** Level projections do not repair differing saved mirrors just because a page was opened. */
export const skillLevel = (xp: number) =>
	skillXpForLevel.filter((threshold) => xp >= threshold).length - 1;
// The game stores unsigned stats but casts MasteryExp to signed int before
// calculating levels. Preserve oversized imported values while matching that read.
export const masteryLevel = (xp: number) =>
	Math.max(
		0,
		masteryXpForLevel.filter((threshold) => (xp | 0) >= threshold).length - 1,
	);
export interface SkillView {
	key: SkillKey;
	label: string;
	xp?: number;
	level?: number;
	supported: boolean;
	reason?: string;
}
export interface CharacterView {
	details: CharacterDetailsView;
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	skills: SkillView[];
	professions: {
		supported: boolean;
		values: readonly number[];
		reason?: string;
	};
	mastery: {
		supported: boolean;
		xp?: number;
		level?: number;
		minXp: number;
		spent: number;
		reason?: string;
	};
}
function readProfessionList(farmer: Record<string, unknown>) {
	const raw = farmer.professions;
	const saved = record(raw) ? raw.int : undefined;
	const values =
		saved === undefined ? [] : Array.isArray(saved) ? saved : [saved];
	const supported =
		(raw === "" || record(raw)) &&
		values.every(
			(value) => typeof value === "number" && Number.isInteger(value),
		);
	return { supported, values: supported ? (values as number[]) : [] };
}
interface StatDictionary {
	supported: boolean;
	entries: unknown[];
	singleton: boolean;
}
function statDictionary(farmer: Record<string, unknown>): StatDictionary {
	const stats = farmer.stats;
	if (!record(stats))
		return { supported: false, entries: [], singleton: false };
	const values = stats.Values;
	if (values === undefined || values === "")
		return { supported: true, entries: [], singleton: false };
	if (!record(values))
		return { supported: false, entries: [], singleton: false };
	const items = values.item;
	if (items === undefined)
		return { supported: true, entries: [], singleton: false };
	return {
		supported: Array.isArray(items) || record(items),
		entries: Array.isArray(items) ? items : [items],
		singleton: record(items),
	};
}
function statValue(dictionary: StatDictionary, key: string) {
	// Ignore opaque unrelated entries, but never select an arbitrary duplicate of
	// a relevant case-insensitive game key. Its meaning would be ambiguous on load.
	const matches = dictionary.entries.flatMap((entry, index) =>
		record(entry) &&
		record(entry.key) &&
		typeof entry.key.string === "string" &&
		entry.key.string.toLowerCase() === key.toLowerCase()
			? [{ entry, index }]
			: [],
	);
	const match = matches[0];
	const value =
		match && record(match.entry.value)
			? match.entry.value.unsignedInt
			: undefined;
	return {
		supported:
			dictionary.supported && matches.length <= 1 && (!match || uint(value)),
		value: match && uint(value) ? value : 0,
		index: match?.index,
	};
}
function readMastery(farmer: Record<string, unknown>) {
	const dictionary = statDictionary(farmer),
		xp = statValue(dictionary, "MasteryExp"),
		spent = statValue(dictionary, "MasteryLevelsSpent");
	const claims = [0, 1, 2, 3, 4].map((index) =>
		statValue(dictionary, `mastery_${index}`),
	);
	const supported =
		xp.supported && spent.supported && claims.every((claim) => claim.supported);
	// Match the existing editor's conservative lower bound: claimed skill flags and
	// the game's spent counter both count, and there are only five mastery rewards.
	const count = Math.min(
		5,
		Math.max(spent.value, claims.filter((claim) => claim.value > 0).length),
	);
	const minXp = masteryXpForLevel[count] ?? 0;
	return {
		supported,
		xp: xp.value,
		level: masteryLevel(xp.value),
		spent: count,
		minXp,
	};
}
/** Project only unambiguous farmers; opaque fields and inconsistent imported mirrors stay intact. */
export function readCharacters(document: SaveDocument): CharacterView[] {
	const all = characterFarmers(document);
	return all.map((farmer) => {
		const id = scalarId(farmer),
			supported =
				id !== undefined &&
				all.filter((other) => scalarId(other) === id).length === 1;
		const experience = record(farmer.experiencePoints)
			? farmer.experiencePoints.int
			: undefined;
		const professions = readProfessionList(farmer),
			mastery = readMastery(farmer);
		return {
			farmerId: id ?? "",
			details: readCharacterDetails(document, id ?? ""),
			name:
				typeof farmer.name === "string" && farmer.name
					? farmer.name
					: "Unnamed farmer",
			supported,
			...(!supported
				? {
						reason:
							"This farmer does not have an unambiguous saved identifier.",
					}
				: {}),
			skills: skillDefinitions.map((definition) => {
				const xp = Array.isArray(experience)
					? experience[definition.index]
					: undefined;
				const usable = supported && uint(xp);
				return {
					key: definition.key,
					label: definition.label,
					supported: usable,
					...(uint(xp) ? { xp, level: skillLevel(xp) } : {}),
					...(!usable
						? {
								reason:
									"This skill's saved experience is missing or unsupported.",
							}
						: {}),
				};
			}),
			professions: {
				...professions,
				supported: supported && professions.supported,
				...(!professions.supported
					? {
							reason:
								"This farmer's saved professions cannot be edited safely.",
						}
					: {}),
			},
			mastery: {
				...mastery,
				supported: supported && mastery.supported,
				...(!mastery.supported
					? {
							reason:
								"This farmer's mastery stats are missing, malformed, or ambiguous.",
						}
					: {}),
			},
		};
	});
}

/** Write a deliberate XP/stat/profession edit through the shared atomic transaction boundary. */
export const setCharacter = Effect.fn("Character.set")(function* (
	input: CharacterChange,
) {
	const decoded = decodeCharacterChange(input);
	if (Result.isFailure(decoded)) return yield* decoded.failure;
	const request = decoded.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const matches = characterFarmers(snapshot.state.document).filter(
		(farmer) => scalarId(farmer) === request.farmerId,
	);
	const farmer = matches[0];
	if (matches.length !== 1 || !farmer)
		return yield* new CharacterInvalid({
			message: "Choose a farmer with an unambiguous saved identifier.",
		});
	let label: string;
	if (request.kind === "skill-xp" || request.kind === "skill-level") {
		const definition = skillDefinitions.find(
			(definition) => definition.key === request.skill,
		);
		if (!definition)
			return yield* new CharacterInvalid({
				message: "Choose a supported skill.",
			});
		const container = farmer.experiencePoints;
		const values = record(container) ? container.int : undefined;
		const previous = Array.isArray(values)
			? values[definition.index]
			: undefined;
		if (!Array.isArray(values) || !uint(previous))
			return yield* new CharacterInvalid({
				message: "This skill's saved experience cannot be edited safely.",
			});
		// Choosing the current derived level keeps progress within that level. An
		// unchanged XP request also leaves an unusual imported level mirror untouched.
		if (
			(request.kind === "skill-level" &&
				skillLevel(previous) === request.value) ||
			(request.kind === "skill-xp" && previous === request.value)
		)
			return;
		const xp =
			request.kind === "skill-xp"
				? request.value
				: skillXpForLevel[request.value];
		if (xp === undefined)
			return yield* new CharacterInvalid({
				message: "Choose a level from 0 to 10.",
			});
		values[definition.index] = xp;
		farmer[definition.levelField] = skillLevel(xp);
		// These are direct save edits, matching v1: do not simulate an overnight level
		// menu, award recipes, rewrite pending newLevels, or change health/stamina.
		label = `Update ${definition.label.toLowerCase()} for ${typeof farmer.name === "string" ? farmer.name : "farmer"}`;
	} else if (request.kind === "profession") {
		const list = readProfessionList(farmer);
		if (!list.supported)
			return yield* new CharacterInvalid({
				message: "This farmer's saved professions cannot be edited safely.",
			});
		if (list.values.includes(request.profession) === request.enabled) return;
		let values = [...list.values];
		const definition = professionDefinitions[request.profession];
		if (!definition)
			return yield* new CharacterInvalid({
				message: "Choose a supported profession.",
			});
		if (request.enabled) {
			// A new secondary brings its prerequisite along in the same undo step. Existing
			// other branches, duplicate IDs, and unknown mod professions remain unchanged.
			if (
				definition.parent !== undefined &&
				!values.includes(definition.parent)
			)
				values.push(definition.parent);
			values.push(request.profession);
		} else {
			// Removing a parent removes its two descendants; explicit removal owns all
			// matching copies, without deduplicating unrelated imported professions.
			const removed = new Set([
				request.profession,
				...professionDefinitions
					.filter((item) => item.parent === request.profession)
					.map((item) => item.id),
			]);
			values = values.filter((value) => !removed.has(value));
		}
		const raw = farmer.professions;
		const previous = record(raw) ? raw.int : undefined;
		farmer.professions = {
			...(record(raw) ? raw : {}),
			int:
				values.length === 1 && typeof previous === "number"
					? values[0]
					: values,
		};
		label = `${request.enabled ? "Enable" : "Remove"} ${definition.name}`;
	} else {
		const mastery = readMastery(farmer);
		if (!mastery.supported)
			return yield* new CharacterInvalid({
				message: "This farmer's mastery stats cannot be edited safely.",
			});
		if (request.value < mastery.minXp)
			return yield* new CharacterInvalid({
				message: `${mastery.spent} claimed masteries require at least ${mastery.minXp} Mastery XP.`,
			});
		if (request.value === mastery.xp) return;
		const dictionary = statDictionary(farmer),
			current = statValue(dictionary, "MasteryExp");
		const stats = farmer.stats;
		if (!record(stats))
			return yield* new CharacterInvalid({
				message: "This farmer's mastery stats are unavailable.",
			});
		const container = record(stats.Values) ? stats.Values : {};
		const entries = [...dictionary.entries];
		if (current.index !== undefined) {
			// Update the existing key/value in place, retaining its spelling and all opaque
			// members. Zero may remain explicit instead of discarding that entry's data.
			const entry = entries[current.index];
			if (!record(entry) || !record(entry.value))
				return yield* new CharacterInvalid({
					message: "This mastery stat is malformed.",
				});
			entry.value.unsignedInt = request.value;
		} else
			entries.push({
				key: { string: "MasteryExp" },
				value: { unsignedInt: request.value },
			});
		stats.Values = {
			...container,
			item: dictionary.singleton && entries.length === 1 ? entries[0] : entries,
		};
		// Mastery XP changes available levels only; rewards/claimed flags are never
		// synthesized and ordinary skill edits never earn mastery XP as a side effect.
		label = "Update mastery experience";
	}
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label,
			emphasis: "standalone",
			tags: [
				"character",
				`character:${request.kind}`,
				`farmer:${request.farmerId}`,
			],
		}),
	);
});
