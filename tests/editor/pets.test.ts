import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { inspectPets, readPets } from "../../src/lib/editor/pet-data.ts";
import { setPet, type PetChange } from "../../src/lib/editor/pet-operations.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { projectReview } from "../../src/lib/editor/review-projection.ts";
import { exportDocument, parser, fixtureXml } from "./fixtures.ts";
import {
	catId,
	dogId,
	savedPet,
	withPets,
	fixturePet,
} from "./pet-fixtures.ts";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));

describe("existing pet editing", () => {
	it("discovers pets across outdoor and nested indoor arrays without normalizing the save", () => {
		const document = withPets();
		const before = structuredClone(document);
		expect(readPets(document)).toMatchObject([
			{
				id: catId,
				name: "Miso",
				location: "Farm",
				friendship: 400,
				supported: true,
			},
			{
				id: dogId,
				name: "Miso",
				location: "Cabin",
				breed: "custom-breed",
				supported: true,
			},
		]);
		expect(document).toEqual(before);
		// Views contain detached presentation data, including nested icon metadata.
		// Mutating a caller's copy must never change the imported document.
		const view = readPets(document);
		Object.assign(view[0] ?? {}, { name: "Changed presentation" });
		expect(document).toEqual(before);
	});

	it("changes only the requested fields, round-trips XML, and restores exact history", () =>
		run(
			Effect.gen(function* () {
				// Review integrates the other feature projectors, so use one full-save
				// case here; isolated boundary cases below keep their minimal fixtures.
				const document = parser.parse(
					exportDocument(withPets(parser.parse(fixtureXml))),
				);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(
					setPet({
						petId: catId.toUpperCase(),
						kind: "name",
						value: "Mochi & Miso",
					}),
				);
				yield* session.transact(
					setPet({ petId: dogId, kind: "friendship", value: 1000 }),
				);
				const after = yield* session.snapshot;
				const expected = structuredClone(before.document);
				fixturePet(expected).name = "Mochi & Miso";
				fixturePet(expected, dogId).friendshipTowardFarmer = 1000;
				// Whole-document equality catches accidental mail, bowl, appearance,
				// farmer-preference, daily-petting and unknown-field writes together.
				expect(after.document).toEqual(expected);
				expect(parser.parse(exportDocument(after.document))).toEqual(expected);
				const review = projectReview(after);
				expect(
					review.groups.find((group) => group.feature === "pets")?.changes,
				).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							label: "Mochi & Miso · Name",
							before: "Miso",
							after: "Mochi & Miso",
						}),
						expect.objectContaining({
							label: "Miso · Friendship",
							before: 400,
							after: 1000,
						}),
					]),
				);
				expect(review.otherChanges).toEqual([]);
				yield* session.undo;
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));

	it("resolves captured identities after reordering and rejects a removed target", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const edit = setPet({ petId: catId, kind: "friendship", value: 900 });
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						const pets = inspectPets(snapshot.state.document).pets;
						// Relocate both records and reverse their order without changing GUIDs.
						// These references were discovered from typed NPC arrays above.
						snapshot.state.document.SaveGame.locations = [
							{
								$type: "StardewValley.Locations.FarmHouse",
								name: "FarmHouse",
								characters: pets
									.map((pet) => pet.raw as ReturnType<typeof savedPet>)
									.reverse(),
							},
						];
						yield* draft.replace(snapshot);
					}),
				);
				yield* session.transact(edit);
				expect(readPets((yield* session.snapshot).document)).toMatchObject([
					{ id: dogId, friendship: 400 },
					{ id: catId, friendship: 900 },
				]);
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.locations = [];
						yield* draft.replace(snapshot);
					}),
				);
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(yield* Effect.result(session.transact(edit))),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it.each([
		["blank name", { petId: catId, kind: "name", value: "  " }],
		["negative points", { petId: catId, kind: "friendship", value: -1 }],
		["excess points", { petId: catId, kind: "friendship", value: 1001 }],
		["fractional points", { petId: catId, kind: "friendship", value: 1.5 }],
		["non-finite points", { petId: catId, kind: "friendship", value: NaN }],
		["unknown field", { petId: catId, kind: "guid", value: dogId }],
		[
			"extra fields",
			{ petId: catId, kind: "name", value: "Mochi", ignored: true },
		],
	] as const)("rejects %s without history or document changes", (_, input) =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(session.transact(setPet(input as PetChange))),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		),
	);

	it.each(["duplicate", "missing", "custom", "collection", "opaque"])(
		"preserves %s pet data on rejection",
		(kind) =>
			run(
				Effect.gen(function* () {
					const document = withPets();
					const pet = fixturePet(document);
					if (kind === "duplicate")
						fixturePet(document, dogId).guid = catId.toUpperCase();
					if (kind === "missing") delete pet.guid;
					if (kind === "custom") pet["$type"] = "CustomPet";
					if (kind === "collection")
						// Deliberately inject malformed extension data to exercise rejection.
						Object.assign(document.SaveGame, {
							locations: [
								{
									$type: "StardewValley.GameLocation",
									name: "Bad",
									characters: 42,
								},
								{
									$type: "StardewValley.Farm",
									name: "Farm",
									characters: [pet],
								},
							],
						});
					if (kind === "opaque")
						pet.friendshipTowardFarmer = { future: "value" };
					const session = yield* makeHistorySession(document);
					const before = yield* session.snapshot;
					expect(
						Result.isFailure(
							yield* Effect.result(
								session.transact(
									setPet({ petId: catId, kind: "friendship", value: 800 }),
								),
							),
						),
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}),
			),
	);

	it("keeps unsupported fields independent and accepts both friendship boundaries", () =>
		run(
			Effect.gen(function* () {
				const document = withPets();
				fixturePet(document).name = { future: true };
				const session = yield* makeHistorySession(document);
				for (const value of [0, 1000]) {
					yield* session.transact(
						setPet({ petId: catId, kind: "friendship", value }),
					);
					expect(
						readPets((yield* session.snapshot).document)[0]?.friendship,
					).toBe(value);
				}
				expect(
					inspectPets((yield* session.snapshot).document).pets[0]?.raw.name,
				).toEqual({ future: true });
			}),
		));

	it("accepts null collection slots but disables edits when opaque XML may hide identities", () => {
		const document = withPets();
		const farm = document.SaveGame.locations?.[0];
		if (!farm || farm.$type === "$unknown")
			throw new Error("Missing fixture farm");
		// The codec preserves valid nil slots; they are not malformed pet records.
		document.SaveGame.locations?.push(null);
		farm.characters?.push(null);
		farm.buildings?.push(null);
		expect(readPets(document).every((pet) => pet.supported)).toBe(true);
		// Unknown classes retain their XML outside the known field model. Even if
		// their GUID cannot be inspected, do not permit an ambiguous known-pet edit.
		Object.assign(farm, {
			characters: [...(farm.characters ?? []), { $type: "$unknown" }],
		});
		expect(readPets(document).every((pet) => !pet.supported)).toBe(true);
	});

	it("shows missing identities and custom subclasses without inventing writable GUIDs", () => {
		const document = withPets();
		// Custom discriminator data is deliberately outside the generated union.
		Object.assign(document.SaveGame, {
			locations: [
				{
					$type: "StardewValley.Farm",
					name: "Farm",
					characters: [
						{ ...savedPet(), guid: "" },
						{ ...savedPet(dogId), $type: "CustomPet" },
					],
				},
			],
		});
		expect(readPets(document).map((pet) => pet.supported)).toEqual([
			false,
			false,
		]);
		expect(new Set(readPets(document).map((pet) => pet.key)).size).toBe(2);
	});
});
