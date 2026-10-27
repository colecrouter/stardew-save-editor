import { expect, it } from "vitest";
import { flushSync } from "svelte";
import { writable } from "svelte/store";
import { createRuneDraft } from "../../src/lib/editor/field.svelte.ts";
import {
	parseStack,
	type Field,
	type FieldValue,
} from "../../src/lib/editor/field.ts";

it("rune drafts preserve invalid text and prevent commits to a replacement field", async () => {
	let commits = 0;
	let listeners = 0;
	const makeField = (): Field<number> => ({
		label: "Stack",
		description: "",
		parse: parseStack,
		format: String,
		value: writable<FieldValue<number>>(
			{
				key: "same",
				revision: 0,
				available: true,
				value: 2,
				commit: async () => {
					commits++;
				},
			},
			() => {
				listeners++;
				return () => {
					listeners--;
				};
			},
		),
	});
	let field = $state.raw(makeField());
	let draft!: ReturnType<typeof createRuneDraft<number>>;
	const dispose = $effect.root(() => {
		draft = createRuneDraft(() => field);
	});
	try {
		flushSync();
		expect(listeners).toBe(1);
		draft.input("");
		await draft.submit();
		expect(draft.current.text).toBe("");
		expect(draft.current.error).toContain("whole number");
		draft.input("9");
		field = makeField();
		flushSync();
		expect(listeners).toBe(1);
		expect(draft.current.conflict).toBe(true);
		expect(draft.current.text).toBe("9");
		await draft.submit();
		expect(commits).toBe(0);
		draft.reload();
		expect(draft.current.text).toBe("2");
		draft.input("8");
		await draft.submit();
		expect(commits).toBe(1);
	} finally {
		dispose();
	}
	expect(listeners).toBe(0);
});

it("an application-handled noncompletion leaves the rune draft editable for retry", async () => {
	const field: Field<number> = {
		label: "Stack",
		description: "",
		parse: parseStack,
		format: String,
		value: writable({
			key: "a",
			revision: 0,
			available: true,
			value: 2,
			commit: async () => null,
		}),
	};
	let draft!: ReturnType<typeof createRuneDraft<number>>;
	const dispose = $effect.root(() => {
		draft = createRuneDraft(() => field);
	});
	try {
		flushSync();
		draft.input("8");
		await draft.submit();
		expect(draft.current.pending).toBe(false);
		expect(draft.current.dirty).toBe(true);
		expect(draft.current.text).toBe("8");
		expect(draft.current.error).toBe("");
		draft.input("9");
		expect(draft.current.text).toBe("9");
	} finally {
		dispose();
	}
});
