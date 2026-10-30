import { record } from "../../src/lib/editor/saved-collections";
import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	readCommunity,
	inspectCommunity,
	progressId,
	submissionFlags,
} from "../../src/lib/editor/community-data";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { communityRooms } from "../../src/lib/communityCenterData";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft";
import { parser, fixtureXml, exportDocument } from "./fixtures";
const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};
const fixture = () => parser.parse(fixtureXml);

it("projects every saved bundle without import writes and retains string IDs/tails", () => {
	const document = fixture(),
		before = structuredClone(document),
		view = readCommunity(document);
	expect(view.supported).toBe(true);
	expect(view.rooms).toHaveLength(7);
	expect(view.bundles.length).toBeGreaterThan(20);
	expect(view.bundles.every((row) => row.supported)).toBe(true);
	expect(document).toEqual(before);
});
it("completes a room with rewards and mail once, preserves unrelated imports, and round-trips Undo/Redo/XML", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			const definition = required(
				inspectCommunity(document).definitions.entries.find((row) =>
					JSON.stringify(row).includes("Crafts Room/13"),
				),
			);
			if (!record(definition)) throw new Error("Missing definition record");
			Object.assign(definition, { modData: { opaque: "007" } });
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			const room = readCommunity(document).bundles.filter(
				(row) => row.room === 1,
			);
			yield* session.transact(
				Effect.gen(function* () {
					for (const bundle of room)
						yield* setCommunityProgress({
							type: "bundle",
							bundleKey: bundle.key,
							value: true,
						});
				}),
			);
			const after = yield* session.snapshot,
				view = readCommunity(after.document);
			expect(view.rooms.find((row) => row.id === 1)).toMatchObject({
				completed: true,
				restored: true,
			});
			expect(
				view.bundles
					.filter((row) => row.room === 1)
					.every((row) => row.rewardAvailable),
			).toBe(true);
			expect(after.document.SaveGame.player).toMatchObject({
				mailReceived: { string: expect.arrayContaining(["ccCraftsRoom"]) },
			});
			expect(inspectCommunity(after.document).definitions.entries).toEqual(
				inspectCommunity(before.document).definitions.entries,
			);
			expect(
				readCommunity(parser.parse(exportDocument(after.document))).rooms.find(
					(row) => row.id === 1,
				)?.completed,
			).toBe(true);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
			const count = after.entries.length;
			yield* session.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: required(room[0]).key,
					value: true,
				}),
			);
			expect((yield* session.snapshot).entries).toHaveLength(count);
		}),
	));
// Completing every original bundle exercises repeated progression edits against
// a full save. Allow CI headroom for that integration workload without relaxing
// the default timeout for the smaller Community tests.
it(
	"completes the original six rooms without completing theater, and retains door access while Missing progresses",
	{ timeout: 20000 },
	() =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const initial = readCommunity((yield* session.snapshot).document);
				yield* session.transact(
					Effect.gen(function* () {
						for (const bundle of initial.bundles.filter(
							(row) => row.room !== 6,
						))
							yield* setCommunityProgress({
								type: "bundle",
								bundleKey: bundle.key,
								value: true,
							});
					}),
				);
				const complete = yield* session.snapshot;
				expect(complete.document.SaveGame.player).toMatchObject({
					mailReceived: {
						string: expect.arrayContaining([
							"ccIsComplete",
							"seenJunimoNote",
							"abandonedJojaMartAccessible",
						]),
					},
				});
				expect(readCommunity(complete.document).theater).toBe(false);
				const missing = required(
						readCommunity(complete.document).bundles.find(
							(row) => row.room === 6,
						),
					),
					requirement = required(missing.requirements[0]);
				yield* session.transact(
					setCommunityProgress({
						type: "donation",
						bundleKey: missing.key,
						index: requirement.index,
						itemId: requirement.itemId,
						quantity: requirement.quantity,
						quality: requirement.quality,
						value: !requirement.submitted,
					}),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					mailReceived: {
						string: expect.arrayContaining([
							"ccIsComplete",
							"abandonedJojaMartAccessible",
						]),
					},
				});
			}),
		),
);
it("keeps bought Joja projects and does not buy the theater when the fifth project completes", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				mailReceived: { string: ["JojaMember", "ccVault", "jojaVault"] },
			});
			const session = yield* makeHistorySession(document);
			const other = required(
				readCommunity(document).bundles.find((row) => row.room === 1),
			);
			yield* session.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: other.key,
					value: true,
				}),
			);
			expect((yield* session.snapshot).document.SaveGame.player).toMatchObject({
				mailReceived: {
					string: expect.arrayContaining(["ccVault", "jojaVault"]),
				},
			});
			yield* session.transact(
				Effect.gen(function* () {
					for (const room of communityRooms.filter((row) => "project" in row))
						yield* setCommunityProgress({
							type: "project",
							room: room.id,
							value: true,
						});
				}),
			);
			const projects = yield* session.snapshot;
			expect(readCommunity(projects.document).theater).toBe(false);
			expect(projects.document.SaveGame.player).toMatchObject({
				mailReceived: { string: expect.arrayContaining(["ccIsComplete"]) },
			});
			yield* session.transact(
				setCommunityProgress({ type: "theater", value: true }),
			);
			const theater = yield* session.snapshot;
			expect(readCommunity(theater.document).theater).toBe(true);
			const reward = inspectCommunity(theater.document).rewards.entries.find(
				(row) => progressId(row) === 36,
			);
			expect(JSON.stringify(reward)).not.toContain('"boolean":true');
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(projects.document);
		}),
	));
it("rejects stale requirement identities and late malformed mail without partial writes", () =>
	run(
		Effect.gen(function* () {
			const document = fixture(),
				bundle = required(
					readCommunity(document).bundles.find((row) => row.id === 13),
				),
				item = required(bundle.requirements[0]);
			const session = yield* makeHistorySession(document),
				before = yield* session.snapshot;
			expect(
				Result.isFailure(
					yield* Effect.result(
						session.transact(
							setCommunityProgress({
								type: "donation",
								bundleKey: bundle.key,
								index: item.index,
								itemId: "different",
								quantity: item.quantity,
								quality: item.quality,
								value: true,
							}),
						),
					),
				),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			const broken = fixture();
			Object.assign(broken.SaveGame.player, {
				mailReceived: { string: [{ opaque: true }] },
			});
			const invalid = yield* makeHistorySession(broken),
				original = yield* invalid.snapshot;
			expect(
				Result.isFailure(
					yield* Effect.result(
						invalid.transact(
							Effect.gen(function* () {
								for (const row of readCommunity(broken).bundles.filter(
									(row) => row.room === 1,
								))
									yield* setCommunityProgress({
										type: "bundle",
										bundleKey: row.key,
										value: true,
									});
							}),
						),
					),
				),
			).toBe(true);
			expect(yield* invalid.snapshot).toEqual(original);
		}),
	));
it("does not create or normalize progression on unrelated raw edits, and preserves reserved progress flags", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			const spring = required(
				inspectCommunity(document).progress.entries.find(
					(row) => progressId(row) === 13,
				),
			);
			required(submissionFlags(spring)).push(true, false);
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: "Crafts Room/13",
					value: true,
				}),
			);
			const after = yield* session.snapshot;
			expect(
				required(
					submissionFlags(
						required(
							inspectCommunity(after.document).progress.entries.find(
								(row) => progressId(row) === 13,
							),
						),
					),
				).slice(-2),
			).toEqual([true, false]);
			const beforeRaw = yield* session.snapshot;
			yield* session.transact(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft,
						snapshot = yield* draft.read;
					snapshot.state.document.SaveGame.player.money += 1;
					yield* draft.replace(snapshot);
				}),
			);
			expect(
				inspectCommunity((yield* session.snapshot).document).center,
			).toEqual(inspectCommunity(beforeRaw.document).center);
		}),
	));

it.each(["BAD 388 1", "O 388 2147483648"])(
	"never makes unsafe reward %s claimable",
	(reward) =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					data = inspectCommunity(document);
				const entry = data.definitions.entries.find(
					(row) =>
						record(row) &&
						record(row.key) &&
						row.key.string === "Crafts Room/13",
				);
				if (
					!record(entry) ||
					!record(entry.value) ||
					typeof entry.value.string !== "string"
				)
					throw new Error("Missing Spring bundle definition");
				const parts = entry.value.string.split("/");
				parts[1] = reward;
				entry.value.string = parts.join("/");
				const session = yield* makeHistorySession(document),
					before = yield* session.snapshot;
				expect(
					readCommunity(document).bundles.find((row) => row.id === 13)
						?.rewardSupported,
				).toBe(false);
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(
								setCommunityProgress({
									type: "bundle",
									bundleKey: "Crafts Room/13",
									value: true,
								}),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		),
);
it("keeps unclaimed cabin placeholders byte-equivalent through membership and project completion", () =>
	run(
		Effect.gen(function* () {
			const document = fixture(),
				ghost = structuredClone(document.SaveGame.player);
			Object.assign(ghost, {
				name: "",
				UniqueMultiplayerID: "0",
				mailReceived: { unknown: "retain" },
				previousActiveDialogueEvents: { opaque: true },
			});
			document.SaveGame.farmhands = { Farmer: [ghost] };
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setCommunityProgress({ type: "membership", value: true }),
			);
			yield* session.transact(
				setCommunityProgress({ type: "project", room: 1, value: true }),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.farmhands).toEqual({ Farmer: [ghost] });
		}),
	));
it("uses internal names without a localized tail and distinguishes category requirements from Vault gold", () => {
	const document = fixture(),
		data = inspectCommunity(document);
	const entry = data.definitions.entries.find(
		(row) =>
			record(row) && record(row.key) && row.key.string === "Crafts Room/13",
	);
	if (!record(entry) || !record(entry.value))
		throw new Error("Missing Spring bundle definition");
	entry.value.string = "Remixed Eggs/O 388 1/-5 1 0 18 1 0 20 1 0 22 1 0/0/4";
	const view = readCommunity(document),
		bundle = required(view.bundles.find((row) => row.id === 13));
	expect(bundle.name).toBe("Remixed Eggs");
	expect(bundle.requirements[0]).toMatchObject({
		itemId: "-5",
		currency: false,
	});
	expect(
		view.bundles
			.filter((row) => row.room === 4)
			.every((row) => row.requirements.every((item) => item.currency)),
	).toBe(true);
});
