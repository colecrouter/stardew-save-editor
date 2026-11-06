import * as itemCatalog from "../../src/lib/ItemData";
import { describe, expect, it, vi } from "vitest";
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
import { tinyFixture } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));

// Fail fixture setup explicitly rather than allowing absent handles to weaken assertions.
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

describe("prepared inventory transitions", () => {
	it("publishes the adapter's record and identity permutation together", () =>
		run(
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
					{ type: "reorder", ownerId: "host", order: [1, 0, 2] },
				]);
				expect(after.document.SaveGame.player.items.Item).toEqual(
					[...before.document.SaveGame.player.items.Item].reverse(),
				);
				expect(after.identities.host).toEqual(
					[...required(before.identities.host)].reverse(),
				);
				yield* session.undo;
				const undone = yield* session.snapshot;
				expect(undone.document).toEqual(before.document);
				expect(undone.identities).toEqual(before.identities);
			}),
		));

	it("records identity-only permutations when serialized empty records are identical", () =>
		run(
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.player.items.Item = [
					{ "@_xsi:nil": "true" },
					{ "@_xsi:nil": "true" },
				];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const after = yield* session.execute([
					{ type: "reorder", ownerId: "host", order: [1, 0] },
				]);
				// Empty handles are future drop targets, so this permutation is observable
				// even though its XML patch is empty. Undo must restore their original roles.
				expect(after.document).toEqual(before.document);
				expect(after.identities.host).toEqual(
					[...required(before.identities.host)].reverse(),
				);
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).identities).toEqual(before.identities);
			}),
		));

	it("rejects an adapter that discards paired identities without publishing its draft", () =>
		run(
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
						{ type: "reorder", ownerId: "host", order: [2, 1, 0] },
					]),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it("treats malformed imported metadata as unavailable while preserving catalog defects", async () => {
		const document = tinyFixture();
		const importedItem: Record<string, unknown> = {
			"@_xsi:type": "Object",
			itemId: { malformed: true },
			bigCraftable: false,
			name: "Parsnip",
			category: -75,
			stack: 3,
			quality: 0,
		};
		document.SaveGame.player.items.Item[0] = importedItem;
		await run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(
						setInventoryItem({
							ownerId: "host",
							entityId: required(before.identities.host?.[0]),
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
			await run(
				Effect.gen(function* () {
					const session = yield* makeHistorySession(document);
					const before = yield* session.snapshot;
					const exit = yield* Effect.exit(
						session.transact(
							setInventoryItem({
								ownerId: "host",
								entityId: required(before.identities.host?.[0]),
								property: "stack",
								value: 4,
							}),
						),
					);
					expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}),
			);
		} finally {
			spy.mockRestore();
		}
	});

	it("detaches nested raw records from the save and from later backpack and chest projections", () =>
		run(
			Effect.gen(function* () {
				const document = tinyFixture();
				document.SaveGame.locations = {
					GameLocation: [
						{
							name: "Farm",
							objects: {
								item: [
									{
										key: { Vector2: { X: 3, Y: 7 } },
										value: {
											Object: {
												"@_xsi:type": "Chest",
												name: "Chest",
												items: {
													Item: [{ itemId: "388", modData: { opaque: "007" } }],
												},
											},
										},
									},
								],
							},
						},
					],
				};
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
		));
});
