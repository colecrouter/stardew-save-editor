import { Context, Effect } from "effect";

// Review information describes how to present a transaction, not every possible
// domain command. Features can add namespaced tags without extending an action union.
export interface ReviewMetadata {
	readonly label?: string;
	readonly emphasis?: "standalone" | "compact";
	readonly tags?: readonly string[];
}

// Defaults must be immutable: Context.Reference caches its default across reads.
// Each wrapper provides a fresh value, so concurrent/nested operations cannot
// overwrite one another's ambient annotations.
const CurrentReview = Context.Reference<ReviewMetadata>(
	"v2/proof/CurrentReview",
	{
		defaultValue: () => Object.freeze({}),
	},
);

// The journal is deliberately required rather than defaulted. Recording outside
// a transaction should be a missing capability, not a global accumulating log.
class ReviewJournal extends Context.Service<
	ReviewJournal,
	{
		append: (metadata: ReviewMetadata) => Effect.Effect<void>;
	}
>()("v2/proof/ReviewJournal") {}

export const withReviewMetadata =
	(metadata: ReviewMetadata) =>
	<A, E, R>(operation: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
		Effect.gen(function* () {
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

// This isolated proof stages metadata only; it is not a replacement for the
// document/history transaction. Integration must commit these records and patches
// together. Arbitrary external writes still cannot be rolled back by this wrapper.
export const collectTransactionMetadata = <A, E, R>(
	program: Effect.Effect<A, E, R | ReviewJournal>,
) =>
	Effect.gen(function* () {
		const staged: ReviewMetadata[] = [];
		const value = yield* program.pipe(
			Effect.provideService(ReviewJournal, {
				append: (metadata) =>
					Effect.sync(() => {
						// Detach recorded data from annotation objects retained by a feature.
						staged.push(structuredClone(metadata));
					}),
			}),
		);
		// No journal escapes on failure. The caller can publish this result only after
		// its authoritative save transaction has also succeeded.
		return { value, records: staged };
	});
