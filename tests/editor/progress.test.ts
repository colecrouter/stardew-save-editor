import { expect, it } from "vitest";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { readRecipes } from "../../src/lib/editor/recipe-operations.ts";
import { recipeProgress } from "../../src/lib/editor/progress.ts";

it("separates learned recipes from production and excludes the Wedding Ring", () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, {
		cookingRecipes: [{ key: "Fried Egg", value: 99 }],
		recipesCooked: [{ key: "194", value: 0 }],
		craftingRecipes: [
			{ key: "Torch", value: 0 },
			{ key: "Wedding Ring", value: 1 },
			{ key: "Mod Recipe", value: 1 },
		],
	});
	const farmer = readRecipes(document)[0]!;
	const before = structuredClone(document);
	const cooking = recipeProgress(farmer, "cooking");
	const crafting = recipeProgress(farmer, "crafting");
	// A zero-valued cooking entry earns credit; learned crafting at zero does not.
	expect(cooking.completed).toBe(1);
	expect(crafting.completed).toBe(0);
	expect(crafting.unknown).toBe(0);
	expect(
		crafting.requirements.some(
			(row) => row.name === "Wedding Ring" || row.name === "Mod Recipe",
		),
	).toBe(false);
	expect(
		crafting.requirements.find((row) => row.name === "Torch"),
	).toMatchObject({ learned: true, status: "missing" });
	expect(document).toEqual(before);
});

it("keeps malformed counters uncertain instead of reporting missing or complete", () => {
	const document = tinyEditorFixture();
	Object.assign(document.SaveGame.player, {
		cookingRecipes: [{ key: "Fried Egg", value: 0 }],
		recipesCooked: [
			{ key: "194", value: 1 },
			{ key: "194", value: 2 },
		],
		craftingRecipes: [],
	});
	const progress = recipeProgress(readRecipes(document)[0]!, "cooking");
	expect(
		progress.requirements.find((row) => row.name === "Fried Egg")?.status,
	).toBe("unknown");
	expect(progress.completed).toBe(0);
});

it("keeps farmer progress separate and reports absent dictionaries as uncertain", () => {
	const document = tinyEditorFixture();
	const host = document.SaveGame.player;
	Object.assign(host, {
		cookingRecipes: [{ key: "Fried Egg", value: 0 }],
		recipesCooked: [{ key: "194", value: 1 }],
		craftingRecipes: [],
	});
	const guest = structuredClone(host);
	guest.UniqueMultiplayerID = 2n;
	guest.recipesCooked = [];
	document.SaveGame.farmhands = [guest];
	const farmers = readRecipes(document);
	expect(recipeProgress(farmers[0]!, "cooking").completed).toBe(1);
	expect(recipeProgress(farmers[1]!, "cooking").completed).toBe(0);
	// Missing cooking history leaves learned recipes uncertain; unlearned ones
	// still cannot earn completion credit.
	delete guest.recipesCooked;
	const progress = recipeProgress(readRecipes(document)[1]!, "cooking");
	expect(progress.unknown).toBe(1);
});
