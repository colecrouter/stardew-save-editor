import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import type { RecipeKind } from "./recipe-data.ts";
import { setRecipe, type RecipeFarmerView } from "./recipe-operations.ts";
/** Capture recipe/farmer identity before queued work can outlive page selection. */
export function createRecipeDomain(
	view: RecipeFarmerView,
	kind: RecipeKind,
	model: EditorModel,
) {
	return {
		...view,
		rows: view[kind].map((row) => {
			const countKey = `recipes:${JSON.stringify([view.farmerId, kind, row.outputId ?? row.name, "count"])}`;
			const count: ImmediateField<number> = {
				scope: model.edits.scope,
				key: countKey,
				label: `${row.name} ${kind === "cooking" ? "cooked" : "crafted items"}`,
				value: row.count,
				available: row.countSupported,
				reason: row.countReason,
				constraints: { min: 0, max: 2147483647, step: 1 },
				begin: () => model.edits.begin(countKey),
				commit: (value, gesture) =>
					model.commands.edit(
						setRecipe({
							farmerId: view.farmerId,
							recipeKind: kind,
							name: row.name,
							kind: "count",
							value,
						}),
						gesture,
					),
				end: (gesture) => model.edits.end(gesture),
			};
			return {
				...row,
				fields: { count },
				setKnown: (value: boolean) =>
					model.commands.transact(
						setRecipe({
							farmerId: view.farmerId,
							recipeKind: kind,
							name: row.name,
							kind: "known",
							value,
						}),
					),
				reset: () =>
					model.commands.transact(
						setRecipe({
							farmerId: view.farmerId,
							recipeKind: kind,
							name: row.name,
							kind: "reset",
						}),
					),
			};
		}),
	};
}
