import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { readPets } from "../../src/lib/editor/pet-data.ts";
import { setPet, type PetChange } from "../../src/lib/editor/pet-operations.ts";
import { projectReview } from "../../src/lib/editor/review-projection.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { catId, dogId, withPets, fixturePet } from "./pet-fixtures.ts";
import { exportDocument, fixtureXml, parser } from "./fixtures.ts";

const appearance = (petType: string, breedId: string): PetChange => ({
	petId: catId,
	kind: "appearance",
	value: { petType, breedId },
});

describe("pet appearance operations", () => {
	// List the supported game contract independently of the production lookup:
	// accidentally removing a catalog entry must fail a test, not remove a case.
	it.effect.each([
		["Cat", "0"],
		["Cat", "1"],
		["Cat", "2"],
		["Cat", "3"],
		["Cat", "4"],
		["Dog", "0"],
		["Dog", "1"],
		["Dog", "2"],
		["Dog", "3"],
		["Dog", "4"],
		["Turtle", "0"],
		["Turtle", "1"],
	] as const)(
		"supports %s breed %s without changing linked state",
		([petType, breedId]) =>
			Effect.gen(function* () {
				// Start at the real import boundary so codec-owned nil/default fields
				// are established before testing exact preservation on reimport.
				const document = parser.parse(exportDocument(withPets()));
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				yield* session.transact(setPet(appearance(petType, breedId)));
				const after = yield* session.snapshot;
				const expected = structuredClone(before.document);
				const raw = fixturePet(expected);
				raw.petType = petType;
				raw.whichBreed = breedId;
				// Whole-document equality includes the actual PetBowl.petGuid, hat,
				// behavior, daily friendship state and the second same-name pet.
				expect(after.document).toEqual(expected);
				const reimported = parser.parse(exportDocument(after.document));
				expect(reimported).toEqual(expected);
				expect(readPets(reimported)[0]).toMatchObject({
					type: petType,
					breed: breedId,
					appearance: { known: true },
				});
			}),
	);

	it.effect(
		"changes species and breed atomically, reviews both, and restores exact Undo/Redo",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(
					withPets(parser.parse(fixtureXml)),
				);
				const before = yield* session.snapshot;
				yield* session.transact(setPet(appearance("Dog", "4")));
				const after = yield* session.snapshot;
				expect(after.entries).toHaveLength(1);
				expect(
					projectReview(after).groups.find((group) => group.feature === "pets")
						?.changes,
				).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							label: "Miso · Type",
							before: "Cat",
							after: "Dog",
						}),
						expect.objectContaining({
							label: "Miso · Breed",
							before: "0",
							after: "4",
						}),
					]),
				);
				expect(projectReview(after).otherChanges).toEqual([]);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
	);

	it.effect(
		"does not rewrite a saved breed ID or add history when reselecting it",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const before = yield* session.snapshot;
				yield* session.transact(setPet(appearance("Cat", "0")));
				expect(yield* session.snapshot).toEqual(before);
			}),
	);

	it.effect.each([
		["Turtle", "4"],
		["Dog", "missing"],
		["Horse", "0"],
		["Cat", ""],
	] as const)(
		"rejects unsupported %s/%s without using the game's fallback breed",
		([petType, breedId]) =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(setPet(appearance(petType, breedId))),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);

	it.effect(
		"retains custom appearance on independent edits and replaces it only by explicit choice",
		() =>
			Effect.gen(function* () {
				const document = withPets();
				const custom = fixturePet(document);
				custom.petType = "Mod.Fox";
				custom.whichBreed = "Mod.Gold";
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setPet({ petId: catId, kind: "name", value: "Goldie" }),
				);
				expect(readPets((yield* session.snapshot).document)[0]).toMatchObject({
					type: "Mod.Fox",
					breed: "Mod.Gold",
					appearance: { known: false, available: true },
				});
				yield* session.transact(setPet(appearance("Turtle", "1")));
				expect(readPets((yield* session.snapshot).document)[0]).toMatchObject({
					name: "Goldie",
					type: "Turtle",
					breed: "1",
				});
				yield* session.undo;
				expect(fixturePet((yield* session.snapshot).document)).toEqual({
					...custom,
					name: "Goldie",
				});
			}),
	);

	it.effect.each(["missing breed", "duplicate", "missing type"])(
		"rejects an appearance change on a %s target",
		(kind) =>
			Effect.gen(function* () {
				const document = withPets();
				if (kind === "missing breed") delete fixturePet(document).whichBreed;
				if (kind === "duplicate") fixturePet(document, dogId).guid = catId;
				if (kind === "missing type") delete fixturePet(document).petType;
				const session = yield* makeHistorySession(document);
				const before = yield* session.snapshot;
				expect(
					Result.isFailure(
						yield* Effect.result(
							session.transact(setPet(appearance("Dog", "1"))),
						),
					),
				).toBe(true);
				expect(yield* session.snapshot).toEqual(before);
			}),
	);

	it.effect(
		"keeps a captured appearance target after location changes and rejects removed GUIDs",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const edit = setPet(appearance("Dog", "2"));
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						const pets = [
							fixturePet(snapshot.state.document, dogId),
							fixturePet(snapshot.state.document),
						];
						// Move the fixture subjects without relying on production discovery.
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
					{ id: dogId, breed: "custom-breed" },
					{ id: catId, type: "Dog", breed: "2" },
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
	);
});
