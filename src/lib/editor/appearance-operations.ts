import { samePlainData } from "./plain-data.ts";
import {
	appearanceLayers,
	type AppearancePreviewView,
} from "./appearance-preview.ts";
import { Data, Effect, Result, Schema } from "effect";
import { colorHex, itemColorPatch } from "../color.ts";
import { farmers, type Farmer, type SaveDocument } from "./domain.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

// The codec decodes Int64 IDs as bigint. Missing IDs cannot identify an owner;
// present IDs become strings only for the editor's selection keys.
const idOf = (owner: Farmer) => owner.UniqueMultiplayerID?.toString();
export const appearanceNumbers = [
	{ key: "skin", label: "Skin", raw: "skin", min: 0, max: 23 },
	{ key: "hair", label: "Hairstyle", raw: "hair", min: 0, max: 73 },
	{ key: "accessory", label: "Accessory", raw: "accessory", min: -1, max: 29 },
] as const;
export class AppearanceInvalid extends Data.TaggedError("AppearanceInvalid")<{
	readonly message: string;
}> {}
const integerBetween = (min: number, max: number) =>
	Schema.Number.check(
		Schema.isInt(),
		Schema.isBetween({ minimum: min, maximum: max }),
	);
const changeSchema = Schema.Union([
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literals(["name", "favorite"]),
		value: Schema.String,
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("gender"),
		value: Schema.Literals(["Male", "Female"]),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("skin"),
		value: integerBetween(0, 23),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("hair"),
		value: integerBetween(0, 73),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literal("accessory"),
		value: integerBetween(-1, 29),
	}),
	Schema.Struct({
		farmerId: Schema.String,
		kind: Schema.Literals(["hair-color", "eye-color"]),
		value: Schema.String.check(Schema.isPattern(/^#[0-9a-f]{6}$/i)),
	}),
]);
// UI snapshots can contain custom strings; runtime decoding below is the
// authority that turns this permissive editor request into a checked command.
export interface AppearanceChange {
	farmerId: string;
	kind: (typeof changeSchema.Type)["kind"];
	value: string | number;
}
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});
export interface AppearanceValue<T> {
	value?: T;
	available: boolean;
	reason?: string;
}
/** Read model exposes editor names and checked values, never raw field conventions. */
export interface AppearanceView {
	farmerId: string;
	name: string;
	supported: boolean;
	reason?: string;
	texts: { name: AppearanceValue<string>; favorite: AppearanceValue<string> };
	gender: AppearanceValue<string>;
	numbers: {
		key: "skin" | "hair" | "accessory";
		label: string;
		min: number;
		max: number;
		value?: number;
		available: boolean;
		reason?: string;
	}[];
	colors: {
		key: "hair-color" | "eye-color";
		label: string;
		value?: string;
		available: boolean;
		reason?: string;
	}[];
	/** Complete drawing instructions, not a detached copy of saved appearance fields. */
	preview: AppearancePreviewView;
}
function checked<T>(
	value: T | undefined,
	available: boolean,
): AppearanceValue<T> {
	return {
		value,
		available,
		reason: available
			? undefined
			: "This saved appearance value is unsupported.",
	};
}
/** Inspection never constructs reactive proxies or repairs imported values. */
export function readAppearances(document: SaveDocument): AppearanceView[] {
	const all = farmers(document);
	return all.map((owner) => {
		const id = idOf(owner);
		const supported =
			id !== undefined &&
			all.filter((candidate) => idOf(candidate) === id).length === 1;
		const gender = typeof owner.gender === "string" ? owner.gender : undefined;
		return {
			farmerId: id ?? "",
			name: typeof owner.name === "string" ? owner.name : "Unnamed farmer",
			supported,
			reason: supported
				? undefined
				: "Choose a farmer with an unambiguous saved identifier.",
			texts: {
				name: checked(
					typeof owner.name === "string" ? owner.name : undefined,
					supported && typeof owner.name === "string",
				),
				favorite: checked(
					typeof owner.favoriteThing === "string"
						? owner.favoriteThing
						: undefined,
					supported && typeof owner.favoriteThing === "string",
				),
			},
			gender: checked(
				gender,
				supported &&
					(gender === "Male" || gender === "Female") &&
					(!Object.hasOwn(owner, "Gender") || typeof owner.Gender === "string"),
			),
			numbers: appearanceNumbers.map((def) => {
				const raw = owner[def.raw];
				// The codec guarantees an integer when this optional field is present.
				// The second hair sheet starts at save ID100 but follows ID55 in the picker.
				const value =
					raw !== undefined
						? def.key === "hair" && raw >= 100
							? raw - 44
							: raw
						: undefined;
				return {
					key: def.key,
					label: def.label,
					min: def.min,
					max: def.max,
					value,
					available: supported && value !== undefined,
					reason:
						supported && value !== undefined
							? undefined
							: "This saved appearance index is unsupported.",
				};
			}),
			colors: (
				[
					["hair-color", "Hair color", "hairstyleColor"],
					["eye-color", "Eye color", "newEyeColor"],
				] as const
			).map(([key, label, raw]) => {
				const value = colorHex(owner[raw]);
				return {
					key,
					label,
					...checked(value, supported && value !== undefined),
				};
			}),
			// Resolve saved indices, colors and equipment at the domain boundary.
			// The UI receives only drawing layers and notices, with no save references.
			preview: appearanceLayers(supported ? owner : undefined),
		};
	});
}
/** Apply one captured farmer edit with expected validation failures in Effect. */
export const setAppearance = Effect.fn("Appearance.set")(function* (
	input: AppearanceChange,
) {
	// Decode only the request's own fields; the schema rejects unsupported
	// shapes and values without a separate object-shape predicate.
	const result = decode({ ...input });
	if (Result.isFailure(result))
		return yield* new AppearanceInvalid({
			message: "Choose a valid appearance value.",
		});
	const request = result.success;
	const draft = yield* TransactionDraft;
	const snapshot = yield* draft.read;
	const all = farmers(snapshot.state.document),
		matching = all.filter((owner) => idOf(owner) === request.farmerId);
	const owner = matching[0];
	if (matching.length !== 1 || !owner)
		return yield* new AppearanceInvalid({
			message: "This farmer is no longer available.",
		});
	const view = readAppearances(snapshot.state.document).find(
		(view) => view.farmerId === request.farmerId,
	);
	if (!view?.supported)
		return yield* new AppearanceInvalid({
			message: "This farmer cannot be edited safely.",
		});
	let raw: string;
	let value: unknown = request.value;
	if (request.kind === "name" || request.kind === "favorite") {
		if (
			!view.texts[request.kind].available ||
			(request.kind === "name" && request.value.length === 0)
		)
			return yield* new AppearanceInvalid({
				message: "Enter a supported character name or favorite thing.",
			});
		raw = request.kind === "name" ? "name" : "favoriteThing";
	} else if (request.kind === "gender") {
		if (!view.gender.available)
			return yield* new AppearanceInvalid({
				message: "This saved gender cannot be edited safely.",
			});
		raw = "gender";
		// The game serializes both mirrors; the explicit gender action updates both.
		if (owner.gender === value && owner.Gender === value) return;
		owner.Gender = value;
	} else if (request.kind === "hair-color" || request.kind === "eye-color") {
		raw = request.kind === "hair-color" ? "hairstyleColor" : "newEyeColor";
		const replacement = itemColorPatch(owner[raw], request.value);
		if (!replacement)
			return yield* new AppearanceInvalid({
				message: "This saved color cannot be edited safely.",
			});
		value = replacement;
	} else {
		const def = appearanceNumbers.find((def) => def.key === request.kind);
		if (
			!def ||
			!view.numbers.find((field) => field.key === request.kind)?.available
		)
			return yield* new AppearanceInvalid({
				message: "This saved appearance index cannot be edited safely.",
			});
		raw = def.raw;
		// Re-encode only this explicit change; imported custom IDs survive inspection.
		value =
			request.kind === "hair" && request.value >= 56
				? request.value + 44
				: request.value;
	}
	if (samePlainData(owner[raw], value) && request.kind !== "gender") return;
	owner[raw] = value;
	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${request.kind === "favorite" ? "favorite thing" : request.kind}`,
			emphasis: "standalone",
			tags: ["appearance", `farmer:${request.farmerId}`],
		}),
	);
});
