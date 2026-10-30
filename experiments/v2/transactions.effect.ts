import { expect, it } from "@effect/vitest";
import { Effect, Exit, JsonPatch, type Schema, TxRef } from "effect";
import { prepare, type OperationChange, type SessionState } from "./domain.ts";
import { scenarios, tinyFixture } from "./fixture.ts";

it.effect("Effect transactions commit document and receipt refs together", () =>
	Effect.gen(function* () {
		const original = tinyFixture();
		const document = yield* TxRef.make(original);
		const receipts = yield* TxRef.make<OperationChange[]>([]);
		const rename = { type: "farm-name", value: "New farm" } as const;
		const mutate = (fail: boolean) =>
			Effect.tx(
				Effect.gen(function* () {
					const state: SessionState = {
						document: yield* TxRef.get(document),
						history: yield* TxRef.get(receipts),
					};
					const next = prepare(state, rename);
					yield* TxRef.set(document, next.document);
					yield* TxRef.set(receipts, next.history);
					if (fail) return yield* Effect.fail("injected after both writes");
				}),
			);
		expect(Exit.isFailure(yield* Effect.exit(mutate(true)))).toBe(true);
		expect(yield* TxRef.get(document)).toEqual(original);
		expect(yield* TxRef.get(receipts)).toEqual([]);
		yield* mutate(false);
		expect((yield* TxRef.get(document)).SaveGame.player.farmName).toBe(
			"New farm",
		);
		expect((yield* TxRef.get(receipts)).length).toBe(1);
	}),
);

it.effect(
	"transactions cannot roll back mutations of objects read from a ref",
	() =>
		Effect.gen(function* () {
			const original = tinyFixture();
			const ref = yield* TxRef.make(original);
			yield* Effect.tx(
				Effect.gen(function* () {
					const unsafe = yield* TxRef.get(ref);
					unsafe.SaveGame.player.money = 900; // resembles an in-place proxy write
					return yield* Effect.fail("cannot undo ordinary JavaScript mutation");
				}),
			).pipe(Effect.exit);
			expect((yield* TxRef.get(ref)).SaveGame.player.money).toBe(900);
			// This is a demonstration of the unsafe boundary, not acceptable editor behavior.
		}),
);

it.effect(
	"Effect JSON patches support linear reversal without erasing review intent",
	() =>
		Effect.sync(() => {
			const initial = tinyFixture();
			let state: SessionState = { document: initial, history: [] };
			const json = (value: unknown): Schema.Json =>
				JSON.parse(JSON.stringify(value));
			const steps = [];
			for (const action of scenarios(initial)) {
				const next = prepare(state, action);
				steps.push({
					forward: JsonPatch.get(json(state.document), json(next.document)),
					backward: JsonPatch.get(json(next.document), json(state.document)),
				});
				state = next;
			}
			const final = json(state.document);
			let value = final;
			for (const step of [...steps].reverse())
				value = JsonPatch.apply(step.backward, value);
			expect(value).toEqual(initial);
			for (const step of steps) value = JsonPatch.apply(step.forward, value);
			expect(value).toEqual(final);
			expect(state.history[2].review).toBe("compact");
			expect(steps[2].forward.length).toBeGreaterThan(0);
			expect(initial).toEqual(tinyFixture());
		}),
);

it.effect(
	"net review can be empty while action history remains meaningful",
	() =>
		Effect.sync(() => {
			const initial = tinyFixture();
			let state: SessionState = { document: initial, history: [] };
			for (const value of [99, 10])
				state = prepare(state, { type: "money", farmerId: "host", value });
			expect(state.history.length).toBe(2);
			expect(
				JsonPatch.get(
					JSON.parse(JSON.stringify(initial)),
					JSON.parse(JSON.stringify(state.document)),
				),
			).toEqual([]);
		}),
);
