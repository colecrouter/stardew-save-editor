import type { KnownFields } from "./domain.ts";
import type { T_StardewValley_WorldDate as WorldDate } from "../../../generated/save-format/save.ts";
import { Data, Effect, Result, Schema } from "effect";
import { MAX_YEAR, SEASONS, totalDays } from "../calendar.ts";
import { inspectPregnancy } from "./pregnancy-data.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

/** An unsupported marriage or malformed date is an expected edit rejection. */
export class PregnancyInvalid extends Data.TaggedError("PregnancyInvalid")<{
	readonly message: string;
}> {}
const changeSchema = Schema.Struct({
	farmerId: Schema.String,
	targetKey: Schema.String,
	expecting: Schema.Boolean,
	days: Schema.optionalKey(
		Schema.Number.check(
			Schema.isInt(),
			Schema.isBetween({ minimum: 1, maximum: 112 * MAX_YEAR }),
		),
	),
});
export type PregnancyChange = typeof changeSchema.Type;
const decode = Schema.decodeUnknownResult(changeSchema, {
	onExcessProperty: "error",
});

/** Directly set a saved due date; this deliberately bypasses the random question.
 * Eligibility is explanatory, not an implicit requirement to simulate gameplay. */
export const setPregnancy = Effect.fn("Relationships.setPregnancy")(function* (
	input: PregnancyChange,
) {
	const decoded = decode(
		input && typeof input === "object" ? { ...input } : input,
	);
	if (Result.isFailure(decoded))
		return yield* new PregnancyInvalid({
			message:
				"Choose a valid pregnancy change and a positive whole number of days.",
		});
	const request = decoded.success;
	const draft = yield* TransactionDraft;
	const snapshot = yield* draft.read;
	const { view, saved, today } = inspectPregnancy(
		snapshot.state.document,
		request.farmerId,
	);
	if (
		!view.supported ||
		!saved ||
		!today ||
		view.targetKey !== request.targetKey
	)
		return yield* new PregnancyInvalid({
			message:
				view.reason ??
				"The saved marriage changed. Choose the current couple again.",
		});
	if (!request.expecting) {
		if (!view.expecting) return;
		// Removing only the due date leaves the marriage and every unrelated
		// friendship member intact; Undo restores the original saved representation.
		delete saved.NextBirthingDate;
	} else {
		const days = request.days ?? 14;
		const absolute = totalDays(today) + days;
		const year = Math.floor(absolute / 112) + 1;
		const season = SEASONS[Math.floor((absolute % 112) / 28)];
		if (year > MAX_YEAR || !season)
			return yield* new PregnancyInvalid({
				message: `The due date must remain within year ${MAX_YEAR}.`,
			});
		if (view.expecting && view.daysUntilBirth === days) return;
		// XML stores a WorldDate with PascalCase fields. Keep any opaque members
		// on an existing date while changing only its three calendar coordinates.
		const existing = saved.NextBirthingDate;
		const due: KnownFields<WorldDate> = {
			...(existing !== null &&
			typeof existing === "object" &&
			!Array.isArray(existing)
				? existing
				: {}),
			Year: year,
			Season: season,
			DayOfMonth: (absolute % 28) + 1,
		};
		// Assigning the date creates the value; the codec owns any xsi:nil transition.
		saved.NextBirthingDate = due;
	}
	yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
		withReviewMetadata({
			label: request.expecting
				? `Set ${view.spouse} baby due date`
				: `End pregnancy with ${view.spouse}`,
			emphasis: "standalone",
			tags: [
				"relationships",
				"relationships:pregnancy",
				`farmer:${request.farmerId}`,
			],
		}),
	);
});
