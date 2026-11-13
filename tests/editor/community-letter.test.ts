import { it } from "@effect/vitest";
import { expect } from "vitest";
import { Effect, Result } from "effect";
import { farmers } from "../../src/lib/editor/domain";
import { makeHistorySession } from "../../src/lib/editor/history";
import {
	readCommunity,
	inspectCommunity,
	progressId,
} from "../../src/lib/editor/community-data";
import { setCommunityProgress } from "../../src/lib/editor/community-operations";
import { record } from "../../src/lib/editor/plain-data";
import { parser, fixtureXml, exportDocument } from "./fixtures";

function fixture() {
	const document = parser.parse(fixtureXml);
	// Start before Bulletin restoration while preserving every other room as loaded.
	const bulletin = readCommunity(document).bundles.filter(
		(row) => row.room === 5,
	);
	const ids = new Set(bulletin.map((row) => row.id));
	for (const entry of inspectCommunity(document).progress.entries) {
		// Reset only Bulletin rows in the decoded plain boolean arrays.
		if (ids.has(progressId(entry))) {
			const bundle = bulletin.find((row) => row.id === progressId(entry));
			if (!bundle) throw Error("Missing Bulletin fixture bundle");
			entry.value = bundle.requirements.map(() => false);
		}
	}
	Object.assign(document.SaveGame.player, {
		mailReceived: [],
		mailbox: ["unrelated"],
		testMetadatamailbox: { opaque: "retain" },
		mailForTomorrow: [],
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

it.effect(
	"delivers the Bulletin letter to named farmers, leaves friendship to the game, and round-trips Undo/Redo/XML",
	() =>
		Effect.gen(function* () {
			const document = fixture();
			const guest = structuredClone(document.SaveGame.player);
			guest.name = "Guest";
			guest.UniqueMultiplayerID = 2n;
			const empty = structuredClone(document.SaveGame.player);
			empty.name = "";
			empty.UniqueMultiplayerID = 3n;
			document.SaveGame.farmhands = [guest, empty];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(complete(document));
			const after = yield* session.snapshot;
			for (const farmer of farmers(after.document).filter((row) => row.name)) {
				expect(farmer).toMatchObject({
					mailbox: ["unrelated", "ccBulletinThankYou"],
					testMetadatamailbox: { opaque: "retain" },
					mailReceived: expect.not.arrayContaining([
						"ccBulletinThankYou",
						"ccBulletinThankYouReceived",
					]),
				});
			}
			expect(after.document.SaveGame.farmhands).toMatchObject([
				expect.anything(),
				empty,
			]);
			const reloaded = parser.parse(exportDocument(after.document));
			expect(reloaded.SaveGame.player).toMatchObject({
				mailbox: ["unrelated", "ccBulletinThankYou"],
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
				mailbox: ["unrelated"],
			});
		}),
	30_000,
);

it.effect.each([
	["mailReceived", "ccBulletinThankYou"],
	["mailReceived", "ccBulletinThankYouReceived"],
	["mailbox", "ccBulletinThankYou"],
	["mailForTomorrow", "ccBulletinThankYou%&NL&%"],
	["mailForTomorrow", "ccBulletinThankYouReceived%&NL&%"],
] as const)(
	"does not replay a delivered or received letter (%s / %s)",
	([field, flag]) =>
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, { [field]: [flag] });
			const session = yield* makeHistorySession(document);
			yield* session.transact(complete(document));
			const player = (yield* session.snapshot).document.SaveGame.player;
			expect(player).toMatchObject({
				[field]: expect.arrayContaining([flag]),
			});
			if (field !== "mailbox")
				expect(player).toMatchObject({ mailbox: ["unrelated"] });
		}),
);

it.effect(
	"rejects unsupported pending mail without partial room or reward changes",
	() =>
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				mailbox: [{ opaque: true }],
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
);

it.effect(
	"populates an empty mailbox with a decodable letter list",
	() =>
		Effect.gen(function* () {
			const document = fixture();
			Object.assign(document.SaveGame.player, {
				mailbox: [],
				testMetadatamailbox: { opaque: "retain" },
				mailReceived: [],
			});
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setCommunityProgress({ type: "room", room: 5, value: true }),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player).toMatchObject({
				mailbox: ["ccBulletinThankYou"],
				testMetadatamailbox: { opaque: "retain" },
			});
			const reloaded = parser.parse(exportDocument(after.document));
			expect(reloaded.SaveGame.player).toMatchObject({
				mailbox: ["ccBulletinThankYou"],
				mailReceived: ["ccBulletin"],
			});
			const mailbox = record(after.document.SaveGame.player)
				? after.document.SaveGame.player.mailbox
				: undefined;
			expect(mailbox).not.toHaveProperty("@_xsi:nil");
		}),
	30_000,
);
