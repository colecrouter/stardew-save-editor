import cookingRecipes from "$generated/cookingrecipes.json";
import craftingRecipes from "$generated/craftingrecipes.json";
import type { Player } from "$types/save";
import { SvelteMap } from "svelte/reactivity";

type RecipeType = "craftingRecipes" | "cookingRecipes";
const _: Player[RecipeType]["item"] = [];

export class Recipes<T extends RecipeType> extends SvelteMap<
	string,
	number | null
> {
	#raw: Player[T];

	constructor(recipes: Player[T], type: T) {
		// Pick complete list of recipes
		const reference =
			type === "cookingRecipes" ? cookingRecipes : craftingRecipes;

		// Create a map containing those keys + current user value
		// Number indicates how many times the user has crafted that item
		// Null means "not unlocked" and should be omitted from the final output
		const values = reference.map(
			(key) =>
				[
					key,
					recipes.item.find((e) => e.key.string === key)?.value.int ?? null,
				] as const,
		);
		super(values);

		this.#raw = recipes;
	}

	get(key: string): number | null {
		// If the key is not in the map, return null
		if (!super.has(key)) return null;

		// Otherwise, return the value from the map
		return super.get(key) ?? null;
	}

	set(key: string, value: number | null): this {
		if (value === null) {
			this.#raw.item = this.#raw.item.filter((e) => e.key.string !== key);
			super.set(key, null);
		} else {
			super.set(key, value);

			const existing = this.#raw.item.find((e) => e.key.string === key);
			if (existing) {
				// Update existing value
				existing.value.int = value;
			} else {
				// Add new value
				this.#raw.item.push({
					key: { string: key },
					value: { int: value },
				});
			}
		}

		return this;
	}
}
