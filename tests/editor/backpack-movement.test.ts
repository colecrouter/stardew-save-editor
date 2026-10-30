import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { openEditor } from "../../src/lib/editor/editor-model";
import type { InventoryMoveRequest } from "../../src/lib/editor/inventory-movement.ts";
import { tinyFixture, fixtureXml, parser } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw Error("Missing fixture handle");
	return value;
};
function fixture(hostSlots = 12, guestSlots = 24) {
	const document = tinyFixture();
	const nil = (index: number) => ({ "@_xsi:nil": "true", opaqueSlot: index });
	// Imported/modded arrays define the actual addressable slots; maxItems is
	// preserved metadata rather than authority to invent or truncate records.
	(document.SaveGame.player as unknown as Record<string, unknown>).maxItems =
		36;
	document.SaveGame.player.items.Item = Array.from(
		{ length: hostSlots },
		(_, index) => nil(index),
	);
	document.SaveGame.player.items.Item[0] = {
		itemId: "mod.opaque",
		name: "Keepsake",
		stack: 4,
		custom: { flags: [0, false, "007"] },
	};
	if (document.SaveGame.farmhands === "") throw Error("Expected farmhand");
	document.SaveGame.farmhands.Farmer[0]!.items.Item = Array.from(
		{ length: guestSlots },
		(_, index) => nil(index),
	);
	document.SaveGame.farmhands.Farmer[0]!.items.Item[guestSlots - 1] = {
		itemId: "target",
		name: "Other",
		custom: { field: "untouched" },
	};
	return document;
}
function request(
	ids: Record<string, string[]>,
	source = 0,
	destination = 1,
	toOwnerId = "host",
): InventoryMoveRequest {
	return {
		type: "backpack-move",
		ownerId: "host",
		entityId: required(ids.host?.[source]),
		toOwnerId: toOwnerId,
		toEntityId: required(ids[toOwnerId]?.[destination]),
	};
}

describe("backpack moving and swapping", () => {
	it.each([
		[12, 24],
		[24, 36],
		[36, 12],
		[7, 17],
	])(
		"moves and swaps between %s/%s-slot backpacks without growing either inventory",
		(hostSlots, guestSlots) =>
			run(
				Effect.gen(function* () {
					const original = fixture(hostSlots, guestSlots);
					const session = yield* makeHistorySession(original);
					const before = yield* session.snapshot;
					const move = request(before.identities, 0, guestSlots - 2, "guest");
					yield* session.execute([move]);
					const moved = yield* session.snapshot;
					const expected = structuredClone(original);
					if (expected.SaveGame.farmhands === "")
						throw Error("Expected farmhand");
					const guest = expected.SaveGame.farmhands.Farmer[0]!;
					[
						expected.SaveGame.player.items.Item[0],
						guest.items.Item[guestSlots - 2],
					] = [
						guest.items.Item[guestSlots - 2],
						expected.SaveGame.player.items.Item[0],
					];
					expect(moved.document).toEqual(expected);
					expect(moved.identities.guest?.[guestSlots - 2]).toBe(move.entityId);
					expect(moved.identities.host?.[0]).toBe(move.toEntityId);
					expect(moved.nextIdentity).toBe(before.nextIdentity);
					yield* session.undo;
					expect((yield* session.snapshot).document).toEqual(original);
					expect((yield* session.snapshot).identities).toEqual(
						before.identities,
					);
					yield* session.redo;
					expect((yield* session.snapshot).document).toEqual(expected);
					// A second transfer into an occupied slot is a complete two-way swap, not
					// an item-type merge or a replacement of the destination record.
					yield* session.undo;
					yield* session.execute([
						request(before.identities, 0, guestSlots - 1, "guest"),
					]);
					const swapped = yield* session.snapshot;
					if (swapped.document.SaveGame.farmhands === "")
						throw Error("Expected farmhand");
					expect(swapped.document.SaveGame.player.items.Item[0]).toEqual(
						guest.items.Item[guestSlots - 1],
					);
					expect(
						swapped.document.SaveGame.farmhands.Farmer[0]?.items.Item[
							guestSlots - 1
						],
					).toEqual(original.SaveGame.player.items.Item[0]);
					expect(swapped.identities.host?.[0]).toBe(
						before.identities.guest?.[guestSlots - 1],
					);
					expect(swapped.identities.guest?.[guestSlots - 1]).toBe(
						before.identities.host?.[0],
					);
				}),
			),
	);

	it("keeps byte-identical instances distinct and treats self-drop as a no-op preserving redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				document.SaveGame.player.items.Item[1] = structuredClone(
					document.SaveGame.player.items.Item[0],
				);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.execute([request(before.identities)]);
				const swapped = yield* session.snapshot;
				expect(swapped.document).toEqual(document);
				expect(swapped.identities.host?.slice(0, 2)).toEqual(
					before.identities.host?.slice(0, 2).reverse(),
				);
				expect(swapped.entries).toHaveLength(1);
				yield* session.undo;
				const undone = yield* session.snapshot;
				yield* session.execute([request(undone.identities, 0, 0)]);
				expect(yield* session.snapshot).toEqual(undone);
				yield* session.redo;
				expect((yield* session.snapshot).identities).toEqual(
					swapped.identities,
				);
			}),
		));

	it("rejects a replaced destination handle and rolls back earlier changes in the same group", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const initial = yield* session.snapshot;
				const stale = request(initial.identities);
				yield* session.execute([
					{
						type: "backpack-add",
						ownerId: "host",
						entityId: stale.toEntityId,
						catalogId: "Wood",
					},
				]);
				const before = yield* session.snapshot;
				const failed = yield* Effect.result(
					session.execute([
						{ type: "money", farmerId: "host", value: 99 },
						stale,
					]),
				);
				expect(Result.isFailure(failed)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
				const sourceRemoved = request(before.identities);
				yield* session.execute([
					{
						type: "backpack-remove",
						ownerId: "host",
						entityId: sourceRemoved.entityId,
					},
				]);
				const removed = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(session.execute([sourceRemoved])),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(removed);
			}),
		));

	it("resolves handles after reorder and ignores opaque unrelated farmer identifiers", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				if (document.SaveGame.farmhands === "")
					throw Error("Expected farmhand");
				document.SaveGame.farmhands.Farmer.push(
					null as never,
					{ UniqueMultiplayerID: { toString: 0 }, items: "opaque" } as never,
				);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const action = request(before.identities, 0, 23, "guest");
				yield* session.execute([
					{
						type: "reorder",
						ownerId: "host",
						order: Array.from({ length: 12 }, (_, index) => 11 - index),
					},
				]);
				yield* session.execute([action]);
				const after = yield* session.snapshot;
				expect(after.identities.host?.[11]).toBe(action.toEntityId);
				expect(after.identities.guest?.[23]).toBe(action.entityId);
				if (after.document.SaveGame.farmhands === "")
					throw Error("Expected farmhand");
				expect(after.document.SaveGame.farmhands.Farmer.slice(1)).toEqual(
					document.SaveGame.farmhands.Farmer.slice(1),
				);
			}),
		));

	it("rejects invalid, inherited, empty-source and unsupported-owner requests without publication", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				if (document.SaveGame.farmhands === "")
					throw Error("Expected farmhand");
				document.SaveGame.farmhands.Farmer.push(
					{
						...structuredClone(document.SaveGame.farmhands.Farmer[0]!),
						UniqueMultiplayerID: "ambiguous",
					},
					{
						...structuredClone(document.SaveGame.farmhands.Farmer[0]!),
						UniqueMultiplayerID: "ambiguous",
					},
				);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const valid = request(before.identities);
				for (const input of [
					Object.create(valid),
					{ ...valid, extra: true },
					{ ...valid, toEntityId: "missing" },
					{ ...valid, toOwnerId: "ambiguous" },
					{ ...valid, entityId: valid.toEntityId },
					{ ...valid, toOwnerId: "constructor" },
				]) {
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.execute([input as InventoryMoveRequest]),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}
			}),
		));
});

it(
	"returns the committed destination owner before queued Undo changes the current view",
	{ timeout: 15_000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		try {
			const initial = await opened.model.snapshot();
			const farmerId = String(
				initial.document.SaveGame.player.UniqueMultiplayerID,
			);
			const entityId = required(initial.identities[farmerId]?.[0]);
			const toEntityId = required(initial.identities[farmerId]?.[1]);
			const moving = opened.model.commands.moveInventoryItem({
				type: "backpack-move",
				ownerId: farmerId,
				entityId,
				toOwnerId: farmerId,
				toEntityId,
			});
			const undo = opened.model.commands.undo();
			const result = await moving;
			expect(result && Result.isSuccess(result) && result.success).toEqual({
				ownerId: farmerId,
				entityId,
			});
			await undo;
			const after = await opened.model.snapshot();
			expect(after.document).toEqual(parser.parse(fixtureXml));
			expect(after.identities).toEqual(initial.identities);
		} finally {
			await opened.close();
		}
	},
);
