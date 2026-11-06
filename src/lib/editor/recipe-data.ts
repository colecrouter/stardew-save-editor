import cooking from "../../../generated/cookingrecipes.json";
import crafting from "../../../generated/craftingrecipes.json";
import cookingOutputs from "../../../generated/cookingrecipeoutputs.json";
const outputIds = new Map<string, string>(Object.entries(cookingOutputs));

export type RecipeKind = "cooking" | "crafting";
/** Recipe names are save keys; aliases identify the vanilla item produced. */
export const recipeMapping = new Map<string, string>([
	["Cheese Cauli.", "Cheese Cauliflower"],
	["Vegetable Stew", "Vegetable Medley"],
	["Cookies", "Cookie"],
	["Eggplant Parm.", "Eggplant Parmesan"],
	["Cran. Sauce", "Cranberry Sauce"],
	["Dish o' The Sea", "Dish O' The Sea"],
	["Transmute (Fe)", "Iron Bar"],
	["Transmute (Au)", "Gold Bar"],
	["Wild Seeds (Sp)", "Spring Seeds"],
	["Wild Seeds (Su)", "Summer Seeds"],
	["Wild Seeds (Fa)", "Fall Seeds"],
	["Wild Seeds (Wi)", "Winter Seeds"],
	["Oil Of Garlic", "Oil of Garlic"],
]);
/** Only shipped recipe names authorize creating knowledge or resolving cooked IDs.
 * Unknown imported recipes stay visible without guessing their modded outputs. */
function definitions(names: readonly string[], kind: RecipeKind) {
	return names.map((name) => {
		const outputName = recipeMapping.get(name) ?? name;
		return {
			name,
			outputName,
			outputId: kind === "cooking" ? outputIds.get(name) : undefined,
		};
	});
}

// Metadata is static for this build. Reuse it across all farmers/publications
// rather than rebuilding recipe metadata on every immediate field update.
const catalog = {
	cooking: definitions(cooking, "cooking"),
	crafting: definitions(crafting, "crafting"),
};
export function recipeDefinitions(
	kind: RecipeKind,
): ReadonlyArray<ReturnType<typeof definitions>[number]> {
	return catalog[kind];
}
