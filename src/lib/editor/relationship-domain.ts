import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import {
	setRelationship,
	type RelationshipFarmerView,
} from "./relationship-operations.ts";

/** Capture the farmer and villager keys before queued edits can outlive selection. */
export function createRelationshipDomain(
	view: RelationshipFarmerView,
	model: EditorModel,
) {
	return {
		...view,
		relationships: view.relationships.map((row) => {
			function field(
				kind: "points" | "gifts" | "hearts",
			): ImmediateField<number> {
				const key = `relationships:${JSON.stringify([view.farmerId, row.name, kind])}`;
				return {
					scope: model.edits.scope,
					key,
					label: `${row.name} ${kind === "gifts" ? "gifts this week" : kind}`,
					value:
						kind === "points"
							? row.points
							: kind === "gifts"
								? row.gifts
								: row.hearts,
					available: row.supported && (kind !== "gifts" || row.giftsSupported),
					reason:
						row.reason ??
						(kind === "gifts" && !row.giftsSupported
							? "This saved gift count is unsupported."
							: undefined),
					constraints: {
						min: 0,
						max:
							kind === "points"
								? row.maxPoints
								: kind === "gifts"
									? 7
									: row.maxHearts,
						step: 1,
					},
					begin: () => model.edits.begin(key),
					// Hearts are an editor convenience over points, not a second saved field.
					commit: (value, gesture) =>
						model.commands.edit(
							setRelationship({
								farmerId: view.farmerId,
								name: row.name,
								kind: kind === "gifts" ? "gifts" : "points",
								value: kind === "hearts" ? value * 250 : value,
							}),
							gesture,
						),
					end: (gesture) => model.edits.end(gesture),
				};
			}
			return {
				...row,
				// Membership changes are discrete transactions with one Undo entry.
				add: () =>
					model.commands.transact(
						setRelationship({
							farmerId: view.farmerId,
							name: row.name,
							kind: "add",
						}),
					),
				remove: () =>
					model.commands.transact(
						setRelationship({
							farmerId: view.farmerId,
							name: row.name,
							kind: "remove",
						}),
					),
				fields: {
					points: field("points"),
					hearts: field("hearts"),
					gifts: field("gifts"),
				},
			};
		}),
	};
}
