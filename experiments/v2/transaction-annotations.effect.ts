import { expect, it } from "@effect/vitest";
import { Data, Effect, Exit } from "effect";
import {
	collectTransactionMetadata,
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

class DonationRejected extends Data.TaggedError("DonationRejected")<{
	readonly reason: string;
}> {}

it.effect(
	"nested annotations inherit context without leaking into siblings",
	() =>
		Effect.gen(function* () {
			const result = yield* collectTransactionMetadata(
				Effect.gen(function* () {
					yield* recordAnnotatedOperation(Effect.void).pipe(
						withReviewMetadata({
							label: "Sort backpack",
							emphasis: "compact",
							tags: ["inventory"],
						}),
					);
					yield* recordAnnotatedOperation(Effect.void);
				}).pipe(
					withReviewMetadata({
						label: "Prepare farm",
						emphasis: "standalone",
						tags: ["session"],
					}),
				),
			);
			expect(result.records).toEqual([
				{
					label: "Sort backpack",
					emphasis: "compact",
					tags: ["session", "inventory"],
				},
				{ label: "Prepare farm", emphasis: "standalone", tags: ["session"] },
			]);
		}),
);

it.effect(
	"domain errors stay typed and a failed group publishes no metadata result",
	() =>
		Effect.gen(function* () {
			const failed = collectTransactionMetadata(
				Effect.gen(function* () {
					yield* recordAnnotatedOperation(Effect.void);
					return yield* recordAnnotatedOperation(
						Effect.fail(new DonationRejected({ reason: "Missing item" })),
					);
				}),
			);
			const reason = yield* failed.pipe(
				Effect.catchTag("DonationRejected", (error) =>
					Effect.succeed(error.reason),
				),
			);
			expect(reason).toBe("Missing item");
			const next = yield* collectTransactionMetadata(Effect.void);
			expect(next.records).toEqual([]);
		}),
);

it.effect(
	"concurrent transactions have independent journals and annotation scopes",
	() =>
		Effect.gen(function* () {
			const results = yield* Effect.forEach(
				["calendar", "bundle"],
				(tag) =>
					collectTransactionMetadata(
						recordAnnotatedOperation(Effect.succeed(tag)).pipe(
							withReviewMetadata({ tags: [tag] }),
						),
					),
				{ concurrency: "unbounded" },
			);
			expect(results.map((result) => result.records)).toEqual([
				[{ tags: ["calendar"] }],
				[{ tags: ["bundle"] }],
			]);
			const failure = yield* Effect.exit(
				collectTransactionMetadata(
					recordAnnotatedOperation(Effect.fail("stopped")),
				),
			);
			expect(Exit.isFailure(failure)).toBe(true);
		}),
);
