import { Effect, Schema } from "effect";
import type { Save } from "../../codegen/save.ts";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
	type CalendarDocumentState,
	type CalendarEdit,
} from "../../src/lib/calendarDocument.ts";
import { formatDate, weatherLabel } from "../../src/lib/calendar.ts";
import {
	diff,
	MutationError,
	type DomainValue,
	type SaveDocument,
	type SessionState,
} from "./domain.ts";

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

export const prepareCalendarOperation = (
	state: SessionState,
	action: CalendarEdit,
): Effect.Effect<SessionState, MutationError> =>
	Effect.try({
		try: () => {
			const game = state.document.SaveGame as unknown as Save;
			const current =
				state.domainState && Object.hasOwn(state.domainState, "calendar")
					? state.domainState.calendar
					: initializeCalendarDocument(game);
			if (!Schema.is(stateSchema)(current) || !Schema.is(Schema.Json)(current))
				throw new MutationError("Calendar domain state is invalid");
			const prepared = prepareCalendarDocument(
				game,
				current as unknown as CalendarDocumentState,
				action,
			);
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
				throw new MutationError("Calendar state requires plain JSON data");
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
						intent: structuredClone(action),
						label,
						review: "standalone" as const,
						changes,
					},
				],
			};
		},
		catch: (error) =>
			error instanceof MutationError
				? error
				: new MutationError(
						error instanceof Error ? error.message : String(error),
					),
	});
