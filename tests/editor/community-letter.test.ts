import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { farmers } from "../../src/lib/editor/domain";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	readCommunity,
	inspectCommunity,
	progressId,
} from "../../src/lib/editor/community-data";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { record } from "../../src/lib/editor/saved-collections";
import { parser, fixtureXml, exportDocument } from "./fixtures";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
function fixture() {
	const document = parser.parse(fixtureXml);
	// Start before Bulletin restoration while preserving every other room as loaded.
	const bulletin = readCommunity(document).bundles.filter(
		(row) => row.room === 5,
	);
	const ids = new Set(bulletin.map((row) => row.id));
	for (const entry of inspectCommunity(document).progress.entries) {
		if (
			ids.has(progressId(entry)) &&
			record(entry) &&
			record(entry.value) &&
			record(entry.value.ArrayOfBoolean)
		)
			entry.value.ArrayOfBoolean.boolean = bulletin
				.find((row) => row.id === progressId(entry))
				?.requirements.map(() => false);
	}
	Object.assign(document.SaveGame.player, {
		mailReceived: { string: [] },
		mailbox: { string: ["unrelated"], opaque: "retain" },
		mailForTomorrow: { string: [] },
	});
	return document;
}
const complete = (document: ReturnType<typeof fixture>) =>
	Effect.gen(function* () {
		for (const bundle of readCommunity(document).bundles.filter(
			(row) => row.room === 5,
		))
			yield* setCommunityProgress({
				type: "bundle",
				bundleKey: bundle.key,
				value: true,
			});
	});

it("delivers the Bulletin letter to named farmers, leaves friendship to the game, and round-trips Undo/Redo/XML", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			const guest = structuredClone(document.SaveGame.player);
			guest.name = "Guest";
			guest.UniqueMultiplayerID = "Guest";
			const empty = structuredClone(document.SaveGame.player);
			empty.name = "";
			empty.UniqueMultiplayerID = "Empty";
			document.SaveGame.farmhands = { Farmer: [guest, empty] };
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(complete(document));
			const after = yield* session.snapshot;
			for (const farmer of farmers(after.document).filter((row) => row.name)) {
				expect(farmer).toMatchObject({
					mailbox: {
						string: ["unrelated", "ccBulletinThankYou"],
						opaque: "retain",
					},
					mailReceived: {
						string: expect.not.arrayContaining([
							"ccBulletinThankYou",
							"ccBulletinThankYouReceived",
						]),
					},
				});
			}
			expect(after.document.SaveGame.farmhands).toMatchObject({
				Farmer: [expect.anything(), empty],
			});
			const reloaded = parser.parse(exportDocument(after.document));
			expect(reloaded.SaveGame.player).toMatchObject({
				mailbox: { string: ["unrelated", "ccBulletinThankYou"] },
			});
			expect(
				readCommunity(reloaded).rooms.find((row) => row.id === 5)?.completed,
			).toBe(true);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
			const bundle = readCommunity(after.document).bundles.find(
				(row) => row.room === 5,
			);
			if (!bundle) throw new Error("Missing bundle");
			yield* session.transact(
				setCommunityProgress({
					type: "bundle",
					bundleKey: bundle.key,
					value: false,
				}),
			);
			expect((yield* session.snapshot).document.SaveGame.player).toMatchObject({
				mailbox: { string: ["unrelated"] },
			});
		}),
	));

it.each([
	["mailReceived", "ccBulletinThankYou"],
	["mailReceived", "ccBulletinThankYouReceived"],
	["mailbox", "ccBulletinThankYou"],
	["mailForTomorrow", "ccBulletinThankYou%&NL&%"],
	["mailForTomorrow", "ccBulletinThankYouReceived%&NL&%"],
])("does not replay a delivered or received letter (%s / %s)", (field, flag) =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, { [field]: { string: [flag] } });
			const session = yield* makeHistorySession(document);
			yield* session.transact(complete(document));
			const player = (yield* session.snapshot).document.SaveGame.player;
			expect(player).toMatchObject({
				[field]: { string: expect.arrayContaining([flag]) },
			});
			if (field !== "mailbox")
				expect(player).toMatchObject({ mailbox: { string: ["unrelated"] } });
		}),
	),
);

it("rejects unsupported pending mail without partial room or reward changes", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				mailbox: { string: [{ opaque: true }] },
			});
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			expect(
				Result.isFailure(
					yield* Effect.result(session.transact(complete(document))),
				),
			).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
	));

it("populates an explicitly nil mailbox with a decodable letter container", () =>
	run(
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				mailbox: { "@_xsi:nil": true, opaque: "retain" },
				mailReceived: { "@_xsi:nil": true },
			});
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setCommunityProgress({ type: "room", room: 5, value: true }),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player).toMatchObject({
				mailbox: { string: ["ccBulletinThankYou"], opaque: "retain" },
			});
			const reloaded = parser.parse(exportDocument(after.document));
			expect(reloaded.SaveGame.player).toMatchObject({
				mailbox: { string: ["ccBulletinThankYou"] },
				mailReceived: { string: ["ccBulletin"] },
			});
			const mailbox = record(after.document.SaveGame.player)
				? after.document.SaveGame.player.mailbox
				: undefined;
			expect(mailbox).not.toHaveProperty("@_xsi:nil");
		}),
	));
