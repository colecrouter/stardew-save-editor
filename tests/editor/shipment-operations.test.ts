import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { setCropShipment } from "../../src/lib/editor/shipment-operations.ts";
import { tinyFixture } from "../helpers/editor-document.ts";

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
