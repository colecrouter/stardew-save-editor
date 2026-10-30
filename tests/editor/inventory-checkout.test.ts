import { expect, it, vi } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { setBackpackItem } from "../../src/lib/editor/inventory-operations";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";

// Catalog resolution happens after checkout and can yield on module loading.
// Intercept that boundary to exercise interleaved writes deterministically.
const catalogHook = vi.hoisted(() => ({
	run: undefined as ((item: unknown) => void) | undefined,
}));
vi.mock("../../src/lib/ItemData.ts", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../src/lib/ItemData.ts")>();
	return {
		...actual,
		ResolveItemData: (...args: Parameters<typeof actual.ResolveItemData>) => {
			const run = catalogHook.run;
			catalogHook.run = undefined;
			run?.(args[0]);
			return actual.ResolveItemData(...args);
		},
	};
});
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function fixture() {
	const document = tinyFixture();
	document.SaveGame.player.items.Item = [
		{
			"@_xsi:type": "Object",
			itemId: "24",
			name: "Parsnip",
			bigCraftable: false,
			category: -75,
			stack: 3,
			quality: 0,
			modData: { opaque: "007" },
		},
	];
	return document;
}

it.each([8, 3])(
	"rejects a stale checkout even when requested quantity %i looks unchanged",
	(value) =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const entityId = before.identities.host?.[0];
				if (!entityId) throw new Error("Missing fixture identity");
				const after = yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const services = yield* Effect.context();
						catalogHook.run = () => {
							// The competing edit changes the same draft after checkout and before
							// apply. It must survive when the caller handles the stale item failure.
							Effect.runSyncWith(services)(
								draft.mutate((writer) => {
									writer.document.SaveGame.player.money = 99;
								}),
							);
						};
						const result = yield* Effect.result(
							setBackpackItem({
								farmerId: "host",
								entityId,
								property: "stack",
								value,
							}),
						);
						expect(Result.isFailure(result)).toBe(true);
						if (Result.isFailure(result))
							expect(result.failure._tag).toBe("MutationError");
					}),
				);
				expect(after.document.SaveGame.player.money).toBe(99);
				expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
					stack: 3,
				});
				expect(after.entries).toHaveLength(1);
				expect((yield* session.undo).document).toEqual(before.document);
				expect((yield* session.redo).document).toEqual(after.document);
			}),
		),
);

it("detaches checkout data before metadata handling can modify it", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(fixture());
			const before = yield* session.snapshot;
			const entityId = before.identities.host?.[0];
			if (!entityId) throw new Error("Missing fixture identity");
			catalogHook.run = (item) => {
				if (!item || typeof item !== "object")
					throw new Error("Missing checkout item");
				// A metadata consumer accidentally modifying its input must affect only
				// that detached checkout, never the baseline or fields outside its patch.
				Object.assign(item, { modData: { opaque: "changed detached input" } });
			};
			const after = yield* session.transact(
				setBackpackItem({
					farmerId: "host",
					entityId,
					property: "stack",
					value: 8,
				}),
			);
			expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
				stack: 8,
				modData: { opaque: "007" },
			});
			expect((yield* session.undo).document).toEqual(before.document);
		}),
	));
