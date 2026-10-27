import { Result } from "effect";
import { untrack } from "svelte";
import { get } from "svelte/store";
import type { Field, FieldValue } from "./field.ts";

/**
 * Create a component-owned editing draft; typing does not mutate the save.
 * Call during Svelte initialization so its source subscription is disposed with
 * the component. The getter may select another field: dirty input is preserved
 * as a conflict until explicitly reloaded, rather than retargeted on submission.
 */
export function createRuneDraft<T>(getField: () => Field<T>) {
	const clean = (field: Field<T>, source: FieldValue<T>) => ({
		field,
		base: source,
		current: source,
		text: field.format(source.value),
		dirty: false,
		conflict: false,
		pending: false,
		error: "",
	});
	const initial = getField();
	let state = $state.raw(clean(initial, get(initial.value)));
	// Component ownership releases the old source on replacement and on teardown.
	// Dirty input keeps its original commit target; replacing a field is a conflict
	// even when the new field happens to have the same key and revision.
	$effect(() => {
		const field = getField();
		return field.value.subscribe((source) =>
			untrack(() => {
				if (!state.dirty && !state.pending) state = clean(field, source);
				else
					state = {
						...state,
						current: source,
						conflict:
							field !== state.field ||
							source.key !== state.base.key ||
							source.revision !== state.base.revision,
					};
			}),
		);
	});
	return {
		get current() {
			return state;
		},
		input(text: string) {
			if (state.pending) return;
			state = {
				...state,
				text,
				dirty: text !== state.field.format(state.base.value),
				error: "",
			};
		},
		reload() {
			if (!state.pending) {
				const field = getField();
				state = clean(field, get(field.value));
			}
		},
		async submit() {
			const draft = state;
			if (draft.pending || !draft.dirty || !draft.base.available) return;
			if (draft.conflict || getField() !== draft.field) {
				state = {
					...state,
					conflict: true,
					error: "The save or selection changed. Reload the current value.",
				};
				return;
			}
			try {
				const value = draft.field.parse(draft.text);
				state = { ...state, pending: true, error: "" };
				const result = await draft.base.commit(value);
				// Defects/cancellation are already handled by the application. Keep
				// the draft for retry without presenting them as validation errors.
				if (result === null || (result && Result.isFailure(result))) {
					state = {
						...state,
						pending: false,
						error: result ? String(result.failure) : "",
					};
					return;
				}
				// A replacement during the await must not silently discard the old draft.
				if (getField() !== draft.field)
					state = { ...state, pending: false, conflict: true };
				else state = clean(draft.field, get(draft.field.value));
			} catch (error) {
				state = { ...state, pending: false, error: String(error) };
			}
		},
	};
}
