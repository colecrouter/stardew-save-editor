import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	readCommunity,
	inspectCommunity,
	progressId,
	submissionFlags,
	type CommunityBundleView,
} from "../../src/lib/editor/community-data";
import {
	setCommunityRequirements,
	type CommunityRequirementsEdit,
} from "../../src/lib/editor/community-requirements";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { record } from "../../src/lib/editor/saved-collections";
import { parser, fixtureXml, exportDocument } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const required = <T>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};
function edit(bundle: CommunityBundleView) {
	return {
		bundleKey: bundle.key,
		expected: {
			needed: bundle.needed,
			requirements: bundle.requirements.map(
				({ itemId, quantity, quality, submitted }) => ({
					itemId,
					quantity,
					quality,
					submitted,
				}),
			),
		},
		needed: bundle.needed,
		requirements: bundle.requirements.map(
			({ itemId, quantity, quality }, sourceIndex) => ({
				itemId,
				quantity,
				quality,
				sourceIndex,
			}),
		),
	} satisfies CommunityRequirementsEdit;
}

it("edits a coordinated definition preserving donation credit, reward, opaque tail and exact Undo/Redo/XML", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(fixtureXml);
			const bundle = required(
				readCommunity(document).bundles.find((row) => row.id === 13),
			);
			const definition = required(
				inspectCommunity(document).definitions.entries.find(
					(row) =>
						record(row) && record(row.key) && row.key.string === bundle.key,
				),
			);
			if (!record(definition) || !record(definition.value))
				throw new Error("Missing definition");
			definition.value.string += "/opaque-tail";
			definition.opaque = { keep: "007" };
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const request = edit(
				required(
					readCommunity(before.document).bundles.find((row) => row.id === 13),
				),
			);
			required(request.requirements[0]).itemId = "(O)24";
			required(request.requirements[0]).quantity = 3;
			required(request.requirements[0]).quality = 2;
			yield* session.transact(setCommunityRequirements(request));
			const after = yield* session.snapshot;
			expect(
				readCommunity(after.document).bundles.find((row) => row.id === 13)
					?.requirements[0],
			).toMatchObject({
				itemId: "(O)24",
				quantity: 3,
				quality: 2,
				submitted: required(bundle.requirements[0]).submitted,
			});
			const changed = inspectCommunity(after.document).definitions.entries.find(
				(row) =>
					record(row) && record(row.key) && row.key.string === bundle.key,
			);
			expect(changed).toMatchObject({
				opaque: { keep: "007" },
				value: { string: expect.stringContaining("/opaque-tail") },
			});
			expect(inspectCommunity(after.document).rewards.entries).toEqual(
				inspectCommunity(before.document).rewards.entries,
			);
			expect(inspectCommunity(after.document).progress.entries).toEqual(
				inspectCommunity(before.document).progress.entries,
			);
			expect(
				readCommunity(
					parser.parse(exportDocument(after.document)),
				).bundles.find((row) => row.id === 13)?.requirements,
			).toEqual(
				readCommunity(after.document).bundles.find((row) => row.id === 13)
					?.requirements,
			);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
	));

it("keeps source-row donations when removing requirements and sizes structural slots to the game layout", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(fixtureXml);
			const progress = required(
				inspectCommunity(document).progress.entries.find(
					(row) => progressId(row) === 13,
				),
			);
			if (
				!record(progress) ||
				!record(progress.value) ||
				!record(progress.value.ArrayOfBoolean)
			)
				throw new Error("Missing progress");
			progress.value.ArrayOfBoolean.boolean = [
				true,
				false,
				false,
				false,
				...Array(8).fill(false),
			];
			const session = yield* makeHistorySession(document);
			const request = edit(
				required(
					readCommunity((yield* session.snapshot).document).bundles.find(
						(row) => row.id === 13,
					),
				),
			);
			request.requirements.splice(1, 1);
			request.needed = 3;
			yield* session.transact(setCommunityRequirements(request));
			const after = yield* session.snapshot;
			const result = required(
				readCommunity(after.document).bundles.find((row) => row.id === 13),
			);
			expect(result.requirements.map((row) => row.submitted)).toEqual([
				true,
				false,
				false,
			]);
			expect(
				submissionFlags(
					inspectCommunity(after.document).progress.entries.find(
						(row) => progressId(row) === 13,
					),
				),
			).toEqual([true, false, false, false, false, false, false, false, false]);
			expect(result.completed).toBe(false);
		}),
	));

it("rejects completion-changing drafts and stale donation state without partial writes", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(parser.parse(fixtureXml));
			const bundle = required(
				readCommunity((yield* session.snapshot).document).bundles.find(
					(row) => row.id === 13,
				),
			);
			const stale = edit(bundle);
			const first = required(bundle.requirements[0]);
			yield* session.transact(
				setCommunityProgress({
					type: "donation",
					bundleKey: bundle.key,
					index: 0,
					itemId: first.itemId,
					quantity: first.quantity,
					quality: first.quality,
					value: !first.submitted,
				}),
			);
			const before = yield* session.snapshot;
			const staleResult = yield* Effect.result(
				session.transact(setCommunityRequirements(stale)),
			);
			expect(Result.isFailure(staleResult)).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before.document);
			const completion = edit(
				required(
					readCommunity(before.document).bundles.find((row) => row.id === 13),
				),
			);
			completion.needed = 1;
			const result = yield* Effect.result(
				session.transact(setCommunityRequirements(completion)),
			);
			expect(Result.isFailure(result)).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("retains unknown imported IDs but rejects new unknown IDs and impossible quality", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(fixtureXml);
			const definition = required(
				inspectCommunity(document).definitions.entries.find(
					(row) =>
						record(row) &&
						record(row.key) &&
						row.key.string === "Crafts Room/13",
				),
			);
			if (
				!record(definition) ||
				!record(definition.value) ||
				typeof definition.value.string !== "string"
			)
				throw new Error("Missing definition");
			const parts = definition.value.string.split("/");
			const tokens = required(parts[2]).split(" ");
			tokens[0] = "ModdedSeed";
			tokens[1] = "1001";
			parts[2] = tokens.join(" ");
			definition.value.string = parts.join("/");
			const session = yield* makeHistorySession(document);
			const retained = edit(
				required(
					readCommunity((yield* session.snapshot).document).bundles.find(
						(row) => row.id === 13,
					),
				),
			);
			// Editing another row must not normalize an imported modded amount.
			required(retained.requirements[1]).quantity += 1;
			yield* session.transact(setCommunityRequirements(retained));
			expect(
				readCommunity((yield* session.snapshot).document).bundles.find(
					(row) => row.id === 13,
				)?.requirements[0],
			).toMatchObject({ itemId: "ModdedSeed", quantity: 1001 });
			const request = edit(
				required(
					readCommunity((yield* session.snapshot).document).bundles.find(
						(row) => row.id === 13,
					),
				),
			);
			required(request.requirements[0]).quantity = 7;
			yield* session.transact(setCommunityRequirements(request));
			const before = yield* session.snapshot;
			for (const [itemId, quality] of [
				["DifferentModdedSeed", 0],
				["390", 4],
			] as const) {
				const rejected = edit(
					required(
						readCommunity(before.document).bundles.find((row) => row.id === 13),
					),
				);
				required(rejected.requirements[0]).itemId = itemId;
				required(rejected.requirements[0]).quality = quality;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(setCommunityRequirements(rejected)),
						),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before.document);
			}
		}),
	));

it("updates a Vault price's dual quantity/quality encoding while preserving every other requirement", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(parser.parse(fixtureXml));
			const bundle = required(
				readCommunity((yield* session.snapshot).document).bundles.find(
					(row) => row.room === 4,
				),
			);
			const request = edit(bundle);
			const last = required(request.requirements.at(-1));
			const prior = required(bundle.requirements.at(-1));
			last.quantity = 12345;
			if (prior.quality === prior.quantity) last.quality = last.quantity;
			yield* session.transact(setCommunityRequirements(request));
			expect(
				readCommunity((yield* session.snapshot).document)
					.bundles.find((row) => row.key === bundle.key)
					?.requirements.at(-1),
			).toMatchObject({ quantity: 12345, quality: last.quality });
		}),
	));

it("adds a known category to a completed bundle as satisfied without changing reward or restoration", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(parser.parse(fixtureXml));
			const initial = required(
				readCommunity((yield* session.snapshot).document).bundles.find(
					(row) => row.id === 13,
				),
			);
			yield* session.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: initial.key,
					value: true,
				}),
			);
			const before = yield* session.snapshot;
			const bundle = required(
				readCommunity(before.document).bundles.find((row) => row.id === 13),
			);
			const request: CommunityRequirementsEdit = {
				...edit(bundle),
				requirements: [
					...edit(bundle).requirements,
					{ itemId: "-5", quantity: 5, quality: 2 },
				],
				needed: bundle.needed,
			};
			yield* session.transact(setCommunityRequirements(request));
			const after = yield* session.snapshot;
			expect(
				readCommunity(after.document)
					.bundles.find((row) => row.id === 13)
					?.requirements.at(-1),
			).toMatchObject({
				itemId: "-5",
				quantity: 5,
				quality: 2,
				submitted: true,
			});
			expect(
				readCommunity(after.document).bundles.find((row) => row.id === 13)
					?.completed,
			).toBe(true);
			expect(inspectCommunity(after.document).rewards.entries).toEqual(
				inspectCommunity(before.document).rewards.entries,
			);
			expect(after.document.SaveGame.player).toEqual(
				before.document.SaveGame.player,
			);
		}),
	));

it("does not truncate unfamiliar surplus donation slots during a structural edit", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(fixtureXml);
			const progress = inspectCommunity(document).progress.entries.find(
				(row) => progressId(row) === 13,
			);
			if (
				!record(progress) ||
				!record(progress.value) ||
				!record(progress.value.ArrayOfBoolean)
			)
				throw new Error("Missing progress");
			progress.value.ArrayOfBoolean.boolean = Array(13).fill(false);
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			const bundle = required(
				readCommunity(before.document).bundles.find((row) => row.id === 13),
			);
			const request: CommunityRequirementsEdit = {
				...edit(bundle),
				requirements: [
					...edit(bundle).requirements,
					{ itemId: "390", quantity: 5, quality: 0 },
				],
			};
			expect(
				Result.isFailure(
					yield* Effect.result(
						session.transact(setCommunityRequirements(request)),
					),
				),
			).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("retains an implicit donation count after adding a requirement and exporting", () =>
	run(
		Effect.gen(function* () {
			const document = parser.parse(fixtureXml);
			const definition = inspectCommunity(document).definitions.entries.find(
				(row) =>
					record(row) && record(row.key) && row.key.string === "Crafts Room/13",
			);
			if (
				!record(definition) ||
				!record(definition.value) ||
				typeof definition.value.string !== "string"
			)
				throw new Error("Missing definition");
			const parts = definition.value.string.split("/");
			parts[4] = "";
			definition.value.string = parts.join("/");
			const session = yield* makeHistorySession(document);
			const bundle = required(
				readCommunity((yield* session.snapshot).document).bundles.find(
					(row) => row.id === 13,
				),
			);
			const request: CommunityRequirementsEdit = {
				...edit(bundle),
				requirements: [
					...edit(bundle).requirements,
					{ itemId: "390", quantity: 1, quality: 0 },
				],
			};
			yield* session.transact(setCommunityRequirements(request));
			const after = yield* session.snapshot;
			for (const version of [
				after.document,
				parser.parse(exportDocument(after.document)),
			]) {
				const changed = required(
					readCommunity(version).bundles.find((row) => row.id === 13),
				);
				expect(changed.requirements.length).toBe(
					bundle.requirements.length + 1,
				);
				expect(changed.needed).toBe(bundle.needed);
				expect(changed.completed).toBe(bundle.completed);
			}
		}),
	));

it("completes/reopens a whole room in one history entry and rolls back unsupported rows", () =>
	run(
		Effect.gen(function* () {
			const session = yield* makeHistorySession(parser.parse(fixtureXml));
			const before = yield* session.snapshot;
			yield* session.transact(
				setCommunityProgress({ type: "room", room: 1, value: true }),
			);
			const after = yield* session.snapshot;
			expect(
				readCommunity(after.document)
					.bundles.filter((row) => row.room === 1)
					.every((row) => row.completed),
			).toBe(true);
			expect(
				readCommunity(after.document).rooms.find((row) => row.id === 1)
					?.restored,
			).toBe(true);
			expect(after.entries.length).toBe(before.entries.length + 1);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
			yield* session.transact(
				setCommunityProgress({ type: "room", room: 1, value: false }),
			);
			const reopened = yield* session.snapshot;
			expect(
				readCommunity(reopened.document)
					.bundles.filter((row) => row.room === 1)
					.every((row) => !row.completed),
			).toBe(true);
			expect(
				readCommunity(reopened.document).rooms.find((row) => row.id === 1)
					?.restored,
			).toBe(false);
			const malformed = parser.parse(fixtureXml);
			const progress = inspectCommunity(malformed).progress.entries.find(
				(row) => progressId(row) === 13,
			);
			if (!record(progress) || !record(progress.value))
				throw new Error("Missing progress");
			progress.value.ArrayOfBoolean = { boolean: ["unsupported"] };
			const invalidSession = yield* makeHistorySession(malformed);
			const unchanged = yield* invalidSession.snapshot;
			expect(
				Result.isFailure(
					yield* Effect.result(
						invalidSession.transact(
							setCommunityProgress({ type: "room", room: 1, value: true }),
						),
					),
				),
			).toBe(true);
			expect((yield* invalidSession.snapshot).document).toEqual(
				unchanged.document,
			);
		}),
	));
