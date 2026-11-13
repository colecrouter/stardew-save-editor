import { Data, Effect, Result, Schema } from "effect";
import { inspectPets, supportsPetRecord } from "./pet-data.ts";
import { petAppearances } from "./pet-appearance.ts";
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
	const decoded = decode(input);
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
		const breed = pet.raw.whichBreed;
		if (!pet.raw.petType || !breed)
			return yield* new PetInvalid({
				message: "This saved pet appearance is unreadable.",
			});
		// Reselecting the current pair must not create an Undo entry. The codec
		// represents every breed ID as a string, including numeric-looking IDs.
		if (pet.raw.petType === appearance.petType && breed === appearance.breedId)
			return;
		pet.raw.petType = appearance.petType;
		if (breed !== appearance.breedId) pet.raw.whichBreed = appearance.breedId;
	} else if (change.kind === "name") {
		// Missing fields remain unsupported independently: editing a name must
		// never invent friendship, and editing friendship must not invent a name.
		if (pet.raw.name === undefined)
			return yield* new PetInvalid({
				message: "This saved pet name is missing.",
			});
		pet.raw.name = change.value;
	} else {
		if (
			pet.raw.friendshipTowardFarmer === undefined ||
			!Number.isSafeInteger(pet.raw.friendshipTowardFarmer)
		)
			return yield* new PetInvalid({
				message: "This saved pet friendship is unsupported.",
			});
		pet.raw.friendshipTowardFarmer = change.value;
	}

	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Update ${pet.raw.name ?? "pet"} ${change.kind}`,
			tags: ["pets", `pet:${id}`],
		}),
	);
});
