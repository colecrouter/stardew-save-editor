import cookingRecipes from "$generated/cookingrecipes.json";
import craftingRecipes from "$generated/craftingrecipes.json";
import type { Player } from "$types/save";

type RecipeType = "craftingRecipes" | "cookingRecipes";
const _: Player[RecipeType]["item"] = [];

export class Recipes<T extends RecipeType> {
    raw: Player[T];
    type: T;

    constructor(recipes: Player[T], type: T) {
        this.raw = recipes;
        this.type = type;
    }

    get recipes() {
        const recipesList =
            this.type === "craftingRecipes" ? craftingRecipes : cookingRecipes;

        return Object.fromEntries(
            recipesList.map((recipe) => [
                recipe,
                this.raw.item?.some((e) => e.key.string === recipe),
            ]),
        );
    }

    set recipes(value: Record<string, boolean>) {
        this.raw.item = Object.entries(value)
            .filter(([, known]) => known)
            .map(([recipe]) => ({
                key: { string: recipe },
                value: { int: 0 },
            }));
    }
}
