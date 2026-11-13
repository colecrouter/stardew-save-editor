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
