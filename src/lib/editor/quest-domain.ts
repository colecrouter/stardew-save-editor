import type { ImmutableView } from "./immutable-view.ts";
import { bindImmediateField, type DomainEditPort } from "./field-binding.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setQuest, type QuestFarmerView } from "./quest-operations.ts";
/** Bind detached journal values to the farmer and quest captured by the projection. */
export function createQuestDomain(
	view: ImmutableView<QuestFarmerView>,
	model: DomainEditPort,
) {
	return {
		...view,
		quests: view.quests.map((row) => {
			function field(kind: "reward" | "days"): ImmediateField<number> {
				const key = `quests:${JSON.stringify([view.farmerId, row.key, kind])}`;
				return bindImmediateField(
					model,
					{
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
					},
					(value: number) =>
						setQuest({
							farmerId: view.farmerId,
							questKey: row.key,
							kind,
							value,
						}),
				);
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
