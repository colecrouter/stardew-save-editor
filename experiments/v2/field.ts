import { get, writable, type Readable } from "svelte/store";

// A snapshot is an operation handle bound to its original target and revision.
// The session still validates the operation atomically when it is submitted.
export interface FieldValue<T> {
	key: string;
	value: T;
	revision: number;
	available: boolean;
	commit: (value: T) => Promise<void>;
}
export interface Field<T> {
	label: string;
	description: string;
	value: Readable<FieldValue<T>>;
	parse: (text: string) => T;
	format: (value: T) => string;
}
export interface NumericField extends Field<number> {
	constraints: { min: number; max: number; step: number };
	actionLabel: string;
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
			try {
				const value = field.parse(draft.text);
				state.update((current) => ({ ...current, pending: true, error: "" }));
				await draft.base.commit(value);
				state.update((current) => clean(current.current));
			} catch (error) {
				// Failed validation or a stale operation leaves the user's input intact.
				state.update((current) => ({
					...current,
					pending: false,
					error: String(error),
				}));
			}
		},
	};
}

export function parseStack(text: string): number {
	if (!/^\d+$/.test(text.trim()))
		throw new Error("Enter a whole number from 1 to 999.");
	const value = Number(text);
	if (!Number.isSafeInteger(value) || value < 1 || value > 999)
		throw new Error("Enter a whole number from 1 to 999.");
	return value;
}
