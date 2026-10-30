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
	if (hands === "") throw new Error("Missing guest");
	const guest = required(hands.Farmer[0]),
		ghost = structuredClone(guest);
	Object.assign(host, {
		homeLocation: "FarmHouse",
		modData: { owner: "host" },
	});
	Object.assign(guest, {
		homeLocation: "CabinGuest",
		modData: { owner: "guest" },
	});
	Object.assign(ghost, {
		name: "",
		UniqueMultiplayerID: "ghost",
		homeLocation: "Unclaimed",
		modData: { ghost: "007" },
	});
	hands.Farmer = [ghost, guest];
	Object.assign(hands, { modWrapper: "keep" });
	Object.assign(document.SaveGame, {
		cellarAssignments: {
			item: [
				{
					key: { int: 1, opaque: "host-key" },
					value: { long: "host", opaque: "host-value" },
				},
				{ key: { int: 2 }, value: { long: "guest" } },
			],
			opaque: "cellar-wrapper",
		},
	});
	document.SaveGame.locations = {
		GameLocation: [
			{
				name: "Farm",
				buildings: {
					Building: [
						{
							id: "cabin",
							buildingType: "Cabin",
							indoors: {
								"@_xsi:type": "Cabin",
								name: "Cabin",
								uniqueName: "CabinGuest",
								farmhandReference: "guest",
								modData: { keep: "007" },
							},
						},
					],
				},
			},
		],
	};
	return document;
}
const rawGame = (
	document: ReturnType<typeof fixture>,
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
				{ farmerId: "host", host: true, home: "FarmHouse" },
				{ farmerId: "guest", host: false, home: "CabinGuest" },
			],
		});
		expect(document).toEqual(before);
	});
	it("promotes a farmhand with complete metadata and inventory identity preservation through Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot;
				yield* session.transact(swapFarmers("host", "guest"));
				const after = yield* session.snapshot,
					hands = after.document.SaveGame.farmhands;
				expect(after.document.SaveGame.player).toMatchObject({
					UniqueMultiplayerID: "guest",
					homeLocation: "FarmHouse",
					modData: { owner: "guest" },
				});
				expect(hands).toMatchObject({
					modWrapper: "keep",
					Farmer: [
						{
							name: "",
							UniqueMultiplayerID: "ghost",
							modData: { ghost: "007" },
						},
						{
							UniqueMultiplayerID: "host",
							homeLocation: "CabinGuest",
							modData: { owner: "host" },
						},
					],
				});
				expect(rawGame(after.document).cellarAssignments).toEqual({
					opaque: "cellar-wrapper",
					item: [
						{
							key: { int: 1, opaque: "host-key" },
							value: { long: "guest", opaque: "host-value" },
						},
						{ key: { int: 2 }, value: { long: "host" } },
					],
				});
				expect(JSON.stringify(after.document.SaveGame.locations)).toContain(
					'"farmhandReference":"host"',
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
				document.SaveGame.player.items.Item = [
					{
						"@_xsi:type": "Object",
						itemId: "388",
						name: "Wood",
						stack: 3,
						quality: 0,
						bigCraftable: false,
					},
				];
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot,
					entityId = required(before.identities.host?.[0]);
				yield* session.transact(
					Effect.gen(function* () {
						yield* setInventoryItem({
							ownerId: "host",
							entityId,
							property: "stack",
							value: 5,
						});
						yield* swapFarmers("host", "guest");
						yield* setInventoryItem({
							ownerId: "host",
							entityId,
							property: "stack",
							value: 7,
						});
					}),
				);
				const after = yield* session.snapshot,
					hands = after.document.SaveGame.farmhands;
				if (hands === "") throw new Error("Missing farmhands");
				expect(
					hands.Farmer.find((farmer) => farmer.UniqueMultiplayerID === "host")
						?.items.Item[0],
				).toMatchObject({ stack: 7 });
				expect(after.entries).toHaveLength(1);
				expect(after.identities.host?.[0]).toBe(entityId);
			}),
		));
	it("rejects ambiguous identities, stale targets and raw inventory writes atomically", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					hands = document.SaveGame.farmhands;
				if (hands === "") throw new Error("Missing farmhands");
				required(hands.Farmer[0]).UniqueMultiplayerID = "host";
				const ambiguous = yield* makeHistorySession(document),
					original = yield* ambiguous.snapshot;
				expect(readFarmerRoster(document).supported).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(
							ambiguous.transact(swapFarmers("host", "guest")),
						),
					),
				).toBe(true);
				expect(yield* ambiguous.snapshot).toEqual(original);
				const session = yield* makeHistorySession(fixture()),
					before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(swapFarmers("missing", "guest")),
						),
					),
				).toBe(true);
				const result = yield* Effect.result(
					session.transact(
						Effect.gen(function* () {
							yield* swapFarmers("host", "guest");
							const draft = yield* TransactionDraft,
								snapshot = yield* draft.read;
							snapshot.state.document.SaveGame.player.items.Item.push({
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
		{ timeout: 20000 },
		async () => {
			const document = parser.parse(fixtureXml),
				host = document.SaveGame.player,
				guest = structuredClone(host);
			const hostId = String(host.UniqueMultiplayerID);
			Object.assign(host, { homeLocation: "FarmHouse" });
			Object.assign(guest, {
				UniqueMultiplayerID: "123456789",
				name: "Guest",
				homeLocation: "CabinGuest",
			});
			document.SaveGame.farmhands = { Farmer: [guest] };
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
				).toBe(123456789);
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
				if (hands === "") throw new Error("Missing fixture farmhands");
				const guest = required(hands.Farmer.find((row) => row.name.trim()));
				if (mode === "duplicate-home")
					Object.assign(guest, { homeLocation: "FarmHouse" });
				else {
					const cabin = required(inspectFarmerRoster(document).cabins[0]);
					cabin.farmhandReference = { opaque: "retain" };
				}
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				expect(readFarmerRoster(document).supported).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(swapFarmers("host", "guest")),
						),
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
					roster.cellars.find((entry) => entry.value.long === "guest"),
				);
			guestCellar.key.int = 9;
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			yield* session.transact(swapFarmers("host", "guest"));
			const after = yield* session.snapshot,
				result = inspectFarmerRoster(after.document);
			expect(after.document.SaveGame.player).toMatchObject({
				UniqueMultiplayerID: "guest",
				homeLocation: "FarmHouse",
			});
			expect(
				result.cellars.map((entry) => [entry.key.int, entry.value.long]),
			).toEqual([
				[1, "guest"],
				[9, "host"],
			]);
			expect(result.supported).toBe(true);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
	));
