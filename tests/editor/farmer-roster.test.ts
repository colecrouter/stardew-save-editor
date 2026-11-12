import { stringifySavedData } from "../../src/lib/editor/saved-data.ts";
import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import { openEditor } from "../../src/lib/editor/editor-model";
import {
	readFarmerRoster,
	inspectFarmerRoster,
} from "../../src/lib/editor/farmer-roster-data";
import { swapFarmers } from "../../src/lib/editor/farmer-roster-operations";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { tinyFixture, fixtureXml, parser, exportDocument } from "./fixtures";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};
function fixture() {
	const document = tinyFixture(),
		host = document.SaveGame.player;
	const hands = document.SaveGame.farmhands;
	if (!Array.isArray(hands)) throw new Error("Missing guest");
	const guest = required(hands[0]),
		ghost = structuredClone(guest);
	Object.assign(host, {
		homeLocation: "FarmHouse",
		customModData: { owner: "1" },
	});
	Object.assign(guest, {
		homeLocation: "CabinGuest",
		customModData: { owner: "2" },
	});
	Object.assign(ghost, {
		name: "",
		UniqueMultiplayerID: "ghost",
		homeLocation: "Unclaimed",
		customModData: { ghost: "007" },
	});
	document.SaveGame.farmhands = [ghost, guest];
	Object.assign(document.SaveGame, { testMetadatafarmhands: "keep" });
	Object.assign(document.SaveGame, {
		cellarAssignments: [
			{
				key: 1,
				value: 1n,
				opaqueKey: "host-key",
				opaqueValue: "host-value",
			},
			{ key: 2, value: 2n },
		],
		testMetadatacellarAssignments: { opaque: "cellar-wrapper" },
	});
	document.SaveGame.locations = [
		{
			$type: "StardewValley.Farm",
			name: "Farm",
			buildings: [
				{
					$type: "StardewValley.Buildings.Building",
					id: "cabin",
					buildingType: "Cabin",
					indoors: {
						$type: "StardewValley.Locations.Cabin",
						name: "Cabin",
						uniqueName: "CabinGuest",
						farmhandReference: 2n,
						customModData: { keep: "007" },
					},
				},
			],
		},
	];
	return document;
}
const rawGame = (
	document: import("../../src/lib/editor/domain.ts").SaveDocument,
): Record<string, unknown> => document.SaveGame;

describe("farmer slot reassignment", () => {
	it("projects named slots without changing ghosts or imported metadata", () => {
		const document = fixture(),
			before = structuredClone(document),
			view = readFarmerRoster(document);
		expect(view).toMatchObject({
			supported: true,
			placeholders: 1,
			players: [
				{ farmerId: "1", host: true, home: "FarmHouse" },
				{ farmerId: "2", host: false, home: "CabinGuest" },
			],
		});
		expect(document).toEqual(before);
	});
	it("promotes a farmhand with complete metadata and inventory identity preservation through Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot;
				yield* session.transact(swapFarmers("1", "2"));
				const after = yield* session.snapshot,
					hands = after.document.SaveGame.farmhands;
				expect(after.document.SaveGame.player).toMatchObject({
					UniqueMultiplayerID: 2n,
					homeLocation: "FarmHouse",
					customModData: { owner: "2" },
				});
				expect(hands).toMatchObject([
					{
						name: "",
						UniqueMultiplayerID: "ghost",
						customModData: { ghost: "007" },
					},
					{
						UniqueMultiplayerID: 1n,
						homeLocation: "CabinGuest",
						customModData: { owner: "1" },
					},
				]);
				expect(rawGame(after.document).testMetadatafarmhands).toBe("keep");
				expect(rawGame(after.document).cellarAssignments).toEqual([
					{
						key: 1,
						value: 2n,
						opaqueKey: "host-key",
						opaqueValue: "host-value",
					},
					{ key: 2, value: 1n },
				]);
				expect(stringifySavedData(after.document.SaveGame.locations)).toContain(
					'"farmhandReference":"1n"',
				);
				expect(after.identities).toEqual(before.identities);
				expect(after.equipmentIdentities).toEqual(before.equipmentIdentities);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("replays item edits on both sides of host promotion in their original order", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				document.SaveGame.player.items = [
					{
						$type: "StardewValley.Object",
						itemId: "388",
						name: "Wood",
						stack: 3,
						quality: 0,
						bigCraftable: false,
					},
				];
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot,
					entityId = required(before.identities["1"]?.[0]);
				yield* session.transact(
					Effect.gen(function* () {
						yield* setInventoryItem({
							ownerId: "1",
							entityId,
							property: "stack",
							value: 5,
						});
						yield* swapFarmers("1", "2");
						yield* setInventoryItem({
							ownerId: "1",
							entityId,
							property: "stack",
							value: 7,
						});
					}),
				);
				const after = yield* session.snapshot,
					hands = after.document.SaveGame.farmhands;
				if (!Array.isArray(hands)) throw new Error("Missing farmhands");
				expect(
					hands.find((farmer) => String(farmer?.UniqueMultiplayerID) === "1")
						?.items?.[0],
				).toMatchObject({ stack: 7 });
				expect(after.entries).toHaveLength(1);
				expect(after.identities["1"]?.[0]).toBe(entityId);
			}),
		));
	it("rejects ambiguous identities, stale targets and raw inventory writes atomically", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					hands = document.SaveGame.farmhands;
				if (!Array.isArray(hands)) throw new Error("Missing farmhands");
				required(hands[0]).UniqueMultiplayerID = 1n;
				const ambiguous = yield* makeHistorySession(document),
					original = yield* ambiguous.snapshot;
				expect(readFarmerRoster(document).supported).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(ambiguous.transact(swapFarmers("1", "2"))),
					),
				).toBe(true);
				expect(yield* ambiguous.snapshot).toEqual(original);
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(session.transact(swapFarmers("missing", "2"))),
					),
				).toBe(true);
				const result = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* swapFarmers("1", "2");
							const draft = yield* TransactionDraft,
								snapshot = yield* draft.read;
							snapshot.state.document.SaveGame.player.items.push({
								$type: "StardewValley.Object",
								itemId: "388",
								stack: 999,
							});
							yield* draft.replace(snapshot);
						}),
					),
				);
				expect(Result.isFailure(result)).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));
	it(
		"preserves the selected farmer identity and exports a promoted host on a full save",
		{ timeout: 60_000 },
		async () => {
			const document = parser.parse(fixtureXml),
				host = document.SaveGame.player,
				guest = structuredClone(host);
			const hostId = String(host.UniqueMultiplayerID);
			Object.assign(host, { homeLocation: "FarmHouse" });
			Object.assign(guest, {
				UniqueMultiplayerID: 123456789n,
				name: "Guest",
				homeLocation: "CabinGuest",
			});
			document.SaveGame.farmhands = [guest];
			const opened = await openEditor(
				new TextEncoder().encode(exportDocument(document)),
			);
			try {
				await opened.model.commands.selectFarmer("123456789");
				const outcome = await opened.model.commands.transact(
					swapFarmers(hostId, "123456789"),
				);
				expect(outcome && Result.isSuccess(outcome)).toBe(true);
				expect(
					opened.model.atomBindings.registry.get(
						opened.model.atomBindings.selectedFarmerId,
					),
				).toBe("123456789");
				const exported = await opened.model.commands.export();
				if (!exported || Result.isFailure(exported))
					throw new Error("Export failed");
				expect(
					parser.parse(new TextDecoder().decode(exported.success)).SaveGame
						.player.UniqueMultiplayerID,
				).toBe(123456789n);
			} finally {
				await opened.close();
			}
		},
	);
});

it.each(["duplicate-home", "opaque-reference"] as const)(
	"rejects %s without changing records or paired identities",
	(mode) =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					hands = document.SaveGame.farmhands;
				if (!Array.isArray(hands)) throw new Error("Missing fixture farmhands");
				const guest = required(hands.find((row) => row?.name?.trim()));
				if (!guest) throw Error("Missing named fixture guest");
				if (mode === "duplicate-home")
					Object.assign(required(guest), { homeLocation: "FarmHouse" });
				else {
					const cabin = required(inspectFarmerRoster(document).cabins[0]);
					cabin.farmhandReference = { opaque: "retain" };
				}
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				expect(readFarmerRoster(document).supported).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(session.transact(swapFarmers("1", "2"))),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		),
);

it("keeps sparse cellar identities paired to the physical homes through host promotion", () =>
	run(
		Effect.gen(function* () {
			const document = fixture(),
				roster = inspectFarmerRoster(document),
				guestCellar = required(
					roster.cellars.find((entry) => String(entry.value) === "2"),
				);
			guestCellar.key = 9;
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			yield* session.transact(swapFarmers("1", "2"));
			const after = yield* session.snapshot,
				result = inspectFarmerRoster(after.document);
			expect(after.document.SaveGame.player).toMatchObject({
				UniqueMultiplayerID: 2n,
				homeLocation: "FarmHouse",
			});
			expect(result.cellars.map((entry) => [entry.key, entry.value])).toEqual([
				[1, 2n],
				[9, 1n],
			]);
			expect(result.supported).toBe(true);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
	));
