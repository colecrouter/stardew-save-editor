import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { get, writable } from "svelte/store";
import { createDraft, parseStack, type FieldValue } from "./field.ts";
import { makeAtomInventory } from "./inventory-atoms.ts";
import { openInventory } from "./inventory-model.ts";
import { makeStoreInventory } from "./inventory-stores.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

for (const [name, factory] of [
	["Atom", makeAtomInventory],
	["store", makeStoreInventory],
] as const) {
	it.effect(
		`${name}: draft validates, captures its target, and rejects undo/redo staleness`,
		() =>
			Effect.gen(function* () {
				const opened = yield* Effect.promise(() => openInventory(factory));
				const draft = createDraft(opened.model.stackField);
				const stop = draft.subscribe(() => {});
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						await opened.close();
					}),
				);
				draft.input("0");
				yield* Effect.promise(draft.submit);
				expect(get(draft).text).toBe("0");
				expect(get(draft).error).toContain("whole number");
				expect((yield* opened.session.snapshot).entries).toHaveLength(0);

				draft.input("7");
				expect((yield* opened.session.snapshot).entries).toHaveLength(0);
				yield* Effect.promise(draft.submit);
				yield* Effect.promise(settle);
				expect((yield* opened.session.snapshot).entries).toHaveLength(1);
				expect(get(draft).text).toBe("7");

				draft.input("8");
				opened.model.chooseFarmer("guest");
				yield* Effect.promise(settle);
				expect(get(draft).text).toBe("8");
				expect(get(draft).conflict).toBe(true);
				yield* Effect.promise(draft.submit);
				expect((yield* opened.session.snapshot).entries).toHaveLength(1);
				draft.reload();
				expect(get(draft).text).toBe("12");
				const captured = get(opened.model.stackField.value);
				yield* opened.session.undo;
				yield* opened.session.redo;
				const result = yield* Effect.promise(() =>
					captured.commit(20).then(
						() => "unexpected",
						() => "stale",
					),
				);
				expect(result).toBe("stale");
				expect((yield* opened.session.snapshot).entries).toHaveLength(1);
			}),
	);
	it.effect(`${name}: mounted draft resources close with their session`, () =>
		Effect.promise(async () => {
			for (let index = 0; index < 5; index++) {
				const opened = await openInventory(factory);
				const stop = createDraft(opened.model.stackField).subscribe(() => {});
				await settle();
				stop();
				await opened.close();
				expect(opened.model.debug()).toEqual({ nodes: 0, liveStreams: 0 });
			}
		}),
	);
}

it.effect(
	"a rejected asynchronous commit retains input and the draft unsubscribes",
	() =>
		Effect.promise(async () => {
			let live = 0;
			let reject!: (error: Error) => void;
			const source = writable<FieldValue<number>>(
				{
					key: "a",
					value: 2,
					revision: 0,
					available: true,
					commit: () =>
						new Promise<void>((_, fail) => {
							reject = fail;
						}),
				},
				() => {
					live++;
					return () => {
						live--;
					};
				},
			);
			const draft = createDraft({
				label: "Stack",
				description: "",
				value: source,
				parse: parseStack,
				format: String,
			});
			expect(live).toBe(0);
			const stop = draft.subscribe(() => {});
			expect(live).toBe(1);
			draft.input("9");
			const pending = draft.submit();
			expect(get(draft).pending).toBe(true);
			draft.input("10");
			expect(get(draft).text).toBe("9");
			reject(new Error("failed commit"));
			await pending;
			expect(get(draft).text).toBe("9");
			expect(get(draft).pending).toBe(false);
			expect(get(draft).error).toContain("failed commit");
			stop();
			expect(live).toBe(0);
		}),
);
