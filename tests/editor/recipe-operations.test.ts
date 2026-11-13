import { Effect } from "effect";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import {
	tinyFixture,
	parser,
	exportDocument,
} from "../helpers/editor-document.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	readRecipes,
	setRecipe,
	type RecipeChange,
} from "../../src/lib/editor/recipe-operations.ts";
import { recipeDefinitions } from "../../src/lib/editor/recipe-data.ts";

const entry = (name: string | number, count: number) => ({
	key: name,
	value: count,
});
function fixture() {
	const doc = tinyFixture();
	Object.assign(doc.SaveGame.player, {
		cookingRecipes: [entry("Fried Egg", 17)],
		craftingRecipes: [entry("Wood Fence", 4)],
		recipesCooked: [],
	});
	return doc;
}
const change = (
	kind: "cooking" | "crafting",
	name: string,
	action:
		| { kind: "known"; value: boolean }
		| { kind: "count"; value: number }
		| { kind: "reset" },
): RecipeChange => ({ farmerId: "1", recipeKind: kind, name, ...action });
const cookedId = recipeDefinitions("cooking").find(
	(row) => row.name === "Fried Egg",
)?.outputId;
if (!cookedId) throw Error("Missing cooking metadata");
describe("recipe save operations", () => {
	it("reads real cooked counts independently of knowledge without modifying input", () => {
		const doc = fixture();
		Object.assign(doc.SaveGame.player, {
			recipesCooked: [entry(Number(cookedId), 9)],
		});
		const before = structuredClone(doc);
		const view = readRecipes(doc)[0];
		expect(view?.cooking.find((row) => row.name === "Fried Egg")).toMatchObject(
			{ known: true, count: 9, countSupported: true },
		);
		expect(
			view?.crafting.find((row) => row.name === "Wood Fence"),
		).toMatchObject({ known: true, count: 4 });
		expect(doc).toEqual(before);
	});
	it.effect(
		"edits and resets real cooked counts preserving known payload, metadata and exact Undo/Redo",
		() =>
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: [
						{
							key: cookedId,
							keyMetadata: "key",
							value: 9,
							valueMetadata: "value",
							mod: "entry",
						},
					],
					testMetadatarecipesCooked: { opaque: "007" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				yield* session.transact(
					setRecipe(
						change("cooking", "Fried Egg", { kind: "count", value: 15 }),
					),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toMatchObject({
					cookingRecipes: [entry("Fried Egg", 17)],
					recipesCooked: [
						{
							key: cookedId,
							keyMetadata: "key",
							value: 15,
							valueMetadata: "value",
							mod: "entry",
						},
					],
					testMetadatarecipesCooked: { opaque: "007" },
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
				yield* session.transact(
					setRecipe(change("cooking", "Fried Egg", { kind: "reset" })),
				);
				expect(
					readRecipes((yield* session.snapshot).document)[0]?.cooking.find(
						(row) => row.name === "Fried Egg",
					)?.count,
				).toBe(0);
			}),
	);
	it.effect(
		"forgets cooking knowledge without erasing history, then relearns at zero knowledge payload",
		() =>
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: [entry(cookedId, 6)],
				});
				const session = yield* makeHistorySession(doc);
				yield* session.transact(
					setRecipe(
						change("cooking", "Fried Egg", { kind: "known", value: false }),
					),
				);
				expect(
					readRecipes((yield* session.snapshot).document)[0]?.cooking.find(
						(row) => row.name === "Fried Egg",
					),
				).toMatchObject({ known: false, count: 6, countSupported: true });
				yield* session.transact(
					setRecipe(
						change("cooking", "Fried Egg", { kind: "known", value: true }),
					),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					cookingRecipes: [entry("Fried Egg", 0)],
					recipesCooked: [entry(cookedId, 6)],
				});
			}),
	);
	it.effect(
		"unlocks and edits crafting in its dictionary; forgetting removes its count atomically",
		() =>
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					craftingRecipes: [
						{ ...entry("Mod Recipe", 45), customModData: "keep" },
					],
					testMetadatacraftingRecipes: { opaque: "keep" },
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				yield* session.transact(
					setRecipe(
						change("crafting", "Wood Fence", { kind: "known", value: true }),
					),
				);
				yield* session.transact(
					setRecipe(
						change("crafting", "Wood Fence", { kind: "count", value: 12 }),
					),
				);
				const learned = yield* session.snapshot;
				expect(
					readRecipes(learned.document)[0]?.crafting.find(
						(row) => row.name === "Wood Fence",
					),
				).toMatchObject({ known: true, count: 12 });
				yield* session.transact(
					setRecipe(
						change("crafting", "Wood Fence", { kind: "known", value: false }),
					),
				);
				const forgotten = yield* session.snapshot;
				expect(forgotten.document.SaveGame.player).toMatchObject({
					craftingRecipes: [
						{ ...entry("Mod Recipe", 45), customModData: "keep" },
					],
					testMetadatacraftingRecipes: { opaque: "keep" },
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(learned.document);
				expect(before.document.SaveGame.player).toMatchObject({
					craftingRecipes: [{ customModData: "keep" }],
				});
			}),
	);
	it.effect(
		"rejects ambiguous numeric/string cooked IDs while unrelated knowledge remains editable",
		() =>
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: [entry(cookedId, 4), entry(Number(cookedId), 7)],
				});
				const session = yield* makeHistorySession(doc);
				const before = yield* session.snapshot;
				const row = readRecipes(before.document)[0]?.cooking.find(
					(row) => row.name === "Fried Egg",
				);
				expect(row).toMatchObject({ supported: true, countSupported: false });
				expect(
					(yield* Effect.result(
						session.transact(
							setRecipe(change("cooking", "Fried Egg", { kind: "reset" })),
						),
					))._tag,
				).toBe("Failure");
				expect((yield* session.snapshot).document).toEqual(before.document);
				yield* session.transact(
					setRecipe(
						change("cooking", "Fried Egg", { kind: "known", value: false }),
					),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					recipesCooked: [entry(cookedId, 4), entry(Number(cookedId), 7)],
				});
			}),
	);
	it.effect(
		"retains unknown imported recipes and opaque siblings without guessing cooked output IDs",
		() =>
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					cookingRecipes: [
						entry("Mod Soup", 5),
						{ opaque: "unaddressable" },
						entry("Fried Egg", 17),
					],
				});
				const session = yield* makeHistorySession(doc);
				expect(
					readRecipes(doc)[0]?.cooking.find((row) => row.name === "Mod Soup"),
				).toMatchObject({ known: true, countSupported: false });
				expect(
					(yield* Effect.result(
						session.transact(
							setRecipe(
								change("cooking", "Mod Soup", { kind: "count", value: 4 }),
							),
						),
					))._tag,
				).toBe("Failure");
				yield* session.transact(
					setRecipe(
						change("cooking", "Fried Egg", { kind: "known", value: false }),
					),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					cookingRecipes: [entry("Mod Soup", 5), { opaque: "unaddressable" }],
				});
			}),
	);
	it("leaves malformed/missing dictionaries and duplicate knowledge read-only", () => {
		const doc = fixture();
		Object.assign(doc.SaveGame.player, {
			cookingRecipes: [entry("Fried Egg", 0), entry("Fried Egg", 2)],
			craftingRecipes: undefined,
		});
		const view = readRecipes(doc)[0];
		expect(
			view?.cooking.find((row) => row.name === "Fried Egg")?.supported,
		).toBe(false);
		expect(
			view?.crafting.every((row) => !row.supported && !row.countSupported),
		).toBe(true);
	});
	it.effect(
		"rejects invalid values and inherited request fields without publishing changes",
		() =>
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				const before = yield* session.snapshot;
				const requests: unknown[] = [
					change("crafting", "Wood Fence", { kind: "count", value: -1 }),
					change("crafting", "Wood Fence", {
						kind: "count",
						value: 2147483648,
					}),
					change("crafting", "Wood Fence", { kind: "count", value: 1.5 }),
					Object.create(
						change("crafting", "Wood Fence", { kind: "known", value: false }),
					),
					{ ...change("cooking", "Fried Egg", { kind: "reset" }), extra: true },
				];
				for (const request of requests)
					expect(
						(yield* Effect.result(
							session.transact(setRecipe(request as RecipeChange)),
						))._tag,
					).toBe("Failure");
				expect((yield* session.snapshot).document).toEqual(before.document);
			}),
	);
	it.effect("captures farmer identity and rejects ambiguous owners", () =>
		Effect.gen(function* () {
			const doc = fixture();
			const farmhands = doc.SaveGame.farmhands;
			const guest = farmhands && farmhands[0];
			if (!guest) throw Error("Missing guest");
			Object.assign(guest, {
				craftingRecipes: [entry("Wood Fence", 3)],
				cookingRecipes: [],
				recipesCooked: [],
			});
			const session = yield* makeHistorySession(doc);
			yield* session.transact(
				setRecipe({
					...change("crafting", "Wood Fence", { kind: "count", value: 8 }),
					farmerId: "2",
				}),
			);
			expect(
				readRecipes((yield* session.snapshot).document)
					.find((owner) => owner.farmerId === "1")
					?.crafting.find((row) => row.name === "Wood Fence")?.count,
			).toBe(4);
			guest.UniqueMultiplayerID = 1n;
			const ambiguous = yield* makeHistorySession(doc);
			expect(
				(yield* Effect.result(
					ambiguous.transact(
						setRecipe(change("crafting", "Wood Fence", { kind: "reset" })),
					),
				))._tag,
			).toBe("Failure");
		}),
	);
});

it.effect(
	"distinguishes an existing zero cooked entry from no history and reset removes it with exact Undo",
	() =>
		Effect.gen(function* () {
			const doc = fixture();
			Object.assign(doc.SaveGame.player, {
				recipesCooked: [{ ...entry(cookedId, 0), opaque: "saved" }],
				testMetadatarecipesCooked: { opaque: "keep" },
			});
			const session = yield* makeHistorySession(doc);
			const before = yield* session.snapshot;
			expect(
				readRecipes(before.document)[0]?.cooking.find(
					(row) => row.name === "Fried Egg",
				),
			).toMatchObject({ count: 0, hasCookedEntry: true });
			yield* session.transact(
				setRecipe(change("cooking", "Fried Egg", { kind: "count", value: 0 })),
			);
			expect((yield* session.snapshot).entries).toHaveLength(0);
			yield* session.transact(
				setRecipe(change("cooking", "Fried Egg", { kind: "reset" })),
			);
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player).toMatchObject({
				recipesCooked: [],
				testMetadatarecipesCooked: { opaque: "keep" },
			});
			expect(
				readRecipes(after.document)[0]?.cooking.find(
					(row) => row.name === "Fried Egg",
				),
			).toMatchObject({ count: 0, hasCookedEntry: false });
			yield* session.undo;
			expect((yield* session.snapshot).document).toEqual(before.document);
			yield* session.redo;
			expect((yield* session.snapshot).document).toEqual(after.document);
		}),
);

it("reads production counters after the real XML codec roundtrip", () => {
	const doc = fixture();
	Object.assign(doc.SaveGame.player, {
		recipesCooked: [entry("194", 5)],
	});
	const parsed = parser.parse(exportDocument(doc));

	expect(
		readRecipes(parsed)[0]?.cooking.find((row) => row.name === "Fried Egg"),
	).toMatchObject({ count: 5, countSupported: true, hasCookedEntry: true });
}, 30_000);
