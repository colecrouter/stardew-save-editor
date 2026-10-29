import { cloneEditorData } from "./clone-data.ts";
import { CalendarDocumentError } from "../calendarErrors.ts";
import { Data, Effect, Schema } from "effect";
import type { Save } from "../../../codegen/save.ts";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
	type CalendarDocumentState,
	type CalendarEdit,
} from "../calendarDocument.ts";
import { formatDate, weatherLabel } from "../calendar.ts";
import {
	diff,
	MutationError,
	type DomainValue,
	type SaveDocument,
	type SessionState,
} from "./domain.ts";

import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

// Domain failures remain distinguishable through the generic history runner.
// Portable calendar arithmetic/planners stay shared with the legacy application.
export class CalendarStateInvalid extends Data.TaggedError(
	"CalendarStateInvalid",
)<{ readonly message: string }> {}
export class CalendarRuleViolation extends Data.TaggedError(
	"CalendarRuleViolation",
)<{
	readonly operation: CalendarEdit["type"];
	readonly message: string;
}> {}

const stateSchema = Schema.Struct({
	version: Schema.Literal(1),
	date: Schema.Struct({
		year: Schema.Finite,
		season: Schema.String,
		day: Schema.Finite,
	}),
	daysPlayed: Schema.Finite,
	today: Schema.String,
	tomorrow: Schema.String,
	choices: Schema.Struct({
		today: Schema.optionalKey(Schema.String),
		tomorrow: Schema.optionalKey(Schema.String),
	}),
	loadedFlags: Schema.Struct({
		isRaining: Schema.Boolean,
		isSnowing: Schema.Boolean,
		isLightning: Schema.Boolean,
		isDebrisWeather: Schema.Boolean,
		isGreenRain: Schema.Boolean,
	}),
	targets: Schema.Array(
		Schema.Struct({
			key: Schema.String,
			id: Schema.String,
			fingerprint: Schema.String,
		}),
	),
	watering: Schema.Array(
		Schema.Union([
			Schema.Struct({
				id: Schema.String,
				context: Schema.String,
				kind: Schema.Literal("soil"),
				before: Schema.optionalKey(Schema.Finite),
			}),
			Schema.Struct({
				id: Schema.String,
				context: Schema.String,
				kind: Schema.Literal("bowl"),
				before: Schema.optionalKey(Schema.Boolean),
			}),
		]),
	),
});

// Preparation knows both the preservation document and its serializable calendar
// provenance. The named Effect keeps validation failures typed; the shared pure
// planner still serves production proxies without acquiring an Effect runtime.
export const prepareCalendarState = Effect.fn("Calendar.prepare")(function* (
	state: SessionState,
	action: CalendarEdit,
) {
	const game = state.document.SaveGame as unknown as Save;
	const current = yield* Effect.try({
		try: () =>
			state.domainState && Object.hasOwn(state.domainState, "calendar")
				? state.domainState.calendar
				: initializeCalendarDocument(game),
		// Only deliberate planner rejections are expected failures. A TypeError or
		// cloning defect retains its original cause and stack.
		catch: (cause) => {
			if (!(cause instanceof CalendarDocumentError)) throw cause;
			return new CalendarStateInvalid({ message: cause.message });
		},
	});
	if (!Schema.is(stateSchema)(current) || !Schema.is(Schema.Json)(current))
		return yield* new CalendarStateInvalid({
			message: "Calendar domain state is invalid",
		});
	const prepared = yield* Effect.try({
		try: () =>
			prepareCalendarDocument(
				game,
				current as unknown as CalendarDocumentState,
				action,
			),
		catch: (cause) => {
			if (!(cause instanceof CalendarDocumentError)) throw cause;
			return new CalendarRuleViolation({
				operation: action.type,
				message: cause.message,
			});
		},
	});
	const document = {
		...state.document,
		SaveGame: prepared.game,
	} as unknown as SaveDocument;
	const changes = diff(state.document, document);
	if (
		changes.length === 0 &&
		JSON.stringify(prepared.state) === JSON.stringify(current)
	)
		return state;
	const metadata = prepared.state as unknown as DomainValue;
	if (!Schema.is(Schema.Json)(metadata))
		return yield* new CalendarStateInvalid({
			message: "Calendar state requires plain JSON data",
		});
	const label =
		action.type === "calendar-date"
			? `Set date to ${formatDate(prepared.state.date)}`
			: `Set ${action.day}'s weather to ${weatherLabel(action.value)}`;
	return {
		...state,
		document,
		domainState: { ...state.domainState, calendar: metadata },
		history: [
			...state.history,
			{
				intent: cloneEditorData(action),
				label,
				review: "standalone" as const,
				changes,
			},
		],
	};
});

// Preserve the old command API while its remaining callers migrate. The new UI
// below bypasses this lossy error conversion and the central command dispatcher.
export const prepareCalendarOperation = (
	state: SessionState,
	action: CalendarEdit,
): Effect.Effect<SessionState, MutationError> =>
	prepareCalendarState(state, action).pipe(
		Effect.mapError((error) => new MutationError(error.message)),
	);

const runCalendarEdit = Effect.fn("Calendar.stageEdit")(function* (
	action: CalendarEdit,
) {
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const prepared = yield* prepareCalendarState(snapshot.state, action);
	// A no-op child must not add a misleading review label to a different edit
	// in the same compound transaction. Domain-only provenance changes still count.
	if (prepared === snapshot.state) return;
	const receipt = prepared.history.at(-1);
	yield* recordAnnotatedOperation(
		transaction.replace({ ...snapshot, state: prepared }),
	).pipe(
		withReviewMetadata({
			label: receipt?.label ?? "Edit calendar",
			emphasis: "standalone",
			tags: ["calendar", action.type],
		}),
	);
});

/**
 * Stage a date change and its coordinated farmer/statistics/weather updates.
 * Execute through `model.commands.transact` to commit it with history; changing
 * the date does not simulate the intervening days.
 */
export const setCalendarDate = Effect.fn("Calendar.setDate")(function* (
	change: Extract<CalendarEdit, { type: "calendar-date" }>["change"],
) {
	yield* runCalendarEdit({ type: "calendar-date", change });
});
/**
 * Stage today's or tomorrow's weather, ordinary choices and watering provenance.
 * Execute through `model.commands.transact`; forced-weather rules still apply.
 */
export const setCalendarWeather = Effect.fn("Calendar.setWeather")(function* (
	day: "today" | "tomorrow",
	value: string,
) {
	yield* runCalendarEdit({ type: "calendar-weather", day, value });
});
