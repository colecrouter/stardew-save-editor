import { it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readProgress } from "../../src/lib/editor/progress-data.ts";
import {
	readOtherShipments,
	setShipment,
} from "../../src/lib/editor/shipment-operations.ts";
import {
	exportDocument,
	parser,
	tinyFixture,
} from "../helpers/editor-document.ts";

it.effect(
	"preserves outside-catalog shipments through an edit and XML round trip",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.basicShipped = [
				{ key: "128", value: 9 },
				{ key: "Mod.Crop", value: 11, mod: "keep" },
				{ key: "24", value: 0 },
				{ key: "Mod.Other", value: 13 },
			];
			const other = readOtherShipments(document.SaveGame.player);
			expect(other).toEqual([
				{ id: "128", count: 9 },
				{ id: "Mod.Crop", count: 11 },
				{ id: "Mod.Other", count: 13 },
			]);
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setShipment({ farmerId: "1", itemId: "24", count: 15 }),
			);
			const reimported = parser.parse(
				exportDocument((yield* session.snapshot).document),
			);
			expect(readOtherShipments(reimported.SaveGame.player)).toEqual(other);
			expect(reimported.SaveGame.player.basicShipped?.[1]).toMatchObject({
				mod: "keep",
			});
		}),
);

it.effect(
	"supports non-crop collection items and removes zero-count membership without touching awards",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.basicShipped = [
				{ key: "16", value: 0, mod: "keep" },
				{ key: "Mod.Crop", value: 8 },
			];
			document.SaveGame.player.achievements = [34];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;
			// Wild Horseradish belongs to Full Shipment, outside the former crop-only scope.
			yield* session.transact(
				setShipment({ farmerId: "1", itemId: "16", count: 2 }),
			);
			expect(
				(yield* session.snapshot).document.SaveGame.player.basicShipped?.[0],
			).toEqual({ key: "16", value: 2, mod: "keep" });
			yield* session.transact(
				setShipment({ farmerId: "1", itemId: "16", count: 0 }),
			);
			const removed = (yield* session.snapshot).document;
			expect(removed.SaveGame.player.basicShipped).toEqual([
				{ key: "Mod.Crop", value: 8 },
			]);
			expect(removed.SaveGame.player.achievements).toEqual([34]);
			expect(
				readProgress(parser.parse(exportDocument(removed)))
					.farmers[0]?.categories.find((row) => row.id === "shipping")
					?.requirements.find((row) => row.id === "16")?.status,
			).toBe("missing");
			yield* session.undo;
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
		}),
);

it.effect(
	"rejects duplicate shipping targets and invalid counts without changing history",
	() =>
		Effect.gen(function* () {
			for (const count of [-1, 1.5, 2147483648, 0]) {
				const document = tinyFixture();
				document.SaveGame.player.basicShipped = [
					{ key: "24", value: 1 },
					{ key: "24", value: 3 },
				];
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(
					Exit.isFailure(
						yield* Effect.exit(
							session.transact(
								setShipment({ farmerId: "1", itemId: "24", count }),
							),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}
		}),
);

it.effect(
	"changes one shipment count and restores the save through Undo and Redo",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			// Parsnip is a vanilla crop. The opaque member stands in for save data
			// that the editor must carry through an in-place count update.
			document.SaveGame.player.basicShipped = [
				{ key: "24", value: 1, mod: "keep" },
				{ key: "Mod.Crop", value: 8 },
			];
			const session = yield* makeHistorySession(document);
			const before = yield* session.snapshot;

			yield* session.transact(
				setShipment({ farmerId: "1", itemId: "24", count: 15 }),
			);
			const after = yield* session.snapshot;
			const expected = structuredClone(before.document);
			expected.SaveGame.player.basicShipped = [
				{ key: "24", value: 15, mod: "keep" },
				{ key: "Mod.Crop", value: 8 },
			];
			expect(after.document).toEqual(expected);
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
);

it.effect(
	"adds a crop record that updates both diagnostics after export and reimport",
	() =>
		Effect.gen(function* () {
			const document = tinyFixture();
			document.SaveGame.player.basicShipped = [];
			document.SaveGame.player.achievements = [];
			const session = yield* makeHistorySession(document);
			yield* session.transact(
				setShipment({ farmerId: "1", itemId: "24", count: 15 }),
			);
			const after = yield* session.snapshot;
			const reimported = parser.parse(exportDocument(after.document));
			const farmer = readProgress(reimported).farmers[0];

			// One new key gives Perfection credit, and a count of 15 contributes
			// toward Polyculture while the saved award list is still empty.
			expect(
				farmer?.categories
					.find((row) => row.id === "shipping")
					?.requirements.find((row) => row.id === "24")?.status,
			).toBe("complete");
			expect(farmer?.achievements.find((row) => row.id === 31)).toMatchObject({
				value: 1,
				recorded: false,
			});
		}),
);
