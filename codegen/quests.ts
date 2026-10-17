/** A story quest in Data/Quests, as the editor uses it */
export interface QuestData {
	id: string;
	/** The Data/Quests type, like `Basic`, `Building` or `ItemHarvest` */
	type: string;
	title: string;
	description: string;
	objective?: string;
	/** What finishes it, split by spaces; its meaning depends on the type */
	conditions?: string[];
	/** Quests to start once it's complete; an `h` prefix means only the host gets that one */
	nextQuests: string[];
	/** -1 when it has no gold reward */
	moneyReward: number;
	/** A reward that isn't gold; "-1" when there's none */
	rewardDescription?: string;
	canBeCancelled: boolean;
}

/** ArgUtility.TryGetOptional with `allowBlank: false` */
const optional = (fields: string[], index: number) => {
	const value = fields[index];
	return value === undefined || value.trim() === "" ? undefined : value;
};

/** ArgUtility.SplitBySpace */
const splitBySpace = (value: string | undefined) =>
	value?.split(" ").filter((part) => part !== "") ?? [];

/**
    Parse one Data/Quests entry the way `Quest.getQuestFromId` does: fields
    are separated by `/`, and an entry missing a required field can't be
    started, so it's left out.
*/
export function parseQuest(id: string, raw: string): QuestData | undefined {
	const fields = raw.split("/");
	const [type, title, description] = fields;
	if (!type?.trim() || !title?.trim() || !description?.trim()) return;
	const money = fields[6]?.trim();
	if (!money || !/^-?\d+$/.test(money)) return;
	const moneyReward = Number(money);
	const cancellable = optional(fields, 8)?.toLowerCase();
	if (cancellable !== undefined && !["true", "false"].includes(cancellable))
		return;
	// Only the quest types that need them have conditions (field 4)
	const conditions = splitBySpace(optional(fields, 4));
	return {
		id,
		type,
		title,
		description,
		objective: optional(fields, 3),
		conditions: conditions.length > 0 ? conditions : undefined,
		nextQuests: splitBySpace(optional(fields, 5)),
		moneyReward,
		// The game drops it for quests without a gold reward
		rewardDescription: moneyReward === -1 ? undefined : optional(fields, 7),
		canBeCancelled: cancellable === "true",
	};
}

/** Parse Data/Quests.json, a map of quest IDs to slash-separated fields */
export const getQuests = (data: Record<string, string>) =>
	Object.entries(data).flatMap(([id, raw]) => parseQuest(id, raw) ?? []);
