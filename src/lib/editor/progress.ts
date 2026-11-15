import type { ImmutableView } from "./immutable-view.ts";
import { recipeDefinitions, type RecipeKind } from "./recipe-data.ts";
import type { RecipeFarmerView } from "./recipe-operations.ts";

/** Diagnose vanilla requirements without treating imported mod recipes as goals.
 * Knowledge and production are separate saved records: cooking requires learned
 * knowledge plus a production entry; crafting requires a positive count.
 * Ambiguous data must not imply completion.
 * Requirement scope: https://stardewvalleywiki.com/Perfection and
 * https://stardewvalleywiki.com/Achievements#Crafting_Achievements. */
export function recipeProgress(
	farmer: ImmutableView<RecipeFarmerView>,
	kind: RecipeKind,
) {
	const requirements = recipeDefinitions(kind)
		.filter(
			(definition) => kind !== "crafting" || definition.name !== "Wedding Ring",
		)
		.map((definition) => {
			const row = farmer[kind].find(
				(candidate) => candidate.name === definition.name,
			);
			// Utility.getCookedRecipesPercent and Stats.checkForCookingAchievements
			// both require knowledge before consulting cooking history. Unlearned
			// recipes are definitely missing even if their history is unreadable.
			const readable =
				!!row &&
				farmer.supported &&
				row.supported &&
				(!row.known || row.countSupported);
			return {
				name: definition.name,
				learned: row?.known ?? false,
				status: !readable
					? ("unknown" as const)
					: row.known &&
						  (kind === "cooking" ? row.hasCookedEntry : (row.count ?? 0) > 0)
						? ("complete" as const)
						: ("missing" as const),
			};
		});
	return {
		kind,
		requirements,
		total: requirements.length,
		completed: requirements.filter((row) => row.status === "complete").length,
		unknown: requirements.filter((row) => row.status === "unknown").length,
	};
}
