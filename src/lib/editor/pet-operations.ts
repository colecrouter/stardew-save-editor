import { Data, Effect, Result, Schema } from "effect";
import { inspectPets, supportsPetRecord } from "./pet-data.ts";
import { petAppearances, savedBreedId } from "./pet-appearance.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export class PetInvalid extends Data.TaggedError("PetInvalid")<{
	readonly message: string;
}> {}

const changeSchema = Schema.Union([
	Schema.Struct({
		petId: Schema.String,
		kind: Schema.Literal("name"),
		value: Schema.String,
	}),
	Schema.Struct({
		petId: Schema.String,
		kind: Schema.Literal("friendship"),
		value: Schema.Number.check(
			Schema.isInt(),
			Schema.isBetween({ minimum: 0, maximum: 1000 }),
		),
	}),
	Schema.Struct({
		petId: Schema.String,
		kind: Schema.Literal("appearance"),
		value: Schema.Struct({ petType: Schema.String, breedId: Schema.String }),
	}),
]);
export type PetChange = typeof changeSchema.Type;
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});

/** Re-resolve the captured GUID in the queued transaction. Renames do not touch
 * bowl GUIDs or farmer preferences; friendship changes only the saved points.
 * Pet.GrantLoveMailIfNecessary is game behavior, not an editor reward grant.
 * Appearance follows DebugCommands.ChangePet: update the selected pet's type
 * and breed together, without changing farmer preferences or resetting behavior.
 * Source: local StardewValley.Characters/Pet.cs and DebugCommands.cs. */
export const setPet = Effect.fn("Pets.setPet")(function* (input: PetChange) {
	// Validate the complete command before acquiring mutable snapshot data. Extra
	// properties and out-of-range points are rejected rather than silently ignored.
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* new PetInvalid({
			message: "Choose a valid pet field value.",
		});
	const change = decoded.success;
	if (change.kind === "name" && !change.value.trim())
		return yield* new PetInvalid({ message: "The pet needs a name." });
	const draft = yield* TransactionDraft;
	const snapshot = yield* draft.read;
	const graph = inspectPets(snapshot.state.document);
	const id = change.petId.toLowerCase();
	const pet = graph.pets.find((row) => row.id === id);
	if (
		!graph.supported ||
		!pet ||
		graph.counts.get(id) !== 1 ||
		!supportsPetRecord(pet.raw)
	)
		return yield* new PetInvalid({
			message: "This pet no longer has an unambiguous supported saved record.",
		});
	if (change.kind === "appearance") {
		// Validate the pair against extracted Data/Pets, never a numeric range or
		// the game's missing-breed fallback. A typo must not silently select breed 0.
		const appearance = petAppearances.find(
			(entry) =>
				entry.petType === change.value.petType &&
				entry.breedId === change.value.breedId,
		);
		if (!appearance)
			return yield* new PetInvalid({
				message: "Choose a supported pet appearance.",
			});
		const breed = savedBreedId(pet.raw.whichBreed);
		if (typeof pet.raw.petType !== "string" || !pet.raw.petType || !breed)
			return yield* new PetInvalid({
				message: "This saved pet appearance is unreadable.",
			});
		// Reselecting a known appearance is a true no-op. Preserve the existing
		// numeric/string breed representation even across types if its ID matches.
		if (pet.raw.petType === appearance.petType && breed === appearance.breedId)
			return;
		pet.raw.petType = appearance.petType;
		if (breed !== appearance.breedId) pet.raw.whichBreed = appearance.breedId;
	} else {
		const property = change.kind === "name" ? "name" : "friendshipTowardFarmer";
		const previous = pet.raw[property];
		// A missing/opaque value is not permission to normalize a mod's representation.
		if (
			change.kind === "name"
				? typeof previous !== "string"
				: typeof previous !== "number" || !Number.isSafeInteger(previous)
		)
			return yield* new PetInvalid({
				message: "This saved pet field is unsupported.",
			});
		pet.raw[property] = change.value;
	}
	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${typeof pet.raw.name === "string" ? pet.raw.name : "pet"} ${change.kind}`,
			tags: ["pets", `pet:${id}`],
		}),
	);
});
