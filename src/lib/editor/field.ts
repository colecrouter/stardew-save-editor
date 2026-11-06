import { Data, Effect, Result } from "effect";
import { runEntryCommand } from "./entry-operations.ts";
import type { CommandResult } from "./command-result.ts";
import { get, writable, type Readable } from "svelte/store";

// A snapshot is an operation handle bound to its original target and revision.
// The session still validates the operation atomically when it is submitted.
export interface FieldValue<T> {
	key: string;
	value: T;
	revision: number;
	available: boolean;
	commit: (value: T) => Promise<void | CommandResult<void, unknown>>;
}
export interface Field<T> {
	label: string;
	description: string;
	value: Readable<FieldValue<T>>;
	parse: (text: string) => Effect.Effect<T, FieldValidationError>;
	format: (value: T) => string;
}
export interface NumericField extends Field<number> {
	constraints: { min: number; max: number; step: number };
	actionLabel: string;
}

/** Invalid user text is expected feedback; parser and commit defects are not. */
export class FieldValidationError extends Data.TaggedError(
	"FieldValidationError",
)<{
	readonly message: string;
}> {}

/** Both draft adapters share one error boundary. Parsing is pure, while the
 * captured commit retains its existing file scope, revision and command queue.
 * Comparator commits may return void; the application returns Result or null. */
export async function submitDraftValue<T>(
	field: Field<T>,
	source: FieldValue<T>,
	text: string,
	onCommitted: () => void,
) {
	let defectMessage = "";
	const result = await runEntryCommand(
		Effect.suspend(() => field.parse(text)).pipe(
			Effect.flatMap((value) => Effect.promise(() => source.commit(value))),
			// Refreshing the draft can invoke a formatter/store callback. Keep that
			// completion inside the same defect boundary as parsing and committing.
			Effect.tap((completion) =>
				Effect.sync(() => {
					if (
						completion !== null &&
						(!completion || Result.isSuccess(completion))
					)
						onCommitted();
				}),
			),
		),
		(message) => {
			defectMessage = message;
		},
		{
			context: "draft",
			message: "The edit could not be completed. Please try again.",
		},
	);
	if (!result) return { committed: false, error: defectMessage };
	if (Result.isFailure(result))
		return { committed: false, error: result.failure.message };
	const completion = result.success;
	if (completion === null || (completion && Result.isFailure(completion)))
		return {
			committed: false,
			error: completion ? String(completion.failure) : "",
		};
	return { committed: true, error: "" };
}

export function createDraft<T>(field: Field<T>) {
	const initial = get(field.value);
	const clean = (source: FieldValue<T>) => ({
		base: source,
		current: source,
		text: field.format(source.value),
		dirty: false,
		conflict: false,
		pending: false,
		error: "",
	});
	// Only a mounted consumer owns a source subscription. The last unsubscribe
	// disconnects it, so creating a draft never requires a separate disposal call.
	const state = writable(clean(initial), () =>
		field.value.subscribe((source) => {
			state.update((draft) => {
				if (!draft.dirty && !draft.pending) return clean(source);
				return {
					...draft,
					current: source,
					conflict:
						source.key !== draft.base.key ||
						source.revision !== draft.base.revision,
				};
			});
		}),
	);
	return {
		subscribe: state.subscribe,
		input: (text: string) =>
			state.update((draft) =>
				draft.pending
					? draft
					: {
							...draft,
							text,
							dirty: text !== field.format(draft.base.value),
							error: "",
						},
			),
		reload: () =>
			state.update((draft) => (draft.pending ? draft : clean(draft.current))),
		submit: async () => {
			const draft = get(state);
			if (draft.pending || !draft.dirty || !draft.base.available) return;
			if (draft.conflict) {
				state.update((current) => ({
					...current,
					error: "The save or selection changed. Reload the current value.",
				}));
				return;
			}
			state.update((current) => ({ ...current, pending: true, error: "" }));
			const result = await submitDraftValue(field, draft.base, draft.text, () =>
				state.update((current) => clean(current.current)),
			);
			if (!result.committed)
				state.update((current) => ({
					...current,
					pending: false,
					error: result.error,
				}));
		},
	};
}

export const parseStack = Effect.fn("Draft.parseStack")(function* (
	text: string,
) {
	const value = /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN;
	if (!Number.isSafeInteger(value) || value < 1 || value > 999)
		return yield* new FieldValidationError({
			message: "Enter a whole number from 1 to 999.",
		});
	return value;
});
