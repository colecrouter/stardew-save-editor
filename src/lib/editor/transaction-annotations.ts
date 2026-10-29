import { cloneEditorData } from "./clone-data.ts";
import { Context, Data, Effect, Schema } from "effect";

// Review information describes how to present a transaction, not every possible
// domain command. Features can add namespaced tags without extending an action union.
export interface ReviewMetadata {
	readonly label?: string;
	readonly emphasis?: "standalone" | "compact";
	readonly tags?: readonly string[];
}

// Invalid annotations must reject a commit, not disappear through JSON encoding.
// This is a framework failure independent of any feature's domain-error vocabulary.
export class ReviewMetadataError extends Data.TaggedError(
	"ReviewMetadataError",
)<{
	readonly message: string;
}> {}
const metadataSchema = Schema.Struct({
	label: Schema.optionalKey(Schema.String),
	emphasis: Schema.optionalKey(Schema.Literals(["standalone", "compact"])),
	tags: Schema.optionalKey(Schema.Array(Schema.String)),
});
const validateMetadata = Effect.fn("Review.validateMetadata")(function* (
	metadata: ReviewMetadata,
) {
	if (!Schema.is(metadataSchema)(metadata) || !Schema.is(Schema.Json)(metadata))
		return yield* new ReviewMetadataError({
			message:
				"Review annotations require serializable labels, emphasis and string tags",
		});
});

// Defaults must be immutable: Context.Reference caches its default across reads.
// Each wrapper provides a fresh value, so concurrent/nested operations cannot
// overwrite one another's ambient annotations.
const CurrentReview = Context.Reference<ReviewMetadata>("v2/CurrentReview", {
	defaultValue: () => Object.freeze({}),
});

// The journal is deliberately required rather than defaulted. Recording outside
// a transaction should be a missing capability, not a global accumulating log.
export class ReviewJournal extends Context.Service<
	ReviewJournal,
	{
		append: (
			metadata: ReviewMetadata,
		) => Effect.Effect<void, ReviewMetadataError>;
	}
>()("v2/ReviewJournal") {}

/**
 * Provide review defaults to nested operations: labels/emphasis override the
 * parent while tags accumulate. Metadata becomes durable only when a successful
 * `recordAnnotatedOperation` is collected by the enclosing history transaction.
 */
export const withReviewMetadata =
	(metadata: ReviewMetadata) =>
	<A, E, R>(
		operation: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | ReviewMetadataError, R> =>
		Effect.gen(function* () {
			yield* validateMetadata(metadata);
			const parent = yield* CurrentReview;
			// Child labels/emphasis override their parent; tags accumulate without
			// duplicates. Copy caller-owned data before any asynchronous work starts.
			const inherited = {
				...parent,
				...metadata,
				tags: [...new Set([...(parent.tags ?? []), ...(metadata.tags ?? [])])],
			};
			return yield* operation.pipe(
				Effect.provideService(CurrentReview, inherited),
			);
		});

// Effect.fn supplies a useful execution/tracing name. It does not make tracing
// annotations into durable review history: the explicit journal capture does that.
export const recordAnnotatedOperation = Effect.fn("Review.recordOperation")(
	function* <A, E, R>(operation: Effect.Effect<A, E, R>) {
		const metadata = yield* CurrentReview;
		const journal = yield* ReviewJournal;
		const value = yield* operation;
		// A failed/interrupted operation never contributes a successful receipt.
		// Parallel operations are recorded in completion order, not launch order.
		yield* journal.append(metadata);
		return value;
	},
);

// Allocate a journal inside each history transaction attempt. Only its detached
// successful result can join the document/history commit; retries never reuse the
// mutable staging array. Arbitrary external writes are still not rollbackable.
export const collectTransactionMetadata = <A, E, R>(
	program: Effect.Effect<A, E, R | ReviewJournal>,
) =>
	Effect.gen(function* () {
		const staged: ReviewMetadata[] = [];
		let active = true;
		return yield* program.pipe(
			Effect.provideService(ReviewJournal, {
				append: (metadata) =>
					Effect.gen(function* () {
						if (!active)
							return yield* new ReviewMetadataError({
								message: "This transaction journal is closed",
							});
						yield* validateMetadata(metadata);
						// Detach recorded data from annotation objects retained by a feature.
						staged.push(cloneEditorData(metadata));
					}),
			}),
			// Copy the successful records before teardown clears the journal. A
			// captured service then retains an empty buffer, even after failure.
			Effect.map((value) => ({ value, records: cloneEditorData(staged) })),
			// A service captured by an unjoined child must not append after the
			// enclosing program returned. Retries acquire a separate active journal.
			Effect.ensuring(
				Effect.sync(() => {
					active = false;
					staged.length = 0;
				}),
			),
		);
	});
