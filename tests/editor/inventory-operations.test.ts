import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	setInventoryItem,
	decodeInventoryItemChange,
	type InventoryItemChange,
} from "../../src/lib/editor/inventory-operations";
import { readBackpacks } from "../../src/lib/editor/inventory-views";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture } from "./fixtures";

// Small documents exercise capability boundaries independently of XML/catalog
// size. Opaque sibling data must remain exact through field edits and history.
const fixture = () => {
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
			modData: { opaque: "0007" },
		},
		{ "@_xsi:nil": "true" },
		{
			"@_xsi:type": "Object",
			itemId: "388",
			name: "Wood",
			bigCraftable: false,
			category: -16,
			stack: 5,
			quality: 0,
		},
	];
	return document;
};
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));

// Required fixture lookups fail explicitly so a missing setup slot cannot weaken
// a preservation assertion or accidentally send an undefined entity target.
function required<A>(value: A | undefined): A {
	if (value === undefined) throw Error("Missing expected fixture value");
	return value;
}
describe("bounded backpack edits", () => {
	it("updates fields with exact preservation, detached views and undo/redo identities", async () =>
		run(
			Effect.gen(function* () {
				const original = fixture();
				const session = yield* makeHistorySession(original);
				const before = yield* session.snapshot;
				const view = readBackpacks(before);
				const slot = required(required(view[0]).slots[0]);
				const entityId = slot.entityId;
				Object.assign(slot, { quantity: 900 });
				expect(slot).not.toHaveProperty("raw");
				expect(yield* session.snapshot).toEqual(before);
				const after = yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 9999,
					}),
				);
				const expected = structuredClone(original);
				(
					expected.SaveGame.player.items.Item[0] as Record<string, unknown>
				).stack = 9999;
				expect(after.document).toEqual(expected);
				expect(after.identities).toEqual(before.identities);
				expect(after.entries).toHaveLength(1);
				expect(
					required(required(after.entries[0]).annotations[0]).tags,
				).toContain("inventory:stack");
				expect(required(after.entries[0]).intent.label).toBe(
					"Host: Parsnip quantity",
				);
				expect(
					required(required(after.entries[0]).annotations[0]).tags,
				).toEqual(
					expect.arrayContaining(["farmer:host", `entity:${entityId}`]),
				);
				const quality = yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "quality",
						value: 4,
					}),
				);
				expect(
					(
						quality.document.SaveGame.player.items.Item[0] as Record<
							string,
							unknown
						>
					).quality,
				).toBe(4);
				expect((yield* session.undo).document).toEqual(after.document);
				expect((yield* session.redo).document).toEqual(quality.document);
				expect((yield* session.undo).identities).toEqual(before.identities);
			}),
		));

	it("resolves stable entities after reorder and transfer, including undo", async () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const entityId = required(before.identities.host?.[0]);
				yield* session.execute([
					{ type: "reorder", ownerId: "host", order: [2, 1, 0] },
				]);
				const edited = yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 12,
					}),
				);
				expect(
					(
						edited.document.SaveGame.player.items.Item[2] as Record<
							string,
							unknown
						>
					).stack,
				).toBe(12);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).identities).toEqual(before.identities);
				yield* session.execute([
					{
						type: "item-move",
						ownerId: "host",
						slot: 0,
						toOwnerId: "host",
						toSlot: 1,
					},
				]);
				const moved = yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "quality",
						value: 2,
					}),
				);
				expect(
					(
						moved.document.SaveGame.player.items.Item[1] as Record<
							string,
							unknown
						>
					).quality,
				).toBe(2);
			}),
		));

	it("transferred entities require their current farmer and undo restores ownership", async () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				if (document.SaveGame.farmhands === "") throw Error("Expected guest");
				required(document.SaveGame.farmhands.Farmer[0]).items.Item = [
					{ "@_xsi:nil": "true" },
				];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const entityId = required(before.identities.host?.[0]);
				const moved = yield* session.execute([
					{
						type: "item-move",
						ownerId: "host",
						slot: 0,
						toOwnerId: "guest",
						toSlot: 0,
					},
				]);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setInventoryItem({
									ownerId: "host",
									entityId,
									property: "stack",
									value: 7,
								}),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(moved);
				const edited = yield* session.transact(
					setInventoryItem({
						ownerId: "guest",
						entityId,
						property: "stack",
						value: 7,
					}),
				);
				expect(
					readBackpacks(edited).find((view) => view.ownerId === "guest")
						?.slots[0]?.quantity,
				).toBe(7);
				yield* session.undo;
				const restored = yield* session.undo;
				expect(restored.document).toEqual(before.document);
				expect(restored.identities).toEqual(before.identities);
			}),
		));

	it.each([
		{ slot: 2, temporary: { category: -75 }, property: "quality", value: 4 },
		{
			slot: 0,
			temporary: { "@_xsi:type": "Object", bigCraftable: false, itemId: "24" },
			property: "stack",
			value: 8,
		},
	] as const)(
		"rejects transient eligibility laundering %j",
		async ({ slot, temporary, property, value }) =>
			run(
				Effect.gen(function* () {
					const document = fixture();
					// The second case starts as an unsupported tool; the first starts as Wood,
					// whose serialized category excludes quality despite a numeric quality field.
					if (slot === 0)
						Object.assign(document.SaveGame.player.items.Item[0] as object, {
							"@_xsi:type": "Axe",
							bigCraftable: true,
							itemId: "unknown-tool",
						});
					const session = yield* makeHistorySession(document);
					const before = yield* session.snapshot;
					const attempt = Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const edited = yield* draft.read;
						const item = edited.state.document.SaveGame.player.items.Item[
							slot
						] as Record<string, unknown>;
						const original = structuredClone(item);
						Object.assign(item, temporary);
						yield* draft.replace(edited);
						yield* setInventoryItem({
							ownerId: "host",
							entityId: required(before.identities.host?.[slot]),
							...(property === "quality"
								? { property, value: 4 as const }
								: { property, value }),
						});
						const restored = yield* draft.read;
						const target = restored.state.document.SaveGame.player.items.Item[
							slot
						] as Record<string, unknown>;
						// A final-state-only guard would miss the temporary unsupported fields after
						// these originals are restored, leaving only the unauthorized value change.
						for (const key of Object.keys(temporary))
							target[key] = original[key];
						yield* draft.replace(restored);
					});
					expect(
						Result.isFailure(yield* Effect.result(session.transact(attempt))),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}),
			),
	);

	it("allows consecutive authorized fields alongside noninventory draft changes", async () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const entityId = required(before.identities.host?.[0]);
				const after = yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.player.money = 99;
						yield* draft.replace(snapshot);
						yield* setInventoryItem({
							ownerId: "host",
							entityId,
							property: "stack",
							value: 5,
						});
						yield* setInventoryItem({
							ownerId: "host",
							entityId,
							property: "quality",
							value: 2,
						});
					}),
				);
				expect(after.document.SaveGame.player.money).toBe(99);
				expect(after.document.SaveGame.player.items.Item[0]).toMatchObject({
					stack: 5,
					quality: 2,
				});
				expect(after.entries).toHaveLength(1);
				expect((yield* session.undo).document).toEqual(before.document);
			}),
		));

	it("rejects raw inventory edits even when mixed with an authorized edit", async () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const entityId = required(before.identities.host?.[0]);
				const raw = Effect.gen(function* () {
					yield* setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 9,
					});
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					(
						snapshot.state.document.SaveGame.player.items.Item[0] as Record<
							string,
							unknown
						>
					).modData = { opaque: "tampered" };
					yield* draft.replace(snapshot);
				});
				expect(
					Result.isFailure(yield* Effect.result(session.transact(raw))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it("rejects stale, unsupported and invalid edits without disturbing redo", async () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const initial = yield* session.snapshot;
				const entityId = required(initial.identities.host?.[0]);
				yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 9,
					}),
				);
				yield* session.undo;
				const before = yield* session.snapshot;
				for (const change of [
					{ ownerId: "host", entityId, property: "stack", value: 0 },
					{ ownerId: "host", entityId, property: "quality", value: 3 },
					{
						ownerId: "host",
						entityId: "missing",
						property: "stack",
						value: 9,
					},
					{ ownerId: "guest", entityId, property: "stack", value: 9 },
					{
						ownerId: "host",
						entityId: required(initial.identities.host?.[1]),
						property: "stack",
						value: 9,
					},
					{
						ownerId: "host",
						entityId: required(initial.identities.host?.[2]),
						property: "quality",
						value: 4,
					},
				] as const) {
					expect(
						Result.isFailure(
							// Deliberately cross the typed boundary with malformed runtime input:
							// schema validation must still reject callers that bypass TypeScript.
							yield* Effect.result(
								session.transact(
									setInventoryItem(change as InventoryItemChange),
								),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
				yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId,
						property: "stack",
						value: 3,
					}),
				);
				expect(yield* session.snapshot).toEqual(before);
				expect((yield* session.redo).cursor).toBe(1);
			}),
		));

	it("tolerates ambiguous IDs and unsupported arrays without normalizing imports", async () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				if (document.SaveGame.farmhands === "") throw Error("Expected guest");
				required(document.SaveGame.farmhands.Farmer[0]).UniqueMultiplayerID =
					"host";
				(document.SaveGame.player as unknown as Record<string, unknown>).items =
					"ModdedInventory";
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(before.identities).toEqual({});
				expect(readBackpacks(before).every((view) => !view.supported)).toBe(
					true,
				);
				const after = yield* session.execute([
					{ type: "farm-name", value: "New farm" },
				]);
				expect(
					(after.document.SaveGame.player as unknown as Record<string, unknown>)
						.items,
				).toBe("ModdedInventory");
			}),
		));

	it("preserves opaque and unsupported records without granting edit capabilities", async () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				document.SaveGame.player.items.Item.push(
					{
						"@_xsi:type": "Object",
						itemId: "mod.unknown",
						name: "Opaque Mod Item",
						bigCraftable: false,
						stack: 9,
						quality: 0,
						category: -75,
					},
					{
						"@_xsi:type": "Object",
						itemId: "24",
						bigCraftable: true,
						stack: 1,
						quality: 0,
					},
					{
						"@_xsi:type": "Axe",
						itemId: "24",
						bigCraftable: false,
						stack: 1,
						quality: 0,
					},
					{
						"@_xsi:type": "Object",
						itemId: "24",
						bigCraftable: false,
						stack: "3",
						quality: 0,
					},
				);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				for (const entityId of required(before.identities.host).slice(3)) {
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.transact(
									setInventoryItem({
										ownerId: "host",
										entityId,
										property: "stack",
										value: 2,
									}),
								),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
			}),
		));

	it("skips malformed farmer records while retaining exact opaque representations", async () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				if (document.SaveGame.farmhands === "")
					throw Error("Expected farmer container");
				document.SaveGame.farmhands.Farmer = [
					null,
					42,
					{ name: "Missing ID", items: { Item: [] } },
					// Imported JSON can shadow conversion methods. Inspecting an invalid
					// identifier must not coerce it or prevent edits to the valid host.
					{
						name: "Opaque ID",
						UniqueMultiplayerID: { toString: 0 },
						items: { Item: [] },
					},
				] as never;
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(Object.keys(before.identities)).toEqual(["host"]);
				expect(readBackpacks(before).map((view) => view.supported)).toEqual([
					true,
					false,
					false,
				]);
				const after = yield* session.transact(
					setInventoryItem({
						ownerId: "host",
						entityId: required(before.identities.host?.[0]),
						property: "stack",
						value: 4,
					}),
				);
				expect(after.document.SaveGame.farmhands).toEqual(
					document.SaveGame.farmhands,
				);
			}),
		));

	it("rejects an interrupted compound edit without publishing fields or review", async () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const result = yield* Effect.exit(
					session.transact(
						Effect.gen(function* () {
							yield* setInventoryItem({
								ownerId: "host",
								entityId: required(before.identities.host?.[0]),
								property: "stack",
								value: 4,
							});
							return yield* Effect.interrupt;
						}),
					),
				);
				expect(result._tag).toBe("Failure");
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it("rejects inherited and unknown request fields without coercing valid quantities", () => {
		const base = {
			ownerId: "host",
			entityId: "item:1",
			property: "stack",
			value: 1,
		};
		expect(
			Result.isFailure(decodeInventoryItemChange({ ...base, extra: true })),
		).toBe(true);
		expect(
			Result.isFailure(decodeInventoryItemChange(Object.create(base))),
		).toBe(true);
		expect(
			Result.isFailure(decodeInventoryItemChange({ ...base, value: "1" })),
		).toBe(true);
		for (const value of [1, 9999])
			expect(
				Result.isSuccess(decodeInventoryItemChange({ ...base, value })),
			).toBe(true);
		for (const value of [0, 1, 2, 4])
			expect(
				Result.isSuccess(
					decodeInventoryItemChange({ ...base, property: "quality", value }),
				),
			).toBe(true);
	});

	it.each([0, 10000, 1.5, Number.NaN, Infinity])(
		"rejects invalid schema quantity %s",
		(value) => {
			expect(
				Result.isFailure(
					decodeInventoryItemChange({
						ownerId: "host",
						entityId: "item:1",
						property: "stack",
						value,
					}),
				),
			).toBe(true);
		},
	);
});

it("projects opaque item identifiers without invoking their conversion fields", () => {
	const document = tinyFixture();
	document.SaveGame.player.items.Item[0] = {
		itemId: { toString: 0 },
		name: "Opaque ID",
	};
	const before = structuredClone(document);
	const view = readBackpacks({
		document,
		identities: { host: ["a", "b", "c"] },
	});
	expect(view[0]?.slots[0]?.itemId).toBe("");
	expect(view[0]?.slots[0]).not.toHaveProperty("raw");
	expect(document).toEqual(before);
});
