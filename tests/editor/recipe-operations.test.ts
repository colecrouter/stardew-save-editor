import { Effect, type Scope } from "effect";
import { describe, it, expect } from "vitest";
import { tinyFixture, parser, exportDocument } from "./fixtures.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	readRecipes,
	setRecipe,
	type RecipeChange,
} from "../../src/lib/editor/recipe-operations.ts";
import { recipeDefinitions } from "../../src/lib/editor/recipe-data.ts";
const run = <E>(program: Effect.Effect<void, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(program));
const entry = (name: string | number, count: number) => ({
	key: { string: name },
	value: { int: count },
});
function fixture() {
	const doc = tinyFixture();
	Object.assign(doc.SaveGame.player, {
		cookingRecipes: { item: [entry("Fried Egg", 17)] },
		craftingRecipes: { item: [entry("Wood Fence", 4)] },
		recipesCooked: "",
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
): RecipeChange => ({ farmerId: "host", recipeKind: kind, name, ...action });
const cookedId = recipeDefinitions("cooking").find(
	(row) => row.name === "Fried Egg",
)?.outputId;
if (!cookedId) throw Error("Missing cooking metadata");
describe("recipe save operations", () => {
	it("reads real cooked counts independently of knowledge without modifying input", () => {
		const doc = fixture();
		Object.assign(doc.SaveGame.player, {
			recipesCooked: { item: [entry(Number(cookedId), 9)] },
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
	it("edits and resets real cooked counts preserving known payload, metadata and exact Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: {
						opaque: "007",
						item: {
							key: { string: Number(cookedId), mod: "key" },
							value: { int: 9, mod: "value" },
							mod: "entry",
						},
					},
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
					cookingRecipes: { item: [entry("Fried Egg", 17)] },
					recipesCooked: {
						opaque: "007",
						item: {
							key: { string: Number(cookedId), mod: "key" },
							value: { int: 15, mod: "value" },
							mod: "entry",
						},
					},
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
		));
	it("forgets cooking knowledge without erasing history, then relearns at zero knowledge payload", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: { item: [entry(cookedId, 6)] },
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
					cookingRecipes: { item: [entry("Fried Egg", 0)] },
					recipesCooked: { item: [entry(cookedId, 6)] },
				});
			}),
		));
	it("unlocks and edits crafting in its dictionary; forgetting removes its count atomically", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					craftingRecipes: {
						opaque: "keep",
						item: { ...entry("Mod Recipe", 45), modData: "keep" },
					},
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
					craftingRecipes: {
						opaque: "keep",
						item: [{ ...entry("Mod Recipe", 45), modData: "keep" }],
					},
				});
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(learned.document);
				expect(before.document.SaveGame.player).toMatchObject({
					craftingRecipes: { item: { modData: "keep" } },
				});
			}),
		));
	it("rejects ambiguous numeric/string cooked IDs while unrelated knowledge remains editable", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					recipesCooked: {
						item: [entry(cookedId, 4), entry(Number(cookedId), 7)],
					},
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
					recipesCooked: {
						item: [entry(cookedId, 4), entry(Number(cookedId), 7)],
					},
				});
			}),
		));
	it("retains unknown imported recipes and opaque siblings without guessing cooked output IDs", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				Object.assign(doc.SaveGame.player, {
					cookingRecipes: {
						item: [
							entry("Mod Soup", 5),
							{ opaque: "unaddressable" },
							entry("Fried Egg", 17),
						],
					},
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
					cookingRecipes: {
						item: [entry("Mod Soup", 5), { opaque: "unaddressable" }],
					},
				});
			}),
		));
	it("leaves malformed/missing dictionaries and duplicate knowledge read-only", () => {
		const doc = fixture();
		Object.assign(doc.SaveGame.player, {
			cookingRecipes: { item: [entry("Fried Egg", 0), entry("Fried Egg", 2)] },
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
	it("rejects invalid values and inherited request fields without publishing changes", () =>
		run(
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
		));
	it("captures farmer identity and rejects ambiguous owners", () =>
		run(
			Effect.gen(function* () {
				const doc = fixture();
				const farmhands = doc.SaveGame.farmhands;
				const guest = farmhands && farmhands.Farmer[0];
				if (!guest) throw Error("Missing guest");
				Object.assign(guest, {
					craftingRecipes: { item: [entry("Wood Fence", 3)] },
					cookingRecipes: "",
					recipesCooked: "",
				});
				const session = yield* makeHistorySession(doc);
				yield* session.transact(
					setRecipe({
						...change("crafting", "Wood Fence", { kind: "count", value: 8 }),
						farmerId: "guest",
					}),
				);
				expect(
					readRecipes((yield* session.snapshot).document)
						.find((owner) => owner.farmerId === "host")
						?.crafting.find((row) => row.name === "Wood Fence")?.count,
				).toBe(4);
				guest.UniqueMultiplayerID = "host";
				const ambiguous = yield* makeHistorySession(doc);
				expect(
					(yield* Effect.result(
						ambiguous.transact(
							setRecipe(change("crafting", "Wood Fence", { kind: "reset" })),
						),
					))._tag,
				).toBe("Failure");
			}),
		));
});

it("distinguishes an existing zero cooked entry from no history and reset removes it with exact Undo", () =>
	run(
		Effect.gen(function* () {
			const doc = fixture();
			Object.assign(doc.SaveGame.player, {
				recipesCooked: {
					opaque: "keep",
					item: { ...entry(cookedId, 0), opaque: "saved" },
				},
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
				recipesCooked: { opaque: "keep" },
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
	));
it("does not interpret nil or legacy integer-key counters as an empty cooked history", () => {
	for (const recipesCooked of [
		{ "@_xsi:nil": true },
		{ item: { key: { int: Number(cookedId) }, value: { int: 4 } } },
	]) {
		const doc = fixture();
		Object.assign(doc.SaveGame.player, { recipesCooked });
		expect(
			readRecipes(doc)[0]?.cooking.find((row) => row.name === "Fried Egg"),
		).toMatchObject({ countSupported: false, count: undefined });
	}
	const doc = fixture();
	Object.assign(doc.SaveGame.player, {
		cookingRecipes: { "@_xsi:nil": "true" },
	});
	expect(readRecipes(doc)[0]?.cooking.every((row) => !row.supported)).toBe(
		true,
	);
});

it("reads production counters after the real XML codec roundtrip", () => {
	const doc = fixture();
	Object.assign(doc.SaveGame.player, {
		recipesCooked: { item: [entry("194", 5)] },
	});
	const parsed = parser.parse(exportDocument(doc));

	expect(
		readRecipes(parsed)[0]?.cooking.find((row) => row.name === "Fried Egg"),
	).toMatchObject({ count: 5, countSupported: true, hasCookedEntry: true });
});
