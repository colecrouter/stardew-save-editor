import cookingRecipes from "$generated/cookingrecipes.json";
import craftingRecipes from "$generated/craftingrecipes.json";
import type { Player } from "$types/save";
import { SvelteMap } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";

type RecipeType = "craftingRecipes" | "cookingRecipes";
const _: Player[RecipeType]["item"] = [];

export class Recipes<T extends RecipeType>
	extends SvelteMap<string, number | null>
	implements DataProxy<Player[T]>
{
	public [Raw]: Player[T];

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

		this[Raw] = recipes;
	}

	set(key: string, value: number | null): this {
		if (value === null) {
			this[Raw].item = this[Raw].item.filter((e) => e.key.string !== key);
			super.set(key, null);
		} else {
			super.set(key, value);

			const existing = this[Raw].item.find((e) => e.key.string === key);
			if (existing) {
				// Update existing value
				existing.value.int = value;
			} else {
				// Add new value
				this[Raw].item.push({
					key: { string: key },
					value: { int: value },
				});
			}
		}

		return this;
	}
}
