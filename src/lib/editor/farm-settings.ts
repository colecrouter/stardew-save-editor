import { Data, Result, Schema, SchemaIssue } from "effect";

/** An expected invalid farm request; unexpected implementation errors stay defects. */
export class FarmSettingsInvalid extends Data.TaggedError(
	"FarmSettingsInvalid",
)<{
	readonly message: string;
}> {}

/** Display-unit bounds shared by schema enforcement and field presentation. */
export const farmProfitLimits = { min: 1, max: 1000, step: "any" } as const;

const nameMessage = "Enter a farm name.";
const profitMessage = `Enter a profit percentage from ${farmProfitLimits.min} to ${farmProfitLimits.max}.`;

/**
 * Shared rules for deliberate Farm edits, in display units (100% = multiplier 1).
 * Optional keys mean “leave unchanged”; a supplied undefined value is invalid.
 * This schema validates requests, never the preserved imported save document.
 */
export const FarmSettingsChangeSchema = Schema.Struct({
	name: Schema.optionalKey(
		Schema.String.check(
			Schema.isPattern(/\S/, { message: nameMessage }),
		).annotate({ message: nameMessage }),
	),
	profitPercent: Schema.optionalKey(
		Schema.Number.check(
			Schema.isFinite({ message: profitMessage }),
			Schema.isBetween(
				{ minimum: farmProfitLimits.min, maximum: farmProfitLimits.max },
				{ message: profitMessage },
			),
		).annotate({ message: profitMessage }),
	),
	monsters: Schema.optionalKey(
		Schema.Boolean.annotate({
			message: "Choose whether monsters spawn on the farm.",
		}),
	),
	mineRewards: Schema.optionalKey(
		Schema.Literals(["Default", "Remixed"]).annotate({
			message: "Choose normal or remixed mine rewards.",
		}),
	),
}).annotate({
	message: "Choose valid farm settings.",
	messageUnexpectedKey: "Choose a supported farm setting.",
});

/** Decoded partial command input. Its fields and value types come from the schema. */
export type FarmSettingsChange = typeof FarmSettingsChangeSchema.Type;

const decodeChange = Schema.decodeUnknownResult(FarmSettingsChangeSchema, {
	onExcessProperty: "error",
});
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

/**
 * Validate a partial request for both control feedback and command enforcement.
 * Return one schema-authored message without exposing parse trees or input data.
 * Callers must use the decoded object: unvalidated extra/prototype properties
 * must not leak back into writes after the request has passed validation.
 */
export function decodeFarmSettingsChange(
	input: unknown,
): Result.Result<FarmSettingsChange, FarmSettingsInvalid> {
	// Struct decoders can read declared keys through a prototype. A partial
	// request means its own enumerable fields only, so snapshot those fields
	// before decoding. Leave non-object/array inputs intact for schema rejection.
	const ownRequest =
		input !== null && typeof input === "object" && !Array.isArray(input)
			? { ...input }
			: input;
	const result = decodeChange(ownRequest);
	if (Result.isFailure(result)) {
		return Result.fail(
			new FarmSettingsInvalid({
				message: formatIssues(result.failure.issue).issues[0]!.message,
			}),
		);
	}
	return Result.succeed(result.success);
}
