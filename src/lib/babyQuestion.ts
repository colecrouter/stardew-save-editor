/**
    When a spouse can ask "Do you want to have a baby?".

    From the wiki's Children and Random Events pages: the question is a
    random farm event picked overnight, with about a 5% chance each night
    once every requirement below is met. The wiki also says the farmer must
    be sleeping at home; that isn't in the save, so it isn't checked here.

    Two rules aren't spelled out on those pages and come from the game's
    own pregnancy check: a roommate can't have children, and a spouse who
    is already expecting won't ask again.
*/
import { type GameDate, totalDays } from "$lib/calendar";
import type { Friendship } from "$lib/proxies/Friendship.svelte";
import { type GameLocation, Status } from "$types/save";

/** 10 hearts of 250 points */
export const BABY_QUESTION_POINTS = 2500;
export const BABY_QUESTION_DAYS_MARRIED = 7;
/** The second farmhouse upgrade, which adds the nursery */
export const NURSERY_UPGRADE_LEVEL = 2;
export const MAX_CHILDREN = 2;
/** The wiki's chance per night, once eligible */
export const BABY_QUESTION_CHANCE = 0.05;

export interface BabyQuestionHome {
	/** The house's upgrade level (0 to 3) */
	upgradeLevel: number;
	/** The crib's style; 0 means a renovation removed it */
	cribStyle: number | undefined;
	/** Children already living there */
	children: number;
}

export interface BabyQuestionRequirement {
	id: string;
	label: string;
	met: boolean;
	/** Where the farmer is now, or how to meet it */
	detail: string;
}

export interface BabyQuestionStatus {
	requirements: BabyQuestionRequirement[];
	eligible: boolean;
}

export function babyQuestionStatus(
	spouse: Friendship | undefined,
	today: GameDate,
	home: BabyQuestionHome,
): BabyQuestionStatus {
	const married = spouse?.status === Status.Married;
	const roommates = spouse?.roommateMarriage === true;
	const wedding = spouse?.weddingDate;
	const daysMarried = wedding ? totalDays(today) - totalDays(wedding) : null;
	const hearts = spouse ? spouse.hearts : 0;

	const requirements: BabyQuestionRequirement[] = [
		{
			id: "married",
			label: "Married to a villager",
			met: married,
			detail: married ? `Married to ${spouse?.name}` : "No spouse yet",
		},
		{
			id: "not-roommates",
			label: "Not roommates",
			met: married && !roommates,
			detail: roommates
				? "Roommates can't have children"
				: married
					? "A real marriage"
					: "Needs a spouse",
		},
		{
			id: "hearts",
			label: "10 hearts with the spouse",
			met: married && (spouse?.points ?? 0) >= BABY_QUESTION_POINTS,
			detail: married ? `${hearts} of 10 hearts` : "Needs a spouse",
		},
		{
			id: "days-married",
			label: `Married ${BABY_QUESTION_DAYS_MARRIED}+ days`,
			met: daysMarried !== null && daysMarried >= BABY_QUESTION_DAYS_MARRIED,
			detail: !married
				? "Needs a spouse"
				: daysMarried === null
					? "The save has no wedding date"
					: `Married ${daysMarried} ${daysMarried === 1 ? "day" : "days"}`,
		},
		{
			id: "nursery",
			label: "Farmhouse upgraded twice (nursery)",
			met: home.upgradeLevel >= NURSERY_UPGRADE_LEVEL,
			detail: `House upgrade ${home.upgradeLevel} of ${NURSERY_UPGRADE_LEVEL}`,
		},
		{
			id: "crib",
			label: "Crib still in the nursery",
			met: home.cribStyle !== 0,
			detail:
				home.cribStyle === 0 ? "A renovation removed it" : "The crib is there",
		},
		{
			id: "children",
			label: `Fewer than ${MAX_CHILDREN} children`,
			met: home.children < MAX_CHILDREN,
			detail: `${home.children} ${home.children === 1 ? "child" : "children"} at home`,
		},
		{
			id: "not-pregnant",
			label: "Not already pregnant",
			met: !spouse?.pregnant,
			detail: spouse?.pregnant
				? "A baby is already on the way"
				: "Not expecting",
		},
	];

	return { requirements, eligible: requirements.every((r) => r.met) };
}

/** What the question needs to know about a player's home (the farmhouse, or their cabin) */
export function readHome(
	home: GameLocation | undefined,
	upgradeLevel: number,
): BabyQuestionHome {
	const characters = home?.characters;
	const npcs =
		characters && typeof characters === "object" ? [characters.NPC].flat() : [];
	return {
		upgradeLevel,
		cribStyle: home?.cribStyle,
		children: npcs.filter(
			(npc) =>
				(npc as { "@_xsi:type"?: string } | undefined)?.["@_xsi:type"] ===
				"Child",
		).length,
	};
}
