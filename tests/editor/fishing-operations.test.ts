import { it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { expect } from "vitest";

import {
	readFishing,
	setFishCount,
} from "../../src/lib/editor/fishing-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readProgress } from "../../src/lib/editor/progress-data.ts";
import { requireDefined } from "../helpers/assertions.ts";
import {
	exportDocument,
	parser,
	tinyFixture,
} from "../helpers/editor-document.ts";

it.effect(
	"changes a farmhand count while preserving sizes, opaque records and rewards through history and XML",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			const guest = requireDefined(document.SaveGame.farmhands[0]);
			guest.fishCaught = [
				{ key: "(O)128", value: [4, 31], mod: "keep" },
				{ key: "(O)Mod.Fish", value: [7, 99, 123] },
			];
			guest.achievements = [24];
			guest.mailForTomorrow = ["CF_Fish"];
			guest.stats = { Values: [{ key: "fishCaught", value: 456 }] };
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			yield* session.transact(
				setFishCount({ farmerId: "2", itemId: "128", count: 100 }),
			);
			const after = yield* session.snapshot;
			const expected = structuredClone(before.document);
			requireDefined(
				requireDefined(expected.SaveGame.farmhands[0]).fishCaught?.[0],
			).value[0] = 100;
			expect(after.document).toEqual(expected);
			expect(parser.parse(exportDocument(after.document))).toEqual(
				parser.parse(exportDocument(expected)),
			);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
);

it.effect(
	"adds and removes membership evidence without granting awards or mail",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.fishCaught = [];
			document.SaveGame.player.achievements = [];
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setFishCount({ farmerId: "1", itemId: "128", count: 100 }),
			);
			const added = (yield* session.snapshot).document;
			expect(added.SaveGame.player.fishCaught).toEqual([
				{ key: "(O)128", value: [100, 0] },
			]);
			const progress = requireDefined(
				readProgress(parser.parse(exportDocument(added))).farmers[0],
			);
			expect(
				progress.categories.find((row) => row.id === "fishing")?.completed,
			).toBe(1);
			expect(progress.achievements.find((row) => row.id === 27)).toMatchObject({
				value: 100,
				recorded: false,
			});
			expect(added.SaveGame.player.mailForTomorrow).toBeUndefined();
			yield* session.transact(
				setFishCount({ farmerId: "1", itemId: "128", count: 0 }),
			);
			expect(
				(yield* session.snapshot).document.SaveGame.player.fishCaught,
			).toEqual([]);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(added);
		}),
);

it.effect(
	"rejects unsupported targets and counts atomically, retaining redo",
	() =>
		Effect.gen(function* () {
			// Invalid input must preserve the redo branch; unreadable representations
			// use their own baseline and must fail without normalizing saved data.
			for (const problem of [
				"missing",
				"duplicate",
				"shape",
				"negative",
				"owner",
				"unknown",
				"fraction",
				"overflow",
			] as const) {
				const document = tinyFixture();
				document.SaveGame.player.fishCaught = [];
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setFishCount({ farmerId: "1", itemId: "128", count: 1 }),
				);
				yield* session.undo;
				// Use the initial document for malformed cases in a separate session; the
				// history checks below still apply to validation failures on the valid one.
				const malformed = tinyFixture();
				malformed.SaveGame.player.fishCaught =
					problem === "duplicate"
						? [
								{ key: "(O)128", value: [1, 1] },
								{ key: "(O)128", value: [2, 2] },
							]
						: [
								{
									key: "(O)128",
									value: problem === "negative" ? [1, -1] : [1],
								},
							];
				if (problem === "missing") delete malformed.SaveGame.player.fishCaught;
				if (problem === "owner")
					requireDefined(malformed.SaveGame.farmhands[0]).UniqueMultiplayerID =
						1n;
				const target = [
					"missing",
					"duplicate",
					"shape",
					"negative",
					"owner",
				].includes(problem)
					? yield* makeHistorySession(malformed)
					: session;
				const before = yield* target.snapshot;
				const result = yield* Effect.exit(
					target.transact(
						setFishCount({
							farmerId: "1",
							itemId: problem === "unknown" ? "Mod.Fish" : "128",
							count:
								problem === "fraction"
									? 1.5
									: problem === "overflow"
										? 2147483648
										: 2,
						}),
					),
				);
				expect(Exit.isFailure(result)).toBe(true);
				expect(yield* target.snapshot).toEqual(before);
			}
		}),
);

it.effect(
	"removes imported zero-count membership and ignores absent-zero and unchanged edits",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.fishCaught = [{ key: "(O)128", value: [0, 20] }];
			expect(
				readFishing(document.SaveGame.player).find((row) => row.id === "128"),
			).toMatchObject({ count: 0, size: 20, reason: undefined });
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setFishCount({ farmerId: "1", itemId: "128", count: 0 }),
			);
			const removed = yield* session.snapshot;
			expect(removed.document.SaveGame.player.fishCaught).toEqual([]);
			yield* session.transact(
				setFishCount({ farmerId: "1", itemId: "128", count: 0 }),
			);
			expect(yield* session.snapshot).toEqual(removed);
		}),
);
