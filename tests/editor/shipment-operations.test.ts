import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readProgress } from "../../src/lib/editor/progress-data.ts";
import { setCropShipment } from "../../src/lib/editor/shipment-operations.ts";
import {
	exportDocument,
	parser,
	tinyFixture,
} from "../helpers/editor-document.ts";

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
				setCropShipment({ farmerId: "1", itemId: "24", count: 15 }),
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
				setCropShipment({ farmerId: "1", itemId: "24", count: 15 }),
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
