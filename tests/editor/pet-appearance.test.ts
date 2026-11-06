import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import { inspectPets, readPets } from "../../src/lib/editor/pet-data.ts";
import { petAppearances } from "../../src/lib/editor/pet-appearance.ts";
import { setPet, type PetChange } from "../../src/lib/editor/pet-operations.ts";
import { projectReview } from "../../src/lib/editor/review-projection.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import {
	catId,
	dogId,
	withPets,
	fixturePet,
	savedPet,
} from "./pet-fixtures.ts";
import { exportDocument, fixtureXml, parser } from "./fixtures.ts";

const run = <A, E>(
	program: Effect.Effect<A, E, import("effect").Scope.Scope>,
) => Effect.runPromise(Effect.scoped(program));
const appearance = (petType: string, breedId: string): PetChange => ({
	petId: catId,
	kind: "appearance",
	value: { petType, breedId },
});

describe("pet appearance operations", () => {
	it.each(petAppearances)(
		"supports $label without changing linked state",
		(choice) =>
			run(
				Effect.gen(function* () {
					const document = withPets();
					const session = yield* makeHistorySession(document);
					const before = yield* session.snapshot;
					yield* session.transact(
						setPet(appearance(choice.petType, choice.breedId)),
					);
					const after = yield* session.snapshot;
					const expected = structuredClone(before.document);
					if (choice.petType !== "Cat" || choice.breedId !== "0") {
						const raw = fixturePet(expected);
						raw.petType = choice.petType;
						if (choice.breedId !== "0") raw.whichBreed = choice.breedId;
					}
					// Whole-document equality includes the actual PetBowl.petGuid, hat,
					// behavior, daily friendship state and the second same-name pet.
					expect(after.document).toEqual(expected);
					expect(parser.parse(exportDocument(after.document))).toEqual(
						parser.parse(exportDocument(expected)),
					);
					expect(
						readPets(parser.parse(exportDocument(after.document)))[0],
					).toMatchObject({
						type: choice.petType,
						breed: choice.breedId,
						appearance: { known: true },
					});
				}),
			),
	);

	it("changes species and breed atomically, reviews both, and restores exact Undo/Redo", () =>
		run(
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
		));

	it("does not rewrite a saved breed ID or add history when reselecting it", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const before = yield* session.snapshot;
				yield* session.transact(setPet(appearance("Cat", "0")));
				expect(yield* session.snapshot).toEqual(before);
			}),
		));

	it.each([
		["Turtle", "4"],
		["Dog", "missing"],
		["Horse", "0"],
		["Cat", ""],
	])(
		"rejects unsupported %s/%s without using the game's fallback breed",
		(petType, breedId) =>
			run(
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
			),
	);

	it("retains custom appearance on independent edits and replaces it only by explicit choice", () =>
		run(
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
		));

	it.each(["opaque", "duplicate", "subclass"])(
		"rejects an appearance change on a %s target",
		(kind) =>
			run(
				Effect.gen(function* () {
					const document = withPets();
					if (kind === "opaque")
						fixturePet(document).whichBreed = { future: true };
					if (kind === "duplicate") fixturePet(document, dogId).guid = catId;
					if (kind === "subclass") fixturePet(document)["$type"] = "Mod.Pet";
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
			),
	);

	it("keeps a captured appearance target after location changes and rejects removed GUIDs", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(withPets());
				const edit = setPet(appearance("Dog", "2"));
				yield* session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						const pets = inspectPets(snapshot.state.document).pets;
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
		));
});
