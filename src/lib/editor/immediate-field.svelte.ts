import { onDestroy } from "svelte";
import { Result } from "effect";
import type { EditGesture } from "./edit-gesture.ts";
import type { ImmediateField } from "./immediate-field.ts";

/** Component-owned editing behavior shared by text, number and boolean adapters. */
export function createImmediateFieldController<
	T extends string | number | boolean,
>(
	getField: () => ImmediateField<T>,
	options: { readonly discrete?: boolean } = {},
) {
	let error = $state("");
	let pending = $state<{ value: T; request: number }>();
	let blank = $state<{ committed: T | undefined }>();
	let request = 0;
	let gesture: { field: ImmediateField<T>; handle: EditGesture } | undefined;
	const value = $derived(pending?.value ?? getField().value);

	function end() {
		const active = gesture;
		gesture = undefined;
		// End joins the same file queue as submitted writes. A blur never holds a
		// transaction open, and earlier writes finish before their Undo group closes.
		if (active) void active.field.end(active.handle);
	}
	function focus() {
		const field = getField();
		if (
			(gesture?.field.scope === field.scope &&
				gesture.field.key === field.key) ||
			!field.available
		)
			return;
		end();
		gesture = { field, handle: field.begin() };
	}
	let key = getField().key;
	let scope = getField().scope;
	let committed = getField().value;
	$effect(() => {
		const field = getField();
		if (field.scope !== scope || field.key !== key) {
			// Changing owner or property invalidates local presentation ownership,
			// but already submitted commands retain their captured original target.
			end();
			key = field.key;
			scope = field.scope;
			request++;
			pending = undefined;
			blank = undefined;
			error = "";
		}
		// Feedback describes the value at rejection. Undo or a later authoritative
		// value makes that feedback obsolete, while unrelated revisions leave it.
		if (field.value !== committed) error = "";
		committed = field.value;
		// Undo or an external change replaces incomplete text only when this value
		// actually changes; unrelated save revisions must not steal replacement input.
		if (blank && !pending && field.value !== blank.committed) blank = undefined;
	});
	onDestroy(end);

	async function input(next: T | null | undefined) {
		const field = getField();
		error = "";
		if (!field.available) return;
		if (next == null || (next === "" && field.constraints?.required)) {
			blank = { committed: value };
			return;
		}
		blank = undefined;
		// Correcting a rejected input back to its committed value clears feedback
		// without producing another saved change or another Undo step.
		if (next === value) return;
		// A checkbox or select is a complete decision, not a typing gesture.
		if (options.discrete) end();
		focus();
		const active = gesture;
		if (!active) return;
		const current = ++request;
		pending = { value: next, request: current };
		try {
			const completion = active.field.commit(next, active.handle);
			if (options.discrete) end();
			const result = await completion;
			if (result && Result.isFailure(result) && pending?.request === current)
				error = result.failure.message;
			// Defects and cancellation stay with the file's command boundary; null
			// never becomes a second field-level error or a successful saved edit.
		} finally {
			// Only the latest request owns visible optimistic state. Earlier writes
			// cannot replace newer typing, including after a target was replaced.
			if (pending?.request === current) pending = undefined;
		}
	}
	return {
		get value() {
			return blank ? undefined : value;
		},
		get error() {
			return error;
		},
		get pending() {
			return pending !== undefined;
		},
		focus,
		input: (next: T | null | undefined) => {
			void input(next);
		},
		blur() {
			blank = undefined;
			end();
		},
	};
}
