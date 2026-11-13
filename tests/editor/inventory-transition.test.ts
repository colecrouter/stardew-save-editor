import { malformedFixture } from "../helpers/editor-document.ts";
import * as itemCatalog from "../../src/lib/ItemData";
import { it } from "@effect/vitest";
import { describe, expect, vi } from "vitest";
import { Cause, Effect, Exit, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	coreOperations,
	EditorOperations,
} from "../../src/lib/editor/operations";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations";
import {
	readBackpacks,
	readChests,
} from "../../src/lib/editor/inventory-views";
import { tinyFixture } from "../helpers/editor-document.ts";

// Fail fixture setup explicitly rather than allowing absent handles to weaken assertions.
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

describe("prepared inventory transitions", () => {
	it.effect(
		"publishes the adapter's record and identity permutation together",
		() =>
			Effect.gen(function* () {
				// An adapter may refine an intent. History must publish its prepared result,
				// rather than interpreting the original request a second time for handles.
				const session = yield* makeHistorySession(tinyFixture()).pipe(
					Effect.provideService(EditorOperations, {
						prepare: (state, action) =>
							coreOperations.prepare(
								state,
								action.type === "reorder"
									? { ...action, order: [2, 1, 0] }
									: action,
							),
					}),
				);
				const before = yield* session.snapshot;
				const after = yield* session.execute([
					{ type: "reorder", ownerId: "1", order: [1, 0, 2] },
				]);
				expect(after.document.SaveGame.player.items).toEqual(
					[...before.document.SaveGame.player.items].reverse(),
				);
				expect(after.identities["1"]).toEqual(
					[...required(before.identities["1"])].reverse(),
				);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(undone.document).toEqual(before.document);
				expect(undone.identities).toEqual(before.identities);
			}),
	);

	it.effect(
		"records identity-only permutations when serialized empty records are identical",
		() =>
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.player.items = [null, null];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const after = yield* session.execute([
					{ type: "reorder", ownerId: "1", order: [1, 0] },
				]);
				// Empty handles are future drop targets, so this permutation is observable
				// even though its XML patch is empty. Undo must restore their original roles.
				expect(after.document).toEqual(before.document);
				expect(after.identities["1"]).toEqual(
					[...required(before.identities["1"])].reverse(),
				);
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).identities).toEqual(before.identities);
			}),
	);

	it.effect(
		"rejects an adapter that discards paired identities without publishing its draft",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(tinyFixture()).pipe(
					Effect.provideService(EditorOperations, {
						prepare: (state, action) =>
							coreOperations
								.prepare(state, action)
								.pipe(Effect.map(({ inventory: _inventory, ...rest }) => rest)),
					}),
				);
				const before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.execute([
						{ type: "reorder", ownerId: "1", order: [2, 1, 0] },
					]),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);

	it.effect(
		"treats malformed imported metadata as unavailable while preserving catalog defects",
		() =>
			Effect.gen(function* () {
				const document = tinyFixture();
				const importedItem: Record<string, unknown> = {
					$type: "StardewValley.Object",
					itemId: { malformed: true },
					bigCraftable: false,
					name: "Parsnip",
					category: -75,
					stack: 3,
					quality: 0,
				};
				document.SaveGame.player.items[0] = malformedFixture(importedItem);
				yield* Effect.scoped(
					Effect.gen(function* () {
						const session = yield* makeHistorySession(document);
						const before = yield* session.snapshot;
						const result = yield* Effect.result(
							session.transact(
								setInventoryItem({
									ownerId: "1",
									entityId: required(before.identities["1"]?.[0]),
									property: "stack",
									value: 4,
								}),
							),
						);
						expect(Result.isFailure(result)).toBe(true);
						expect(yield* session.snapshot).toEqual(before);
					}),
				);
				// Once raw lookup inputs are supported, an implementation exception is a
				// defect for the shared runtime boundary, never an expected edit rejection.
				importedItem.itemId = "24";
				const spy = vi
					.spyOn(itemCatalog, "ResolveItemData")
					.mockImplementation(() => {
						throw new Error("catalog defect");
					});
				try {
					yield* Effect.scoped(
						Effect.gen(function* () {
							const session = yield* makeHistorySession(document);
							const before = yield* session.snapshot;
							const exit = yield* Effect.exit(
								session.transact(
									setInventoryItem({
										ownerId: "1",
										entityId: required(before.identities["1"]?.[0]),
										property: "stack",
										value: 4,
									}),
								),
							);
							expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(
								true,
							);
							expect(yield* session.snapshot).toEqual(before);
						}),
					);
				} finally {
					spy.mockRestore();
				}
			}),
	);

	it.effect(
		"detaches nested raw records from the save and from later backpack and chest projections",
		() =>
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.locations = [
					{
						$type: "StardewValley.Farm",
						name: "Farm",
						objects: [
							{
								key: { X: 3, Y: 7 },
								value: {
									$type: "StardewValley.Objects.Chest",
									name: "Chest",
									items: [
										{
											$type: "StardewValley.Object",
											itemId: "388",
											customModData: { opaque: "007" },
										},
									],
								},
							},
						],
					},
				];
				const session = yield* makeHistorySession(document);
				const state = yield* session.snapshot;
				const original = structuredClone(state.document);
				for (const project of [readBackpacks, readChests]) {
					const first = project(state);
					const second = project(state);
					const slot = required(first[0]?.slots[0]);
					expect(slot).not.toHaveProperty("raw");
					// Consumer-owned presentation data never exposes opaque saved fields.
					Object.assign(slot, { name: "Changed presentation" });
					expect(second[0]?.slots[0]?.name).not.toBe(slot.name);
					expect(project(state)[0]?.slots[0]?.name).not.toBe(slot.name);
				}
				expect(state.document).toEqual(original);
			}),
	);
});
