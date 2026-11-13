import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readPets } from "../../src/lib/editor/pet-data.ts";
import { setPet, PetInvalid } from "../../src/lib/editor/pet-operations.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { projectReview } from "../../src/lib/editor/review-projection.ts";
import { exportDocument, parser, fixtureXml } from "./fixtures.ts";
import {
	catId,
	dogId,
	fixtureFarm,
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
		const first = view[0];
		if (!first) throw new Error("Missing projected pet");
		const icon = first.appearance.icon;
		if (!icon) throw new Error("Missing fixture appearance icon");
		icon.x += 16;
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
						const pets = [
							fixturePet(snapshot.state.document, dogId),
							fixturePet(snapshot.state.document),
						];
						// Relocate both records and reverse their order without changing GUIDs.
						// Fixture references are independent of the production discovery code.
						snapshot.state.document.SaveGame.locations = [
							{
								$type: "StardewValley.Locations.FarmHouse",
								name: "FarmHouse",
								characters: pets,
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
	] as const)("rejects %s without history or document changes", (_, input) =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(session.transact(setPet(input))),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		),
	);

	it.each(["duplicate", "missing identity", "missing friendship"])(
		"rejects %s without changing document or history",
		(kind) =>
			run(
				Effect.gen(function* () {
					const document = withPets();
					if (kind === "duplicate")
						fixturePet(document, dogId).guid = catId.toUpperCase();
					if (kind === "missing identity") delete fixturePet(document).guid;
					if (kind === "missing friendship")
						delete fixturePet(document).friendshipTowardFarmer;
					const session = yield* makeHistorySession(document);
					const before = yield* session.snapshot;
					const result = yield* Effect.result(
						session.transact(
							setPet({ petId: catId, kind: "friendship", value: 800 }),
						),
					);
					expect(
						Result.isFailure(result) && result.failure instanceof PetInvalid,
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
				}),
			),
	);

	it("edits friendship at both boundaries without inventing a missing name", () =>
		run(
			Effect.gen(function* () {
				const document = withPets();
				delete fixturePet(document).name;
				const session = yield* makeHistorySession(document);
				for (const value of [0, 1000]) {
					yield* session.transact(
						setPet({ petId: catId, kind: "friendship", value }),
					);
					const pet = fixturePet((yield* session.snapshot).document);
					expect(pet.friendshipTowardFarmer).toBe(value);
					expect(pet).not.toHaveProperty("name");
				}
			}),
		));

	it("ignores valid nil slots without changing pet discovery", () => {
		const document = withPets();
		const farm = fixtureFarm(document);
		const before = readPets(document);
		// All three collection levels can preserve nil slots from imported XML.
		document.SaveGame.locations?.push(null);
		farm.characters?.push(null);
		farm.buildings?.push(null);
		expect(readPets(document)).toEqual(before);
	});

	it.each(["character", "building", "location"])(
		"preserves an opaque %s and rejects edits that cannot rule out duplicate GUIDs",
		(kind) =>
			run(
				Effect.gen(function* () {
					const document = withPets();
					const farm = fixtureFarm(document);
					// Model unknown classes using the codec's actual opaque-object representation.
					const opaque = {
						$type: "$unknown" as const,
						$xmlType: { name: "ModdedRecord", namespace: "" },
						guid: catId,
					};
					if (kind === "character") farm.characters?.push(opaque);
					if (kind === "building") farm.buildings?.push(opaque);
					if (kind === "location") document.SaveGame.locations?.push(opaque);
					const imported = parser.parse(exportDocument(document));
					const session = yield* makeHistorySession(imported);
					const before = yield* session.snapshot;
					expect(readPets(imported)).toHaveLength(2);
					expect(readPets(imported).every((pet) => !pet.supported)).toBe(true);
					const result = yield* Effect.result(
						session.transact(
							setPet({ petId: catId, kind: "name", value: "Changed" }),
						),
					);
					expect(
						Result.isFailure(result) && result.failure instanceof PetInvalid,
					).toBe(true);
					expect(yield* session.snapshot).toEqual(before);
					expect(
						parser.parse(exportDocument((yield* session.snapshot).document)),
					).toEqual(imported);
				}),
			),
	);

	it("keeps known Cat subclasses visible but read-only", () =>
		run(
			Effect.gen(function* () {
				const document = withPets();
				const farm = fixtureFarm(document);
				// Cat is a real generated class, unlike an invented discriminator value.
				farm.characters = [
					{ ...fixturePet(document), $type: "StardewValley.Characters.Cat" },
				];
				expect(readPets(document).map((pet) => pet.supported)).toEqual([
					false,
					true,
				]);
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				const result = yield* Effect.result(
					session.transact(
						setPet({ petId: catId, kind: "name", value: "Changed" }),
					),
				);
				expect(
					Result.isFailure(result) && result.failure instanceof PetInvalid,
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it("gives missing identities distinct read-only rows", () => {
		const document = withPets();
		delete fixturePet(document).guid;
		delete fixturePet(document, dogId).guid;
		const pets = readPets(document);
		expect(pets).toHaveLength(2);
		expect(pets.map((pet) => pet.supported)).toEqual([false, false]);
		expect(new Set(pets.map((pet) => pet.key)).size).toBe(2);
	});
});
