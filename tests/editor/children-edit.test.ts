import { it } from "@effect/vitest";
import { expect, vi } from "vitest";
import { Effect, Result } from "effect";
import {
	editChild,
	type ChildEdit,
} from "../../src/lib/editor/children-operations.ts";
import {
	inspectResidents,
	readChildren,
} from "../../src/lib/editor/children-data.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { farmers } from "../../src/lib/editor/domain.ts";
import { createCatalogItem } from "../../src/lib/editor/item-catalog.ts";
import { exportDocument, parser } from "../helpers/editor-document.ts";
import { childrenFixture, renameRequest } from "./children-fixture.ts";

it.effect("rejects equipping a catalog hat on an existing baby", () =>
	Effect.gen(function* () {
		const before = childrenFixture();
		Object.assign(inspectResidents(before)[0]!.resident, {
			age: 1,
			daysOld: 13,
			hat: null,
		});
		const session = yield* makeHistorySession(before);
		expect(
			Result.isFailure(
				yield* session
					.transact(
						editChild(
							request(before, { hat: { kind: "catalog", id: "Straw Hat" } }),
						),
					)
					.pipe(Effect.result),
			),
		).toBe(true);
		expect((yield* session.snapshot).document).toEqual(before);
	}),
);
function request(
	document = childrenFixture(),
	changes: ChildEdit["changes"] = {},
) {
	const { key, name, parentId } = renameRequest(document);
	return { key, name, parentId, changes };
}

it.effect(
	"reports a failed hat catalog import without publishing an edit",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture();
			const session = yield* makeHistorySession(before);
			// Reject the lazy module load itself, rather than a catalog factory call:
			// deployment/network failures must reach the expected-error channel.
			vi.doMock("../../src/lib/editor/item-catalog.ts", () => {
				throw new Error("Unavailable catalog chunk");
			});
			const result = yield* session
				.transact(
					editChild(
						request(before, {
							hat: { kind: "catalog", id: "Straw Hat" },
							gender: "Male",
						}),
					),
				)
				.pipe(Effect.result);
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result))
				expect(result.failure).toMatchObject({
					_tag: "ChildRenameInvalid",
					message: "The hat catalog could not be loaded. Please try again.",
				});
			expect((yield* session.snapshot).document).toEqual(before);
			expect((yield* session.snapshot).entries).toHaveLength(0);
		}).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					vi.doUnmock("../../src/lib/editor/item-catalog.ts");
				}),
			),
		),
);

it.effect.each([
	[1, 20, 22, true],
	[1, 20, 18, true],
	[1, 20, 27, true],
	[2, 40, 20, false],
	[3, 64, 20, false],
	[9, 64, 20, false],
] as const)(
	"checks crib dependency for saved stage %s, age %s to %s",
	([age, daysOld, nextDays, allowed]) =>
		Effect.gen(function* () {
			const before = childrenFixture();
			const target = inspectResidents(before)[0]!;
			target.home.cribStyle = 0;
			Object.assign(target.resident, { age, daysOld, hat: null });
			const session = yield* makeHistorySession(before);
			const result = yield* session
				.transact(editChild(request(before, { daysOld: nextDays })))
				.pipe(Effect.result);
			// Staying in/advancing from an existing young stage adds no dependency;
			// regression and unknown saved stages must still reject atomically.
			expect(Result.isSuccess(result)).toBe(allowed);
			const after = yield* session.snapshot;
			if (allowed)
				expect(readChildren(after.document)[0]?.daysOld).toBe(nextDays);
			else {
				expect(after.document).toEqual(before);
				expect(after.entries).toHaveLength(0);
			}
		}),
);

it.effect(
	"applies appearance, age, hat and linked rename as one exact reversible transaction",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture();
			const expected = structuredClone(before);
			const target = inspectResidents(expected)[0]!.resident;
			Object.assign(target, {
				name: "Hazel",
				gender: "Male",
				darkSkinned: false,
				daysOld: 80,
				age: 3,
				Speed: 4,
				hat: createCatalogItem("Cowboy Hat"),
			});
			for (const farmer of farmers(expected))
				for (const dictionary of [farmer.friendshipData, farmer.giftedItems])
					for (const entry of dictionary ?? [])
						if (entry.key === "Juniper") entry.key = "Hazel";
			const session = yield* makeHistorySession(before);
			yield* session.transact(
				editChild(
					request(before, {
						name: "Hazel",
						gender: "Male",
						darkSkinned: false,
						daysOld: 80,
						hat: { kind: "catalog", id: "Cowboy Hat" },
					}),
				),
			);
			const after = yield* session.snapshot;
			expect(after.document).toEqual(expected);
			expect(after.entries).toHaveLength(1);
			// New catalog items include legacy extension scalars. Their first XML decode
			// canonicalizes those extensions to text; saved edits and subsequent XML stay exact.
			const xml = exportDocument(after.document);
			const reparsed = parser.parse(xml);
			expect(reparsed).toEqual(parser.parse(exportDocument(expected)));
			expect(exportDocument(reparsed)).toBe(xml);
			expect(readChildren(reparsed)[0]).toMatchObject({
				name: "Hazel",
				gender: "Male",
				darkSkinned: false,
				daysOld: 80,
				stage: 3,
				hat: { name: "Cowboy Hat" },
			});
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(expected);
		}),
	30000,
);

it.effect.each([
	[0, 0],
	[12, 0],
	[13, 1],
	[26, 1],
	[27, 2],
	[54, 2],
	[55, 3],
	[100, 3],
])(
	"sets %i days to stage %i without overnight side effects",
	([daysOld, age]) =>
		Effect.gen(function* () {
			const before = childrenFixture(),
				expected = structuredClone(before);
			Object.assign(inspectResidents(expected)[0]!.resident, {
				daysOld,
				age,
				Speed: age === 3 ? 4 : 1,
				hat: null,
			});
			const session = yield* makeHistorySession(before);
			yield* session.transact(
				editChild(request(before, { daysOld, hat: { kind: "remove" } })),
			);
			expect((yield* session.snapshot).document).toEqual(expected);
		}),
);

it.effect.each([-1, 1.5, NaN, Infinity, 2147483647])(
	"rejects unsupported age %s atomically",
	(daysOld) =>
		Effect.gen(function* () {
			const before = childrenFixture(),
				session = yield* makeHistorySession(before);
			const result = yield* session
				.transact(editChild(request(before, { gender: "Male", daysOld })))
				.pipe(Effect.result);
			expect(Result.isFailure(result)).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before);
			expect((yield* session.snapshot).entries).toHaveLength(0);
		}),
);

it.effect(
	"requires explicit hat removal when making a hat-wearing toddler younger",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture(),
				session = yield* makeHistorySession(before);
			const result = yield* session
				.transact(editChild(request(before, { daysOld: 13 })))
				.pipe(Effect.result);
			expect(Result.isFailure(result)).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before);
		}),
);

it.effect(
	"rejects a missing crib and a non-hat catalog replacement without partial writes",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture();
			inspectResidents(before)[0]!.home.cribStyle = 0;
			const session = yield* makeHistorySession(before);
			for (const changes of [
				{ daysOld: 13, hat: { kind: "remove" as const } },
				{
					gender: "Male" as const,
					hat: { kind: "catalog" as const, id: "Wood" },
				},
			]) {
				expect(
					Result.isFailure(
						yield* session
							.transact(editChild(request(before, changes)))
							.pipe(Effect.result),
					),
				).toBe(true);
				expect((yield* session.snapshot).document).toEqual(before);
			}
		}),
);

it.effect(
	"rolls back staged appearance and age when a combined rename collides",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture(),
				session = yield* makeHistorySession(before);
			expect(
				Result.isFailure(
					yield* session
						.transact(
							editChild(
								request(before, { gender: "Male", daysOld: 80, name: "Rowan" }),
							),
						)
						.pipe(Effect.result),
				),
			).toBe(true);
			expect((yield* session.snapshot).document).toEqual(before);
			expect((yield* session.snapshot).entries).toHaveLength(0);
		}),
);

it.effect(
	"keeps opaque hat fields and unknown age unchanged during independent appearance edits",
	() =>
		Effect.gen(function* () {
			const before = childrenFixture();
			const child = inspectResidents(before)[0]!.resident;
			child.hat = {
				$type: "StardewValley.Objects.Hat",
				itemId: "custom_hat",
				opaque: "007",
				modData: [{ key: "test", value: "keep" }],
			};
			child.daysOld = -5;
			const expected = structuredClone(before);
			inspectResidents(expected)[0]!.resident.gender = "Male";
			const session = yield* makeHistorySession(before);
			yield* session.transact(editChild(request(before, { gender: "Male" })));
			expect((yield* session.snapshot).document).toEqual(expected);
			expect(
				readChildren((yield* session.snapshot).document)[0]?.hat.present,
			).toBe(true);
		}),
);

it.effect("does not publish a no-op or consume redo", () =>
	Effect.gen(function* () {
		const before = childrenFixture(),
			session = yield* makeHistorySession(before);
		yield* session.transact(editChild(request(before, { gender: "Male" })));
		yield* session.undo;
		const state = yield* session.snapshot;
		yield* session.transact(
			editChild(
				request(before, { gender: "Female", darkSkinned: true, daysOld: 64 }),
			),
		);
		expect((yield* session.snapshot).entries).toEqual(state.entries);
		yield* session.redo;
		expect(readChildren((yield* session.snapshot).document)[0]?.gender).toBe(
			"Male",
		);
	}),
);
