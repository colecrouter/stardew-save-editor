import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setQuest, type QuestFarmerView } from "./quest-operations.ts";
/** Bind detached journal values to the farmer and quest captured by the projection. */
export function createQuestDomain(view: QuestFarmerView, model: EditorModel) {
	return {
		...view,
		quests: view.quests.map((row) => {
			function field(kind: "reward" | "days"): ImmediateField<number> {
				const key = `quests:${JSON.stringify([view.farmerId, row.key, kind])}`;
				return {
					scope: model.edits.scope,
					key,
					label: `${row.title} ${kind === "reward" ? "gold reward" : "days left"}`,
					value: kind === "reward" ? row.reward : row.daysLeft,
					available:
						kind === "reward"
							? row.rewardSupported
							: row.daysSupported && row.timed,
					reason: row.reason,
					constraints: {
						min: kind === "reward" ? 0 : 1,
						max: kind === "reward" ? 99999 : 99,
						step: 1,
					},
					begin: () => model.edits.begin(key),
					commit: (value, gesture) =>
						model.commands.edit(
							setQuest({
								farmerId: view.farmerId,
								questKey: row.key,
								kind,
								value,
							}),
							gesture,
						),
					end: (gesture) => model.edits.end(gesture),
				};
			}
			return {
				...row,
				fields: { reward: field("reward"), days: field("days") },
				complete: () =>
					model.commands.transact(
						setQuest({
							farmerId: view.farmerId,
							questKey: row.key,
							kind: "complete",
						}),
					),
				remove: () =>
					model.commands.transact(
						setQuest({
							farmerId: view.farmerId,
							questKey: row.key,
							kind: "remove",
						}),
					),
			};
		}),
	};
}
