import { SvelteMap } from "svelte/reactivity";
import cookingRecipes from "$generated/cookingrecipes.json";
import craftingRecipes from "$generated/craftingrecipes.json";
import type { Player } from "$types/save";
import { type DataProxy, Raw } from ".";

type RecipeType = "craftingRecipes" | "cookingRecipes";
// Basic type assertion
const _: Player[RecipeType]["item"] = [];

/**
 * Map of crafting or cooking recipes for a player.
 *
 * A value of `number` indicates how many times the player has crafted that item.
 * `null` means the recipe is not unlocked.
 */
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
		super.set(key, value);

		if (value === null) {
			// Delete entry from raw
			this[Raw].item = this[Raw].item.filter((e) => e.key.string !== key);
		} else {
			// Find existing entry
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
