import { Effect, Result, Schema } from "effect";
import { CommunityInvalid } from "./community-operations.ts";
import {
	inspectCommunity,
	readCommunity,
	progressId,
	submissionFlags,
} from "./community-data.ts";
import { record } from "./saved-collections.ts";
import { samePlainData } from "./plain-data.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import {
	BUNDLE_CATEGORIES,
	BUNDLE_QUALITIES,
	MAX_BUNDLE_ITEMS,
	MAX_GOLD,
	MAX_INGREDIENT_STACK,
	canHaveQuality,
	ingredientKind,
	isValidIngredientId,
} from "./community-ingredients.ts";

const integer = Schema.Number.check(
	Schema.isInt(),
	Schema.isGreaterThanOrEqualTo(0),
);
const ingredientSchema = Schema.Struct({
	itemId: Schema.String,
	quantity: integer,
	quality: integer,
});
const requestSchema = Schema.Struct({
	bundleKey: Schema.String,
	expected: Schema.Struct({
		needed: integer,
		requirements: Schema.Array(
			Schema.Struct({ ...ingredientSchema.fields, submitted: Schema.Boolean }),
		),
	}),
	needed: integer,
	requirements: Schema.Array(
		Schema.Struct({
			...ingredientSchema.fields,
			sourceIndex: Schema.optionalKey(integer),
		}),
	),
});
export type CommunityRequirementsEdit = typeof requestSchema.Type;
export type CommunityIngredientEdit =
	CommunityRequirementsEdit["requirements"][number];
const decode = Schema.decodeUnknownResult(requestSchema, {
	onExcessProperty: "error",
});
const invalid = (message: string) =>
	Effect.fail(new CommunityInvalid({ message }));

/** Commit coordinated definition/slot changes while retaining rewards, tails and room progression. */
export const setCommunityRequirements = Effect.fn("Community.setRequirements")(
	function* (input: CommunityRequirementsEdit) {
		const decoded = decode(input);
		if (Result.isFailure(decoded))
			return yield* invalid("Choose valid bundle requirements.");
		const change = decoded.success;
		const draft = yield* TransactionDraft;
		const snapshot = yield* draft.read;
		const document = snapshot.state.document;
		const bundle = readCommunity(document).bundles.find(
			(row) => row.key === change.bundleKey,
		);
		if (!bundle?.supported)
			return yield* invalid(bundle?.reason ?? "Choose a supported bundle.");
		// Compare saved requirements and donations, not unrelated global revision numbers.
		// A draft must never silently inherit an intervening donation or definition edit.
		const expected = {
			needed: bundle.needed,
			requirements: bundle.requirements.map(
				({ itemId, quantity, quality, submitted }) => ({
					itemId,
					quantity,
					quality,
					submitted,
				}),
			),
		};
		if (!samePlainData(expected, change.expected))
			return yield* invalid(
				"The bundle changed while you were editing. Reopen its requirements.",
			);
		if (
			change.requirements.length < 1 ||
			change.requirements.length > MAX_BUNDLE_ITEMS ||
			change.needed < 1 ||
			change.needed > change.requirements.length
		)
			return yield* invalid(
				"Choose 1–12 requirements and a donation count within that range.",
			);
		const vault = bundle.room === 4;
		if (
			vault &&
			(change.requirements.length !== bundle.requirements.length ||
				change.needed !== bundle.needed)
		)
			return yield* invalid("Vault bundles only support changing their price.");
		const usedSources = new Set<number>();
		const nextDonations: boolean[] = [];
		for (const [index, item] of change.requirements.entries()) {
			const prior =
				item.sourceIndex === undefined
					? undefined
					: bundle.requirements[item.sourceIndex];
			// Original row identities retain donation credit across replacements/removals.
			// New rows in a completed bundle are already satisfied, matching the game UI.
			if (item.sourceIndex !== undefined) {
				if (!prior || usedSources.has(item.sourceIndex))
					return yield* invalid("A saved requirement cannot be reused twice.");
				usedSources.add(item.sourceIndex);
			}
			// Existing unusual amounts remain attached when untouched; a changed
			// amount or replacement item must fit the supported game limits.
			if (
				!isValidIngredientId(item.itemId) ||
				item.quantity < 1 ||
				(item.quantity > (vault ? MAX_GOLD : MAX_INGREDIENT_STACK) &&
					!(item.itemId === prior?.itemId && item.quantity === prior?.quantity))
			)
				return yield* invalid("Choose a valid item and supported quantity.");
			if (vault) {
				if (
					item.sourceIndex !== index ||
					item.itemId !== prior?.itemId ||
					(index !== change.requirements.length - 1 &&
						!samePlainData(
							{
								itemId: item.itemId,
								quantity: item.quantity,
								quality: item.quality,
							},
							{
								itemId: prior?.itemId,
								quantity: prior?.quantity,
								quality: prior?.quality,
							},
						))
				)
					return yield* invalid(
						"Only the Vault's final gold price can change.",
					);
				const expectedQuality =
					prior?.quality === prior?.quantity ? item.quantity : prior?.quality;
				if (item.quality !== expectedQuality)
					return yield* invalid("Keep the Vault's saved gold representation.");
			} else {
				const kind = ingredientKind(item.itemId);
				const retainedId = item.itemId === prior?.itemId;
				if (
					!retainedId &&
					(kind === "unknown" ||
						kind === "gold" ||
						(kind === "category" &&
							!BUNDLE_CATEGORIES.has(Number(item.itemId))))
				)
					return yield* invalid(
						"Choose a known object or supported bundle category.",
					);
				// Imported custom quality is retained as loaded; new quality choices must be
				// game-supported and possible for the chosen object/category.
				if (item.quality !== prior?.quality || !retainedId) {
					if (
						!BUNDLE_QUALITIES.has(item.quality) ||
						(item.quality > 0 && !canHaveQuality(item.itemId))
					)
						return yield* invalid(
							"That item cannot satisfy the selected minimum quality.",
						);
				}
			}
			nextDonations.push(prior?.submitted ?? bundle.completed);
		}
		const nowCompleted = nextDonations.filter(Boolean).length >= change.needed;
		if (nowCompleted !== bundle.completed)
			return yield* invalid(
				"This change would finish or reopen the bundle. Change donations separately first.",
			);
		const data = inspectCommunity(document);
		const definition = data.definitions.entries.find(
			(row) => record(row) && record(row.key) && row.key.string === bundle.key,
		);
		const progress = data.progress.entries.find(
			(row) => progressId(row) === bundle.id,
		);
		if (
			!record(definition) ||
			!record(definition.value) ||
			typeof definition.value.string !== "string" ||
			!record(progress) ||
			!record(progress.value) ||
			!record(progress.value.ArrayOfBoolean)
		)
			return yield* invalid("The saved bundle representation is unsupported.");
		const parts = definition.value.string.split("/");
		const originalFlags = submissionFlags(progress);
		if (!originalFlags)
			return yield* invalid("The saved donation slots are unsupported.");
		const requirementsChanged = !samePlainData(
			bundle.requirements.map(({ itemId, quantity, quality }) => ({
				itemId,
				quantity,
				quality,
			})),
			change.requirements.map(({ itemId, quantity, quality }) => ({
				itemId,
				quantity,
				quality,
			})),
		);
		if (requirementsChanged)
			parts[2] = change.requirements
				.map((row) => `${row.itemId} ${row.quantity} ${row.quality}`)
				.join(" ");
		// An empty count means every requirement. Preserve the opening numeric
		// count when a row addition changes that implicit default.
		if (
			change.needed !== bundle.needed ||
			(!parts[4] && change.needed !== change.requirements.length)
		)
			parts[4] = String(change.needed);
		// Price labels are generated only when the imported label exactly follows the
		// vanilla gold form. Custom/localized names and every opaque tail stay intact.
		if (vault) {
			const oldPrice = bundle.requirements.at(-1)?.quantity;
			const newPrice = change.requirements.at(-1)?.quantity;
			if (oldPrice !== newPrice) {
				const before = `${oldPrice?.toLocaleString("en-US")}g`;
				const after = `${newPrice?.toLocaleString("en-US")}g`;
				if (parts[0] === before) parts[0] = after;
				if (parts[6] === before) parts[6] = after;
			}
		}
		definition.value.string = parts.join("/");
		// Scalar edits preserve the imported surplus slot layout. Structural changes
		// need the game's three-slots-per-item allocation; first N slots hold donations.
		const structureChanged =
			change.requirements.length !== bundle.requirements.length ||
			change.requirements.some((row, index) => row.sourceIndex !== index);
		if (
			structureChanged &&
			originalFlags.length !== bundle.requirements.length &&
			originalFlags.length !== bundle.requirements.length * 3
		)
			return yield* invalid(
				"The saved donation slot layout cannot be resized safely.",
			);
		if (structureChanged)
			progress.value.ArrayOfBoolean.boolean = Array.from(
				{ length: change.requirements.length * 3 },
				(_, index) => nextDonations[index] ?? nowCompleted,
			);
		yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
			withReviewMetadata({
				label: `Edit ${bundle.name} requirements`,
				tags: ["community-center", "community:requirements"],
			}),
		);
	},
);
