import {
	TypeIds,
	type T_StardewValley_Quests_Quest as Quest,
	type T_StardewValley_Quests_CraftingQuest as CraftingQuest,
	type T_StardewValley_Quests_ItemHarvestQuest as HarvestQuest,
	type T_StardewValley_Quests_GoSomewhereQuest as LocationQuest,
} from "../../../generated/save-format/save.ts";
import type { KnownFields } from "./domain.ts";
import questList from "../../../generated/quests.json";
export type QuestDefinition = (typeof questList)[number];
/** Static story definitions stay separate from runtime proxies and raw save types. */
export const questDefinitions = new Map(
	questList.map((quest) => [quest.id, quest]),
);
export const questLabel = (id: string) =>
	questDefinitions.get(id)?.title ?? `Quest #${id}`;
const qualified = (id: string | undefined) =>
	id?.startsWith("(") || id?.startsWith("-") ? id : undefined;
/** Construct only the story subclasses whose saved fields are fully known.
 * Unsupported follow-ups are reported explicitly instead of guessed. */
export function questFromData(
	data: QuestDefinition,
	host: boolean,
): Quest | undefined {
	const [first, second] = data.conditions ?? [];

	let questType: number;
	let completionString: string | undefined;
	// The subclass's own fields, which the game saves after the base ones
	let fields:
		| (KnownFields<CraftingQuest> & { $type: typeof TypeIds.CraftingQuest })
		| (KnownFields<HarvestQuest> & { $type: typeof TypeIds.ItemHarvestQuest })
		| (KnownFields<LocationQuest> & { $type: typeof TypeIds.GoSomewhereQuest })
		| { $type: typeof TypeIds.Quest } = { $type: TypeIds.Quest };
	switch (data.type) {
		case "Basic":
			questType = 1;
			break;
		case "Building":
			if (!first) return;
			questType = 8;
			completionString = first;
			break;
		case "Crafting": {
			// The second condition says whether an unqualified ID is a big craftable; without it, the registry decides
			const bigCraftable = second?.toLowerCase();
			if (
				bigCraftable !== undefined &&
				!["true", "false"].includes(bigCraftable)
			)
				return;
			const itemId =
				first && bigCraftable !== undefined && !first.startsWith("(")
					? `${bigCraftable === "true" ? "(BC)" : "(O)"}${first}`
					: qualified(first);
			if (!itemId) return;

			questType = 2;
			fields = {
				$type: TypeIds.CraftingQuest,
				isBigCraftable: null,
				indexToCraft: itemId,
			};
			break;
		}
		case "ItemHarvest": {
			const itemId = qualified(first);
			const number = second === undefined ? 1 : Number(second);
			if (!itemId || !Number.isInteger(number)) return;

			questType = 9;
			fields = { $type: TypeIds.ItemHarvestQuest, itemIndex: itemId, number };
			break;
		}
		case "Location":
			if (!first) return;

			questType = 6;
			fields = { $type: TypeIds.GoSomewhereQuest, whereToGo: first };
			break;
		default:
			return;
	}
	const nextQuests = data.nextQuests.flatMap((id) =>
		id.startsWith("h") ? (host ? [id.slice(1)] : []) : [id],
	);
	return {
		_currentObjective: data.objective ?? "",
		_questDescription: data.description,
		_questTitle: data.title,
		...(data.rewardDescription === undefined
			? {}
			: { rewardDescription: data.rewardDescription }),
		...(completionString ? { completionString } : {}),
		accepted: false,
		completed: false,
		dailyQuest: false,
		showNew: true,
		canBeCancelled: data.canBeCancelled,
		destroy: false,
		id: data.id,
		moneyReward: data.moneyReward,
		questType,
		daysLeft: 0,
		dayQuestAccepted: -1,
		nextQuests,
		questTitle: data.title,
		...fields,
	};
}
