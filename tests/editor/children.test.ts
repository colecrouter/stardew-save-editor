import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { Effect, Result } from "effect";
import {
	readChildren,
	inspectResidents,
} from "../../src/lib/editor/children-data.ts";
import { renameChild } from "../../src/lib/editor/children-operations.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { farmers } from "../../src/lib/editor/domain.ts";
import { projectReview } from "../../src/lib/editor/review-projection.ts";
import { exportDocument, parser } from "../helpers/editor-document.ts";
import { childrenFixture, renameRequest } from "./children-fixture.ts";

describe("existing child renaming", () => {
	it("discovers both homes and saved parents without changing the document", () => {
		const document = childrenFixture(),
			before = structuredClone(document);
		expect(readChildren(document)).toMatchObject([
			{
				name: "Juniper",
				parentId: "1",
				home: "FarmHouse",
				daysOld: 64,
				supported: true,
			},
			{ name: "Rowan", parentId: "2", home: "Cabin_guest", supported: true },
		]);
		expect(document).toEqual(before);
	});
	it("distinguishes absent hats from unknown saved hats and respects saved hair mode", () => {
		const document = childrenFixture();
		const child = inspectResidents(document)[0]!.resident;
		// Absence is an empty equipment slot, never an unknown item to draw.
		for (const hat of [undefined, null]) {
			child.hat = hat;
			expect(readChildren(document)[0]?.hat).toEqual({
				present: false,
				name: "No hat",
			});
		}
		child.hat = { $type: "StardewValley.Objects.Hat", itemId: "mod/unknown" };
		expect(readChildren(document)[0]?.hat).toMatchObject({
			present: true,
			name: "Unknown hat",
		});
		// Saved runtime hair flags take precedence over the catalog fallback.
		child.hat = {
			$type: "StardewValley.Objects.Hat",
			itemId: "0",
			hairDrawType: 2,
		};
		expect(readChildren(document)[0]?.hat.hideHair).toBe(true);
		child.hat = {
			$type: "StardewValley.Objects.Hat",
			itemId: "0",
			hairDrawType: 0,
		};
		expect(readChildren(document)[0]?.hat.hideHair).toBe(false);
	});
	it.effect(
		"moves every farmer's references atomically, preserves other data, and round trips history/XML",
		() =>
			Effect.gen(function* () {
				const before = childrenFixture();
				const expected = structuredClone(before);
				const resident = inspectResidents(expected)[0];
				if (!resident) throw Error("Missing resident");
				resident.resident.name = "Hazel";
				for (const farmer of farmers(expected))
					for (const dictionary of [farmer.friendshipData, farmer.giftedItems])
						for (const entry of dictionary ?? [])
							if (entry.key === "Juniper") entry.key = "Hazel";
				const session = yield* makeHistorySession(before);
				yield* session.transact(renameChild(renameRequest(before)));
				const after = yield* session.snapshot;
				expect(after.document).toEqual(expected);
				expect(after.entries).toHaveLength(1);
				expect(parser.parse(exportDocument(after.document))).toEqual(expected);
				expect(
					projectReview(after).groups.flatMap((group) => group.changes),
				).toContainEqual(
					expect.objectContaining({
						label: "Child · Child name",
						before: "Juniper",
						after: "Hazel",
					}),
				);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(expected);
			}),
		30000,
	);
	it.effect.each([
		"",
		"   ",
		" Hazel",
		"Hazel ",
		"Ha\nzel",
		"Abigail",
		"Rowan",
		"Bouncer",
	])("rejects invalid or occupied name %j without publishing", (newName) =>
		Effect.gen(function* () {
			const before = childrenFixture();
			const session = yield* makeHistorySession(before);
			const result = yield* session
				.transact(renameChild(renameRequest(before, newName)))
				.pipe(Effect.result);
			expect(Result.isFailure(result)).toBe(true);
			const after = yield* session.snapshot;
			expect(after.document).toEqual(before);
			expect(after.entries).toHaveLength(0);
		}),
	);
	it.effect(
		"rejects destination progress belonging to a farmer even when no resident has that name",
		() =>
			Effect.gen(function* () {
				const before = childrenFixture();
				before.SaveGame.farmhands[0]?.friendshipData?.push({
					key: "Hazel",
					value: { Points: 999 },
				});
				const session = yield* makeHistorySession(before);
				expect(
					Result.isFailure(
						yield* session
							.transact(renameChild(renameRequest(before)))
							.pipe(Effect.result),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before);
			}),
	);
	it.each([
		"duplicate child",
		"missing parent",
		"duplicate parent",
		"duplicate friendship",
		"custom class",
	])("keeps %s read-only", (kind) => {
		const document = childrenFixture();
		const child = inspectResidents(document)[0]?.resident;
		if (!child) throw Error("Missing resident");
		if (kind === "duplicate child") {
			const other = inspectResidents(document)[1]?.resident;
			if (other) other.name = child.name;
		} else if (kind === "missing parent") child.idOfParent = 999n;
		else if (kind === "duplicate parent")
			document.SaveGame.farmhands[0]!.UniqueMultiplayerID = 1n;
		else if (kind === "duplicate friendship")
			document.SaveGame.player.friendshipData?.push({
				key: "Juniper",
				value: { Points: 99 },
			});
		else {
			child.$type = "$unknown";
			child.$xmlType = { name: "Child", namespace: "urn:example" };
		}
		expect(readChildren(document)[0]?.supported).toBe(false);
	});
	it.effect(
		"does not create missing relationships and accepts exact XML text",
		() =>
			Effect.gen(function* () {
				const document = childrenFixture();
				for (const farmer of farmers(document)) {
					delete farmer.friendshipData;
					delete farmer.giftedItems;
				}
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					renameChild(renameRequest(document, "A&B <C>")),
				);
				const after = (yield* session.snapshot).document;
				expect(readChildren(parser.parse(exportDocument(after)))[0]?.name).toBe(
					"A&B <C>",
				);
				expect(
					farmers(after).every(
						(farmer) =>
							farmer.friendshipData === undefined &&
							farmer.giftedItems === undefined,
					),
				).toBe(true);
			}),
	);
	it.effect(
		"rejects a captured target after a rename and preserves the successful history entry",
		() =>
			Effect.gen(function* () {
				const document = childrenFixture(),
					request = renameRequest(document);
				const session = yield* makeHistorySession(document);
				yield* session.transact(renameChild(request));
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* session
							.transact(renameChild({ ...request, newName: "Willow" }))
							.pipe(Effect.result),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before.document);
				expect((yield* session.snapshot).entries).toHaveLength(1);
			}),
	);
});
