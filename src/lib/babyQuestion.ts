/**
    When a spouse can ask "Do you want to have a baby?".

    From the wiki's Children and Random Events pages: the question is a
    random farm event picked overnight, with about a 5% chance each night
    once every requirement below is met. The wiki also says the farmer must
    be sleeping at home; that isn't in the save, so it isn't checked here.

    The wiki's Random Events page words the children rule as "aren't already
    having a child, and have no children or one child at the toddler age".

    One rule isn't on those pages and comes from the game's own pregnancy
    check: a roommate can't have children. The toddler cutoff (55 days old,
    the end of the 14 + 14 + 28 day stages) is also from the game, not the wiki.
*/
import { addDays, dateInRange, type GameDate, totalDays } from "$lib/calendar";
import type { Friendship } from "$lib/proxies/Friendship.svelte";
import {
	type FarmerFriendshipItem,
	type GameLocation,
	type Save,
	Status,
} from "$types/save";

/** 10 hearts of 250 points */
export const BABY_QUESTION_POINTS = 2500;
export const BABY_QUESTION_DAYS_MARRIED = 7;
/** The second farmhouse upgrade, which adds the nursery */
export const NURSERY_UPGRADE_LEVEL = 2;
/** A child is a toddler once they've been through the three baby stages (14 + 14 + 28 days) */
export const TODDLER_DAYS_OLD = 55;
/** The wiki's chance per night, once eligible */
export const BABY_QUESTION_CHANCE = 0.05;

export interface BabyQuestionHome {
	/** The house's upgrade level (0 to 3) */
	upgradeLevel: number;
	/** The crib's style; 0 means a renovation removed it */
	cribStyle: number | undefined;
	/** Children already living there */
	children: number;
	/** How many of them are toddlers */
	toddlers: number;
}

export interface BabyQuestionRequirement {
	id: string;
	label: string;
	met: boolean;
	/** Where the farmer is now, or how to meet it */
	detail: string;
}

export interface BabyQuestionStatus {
	/** The question the panel asks, e.g. "Will Abigail ask about a baby?" */
	title: string;
	requirements: BabyQuestionRequirement[];
	eligible: boolean;
	/** Anything worth saying under the result */
	note?: string;
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
			label: "No children, or one who is a toddler",
			met: home.children === 0 || (home.children === 1 && home.toddlers === 1),
			detail:
				home.children === 0
					? "No children yet"
					: home.children === 1
						? home.toddlers === 1
							? "One child, a toddler"
							: "One child, not a toddler yet"
						: `${home.children} children at home`,
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

	return {
		title: `Will ${spouse?.name ?? "a spouse"} ask about a baby?`,
		requirements,
		eligible: requirements.every((r) => r.met),
	};
}

/** A farmer's marriage to another player, kept in the save's `farmerFriendships` */
export interface PlayerMarriage {
	/** The other player's unique ID */
	partnerId: string;
	/** The pair's friendship data in the save: where a pregnancy is kept too */
	friendship: Friendship_;
}

type Friendship_ = FarmerFriendshipItem["value"]["Friendship"];

/** The player `farmerId` is married to, if any */
export function playerMarriageOf(
	farmerId: number | string,
	pairs: Save["farmerFriendships"] | undefined,
): PlayerMarriage | undefined {
	if (!pairs) return undefined;
	const me = String(farmerId);
	for (const { key, value } of [pairs.item].flat()) {
		const { Farmer1, Farmer2 } = key.FarmerPair;
		const friendship = value.Friendship;
		if (friendship.Status !== Status.Married) continue;
		if (String(Farmer1) === me) {
			return { partnerId: String(Farmer2), friendship };
		}
		if (String(Farmer2) === me) {
			return { partnerId: String(Farmer1), friendship };
		}
	}
	return undefined;
}

/** The day a married couple's baby is born, or `null` when they aren't expecting */
export function playerDueDate(marriage: PlayerMarriage): GameDate | null {
	const due = marriage.friendship.NextBirthingDate;
	return due
		? dateInRange({ year: due.Year, season: due.Season, day: due.DayOfMonth })
		: null;
}

/**
    Make a married couple expecting, due `days` days after `today` (14 in-game),
    or end it. Their friendship in the save is where the game keeps the due date,
    as it does for a villager spouse.
*/
export function setPlayerPregnant(
	marriage: PlayerMarriage,
	pregnant: boolean,
	today: GameDate,
	days = 14,
) {
	if (!pregnant) {
		delete marriage.friendship.NextBirthingDate;
		return;
	}
	const due = addDays(today, Math.max(Math.trunc(days), 1));
	marriage.friendship.NextBirthingDate = {
		Year: due.year,
		DayOfMonth: due.day,
		Season: due.season,
	};
}

/**
    When two married players are asked about a baby. The wiki words it
    differently for them: a home is eligible if it belongs to one of the two,
    has the nursery and doesn't already have two children. There are no
    hearts, and no wait for a child to be a toddler. The crib rule is from the
    Children page, which doesn't say it only applies to villagers.
*/
export function playerBabyQuestionStatus(
	you: { name: string; home: BabyQuestionHome },
	partner: { name: string; home: BabyQuestionHome } | undefined,
	marriage: PlayerMarriage | undefined,
): BabyQuestionStatus {
	const married = partner !== undefined && marriage !== undefined;
	// Each step narrows the homes, so every box agrees with the one before it
	const homes = married ? [you.home, partner.home] : [];
	const withNursery = homes.filter(
		(h) => h.upgradeLevel >= NURSERY_UPGRADE_LEVEL,
	);
	const withCrib = withNursery.filter((h) => h.cribStyle !== 0);
	const withRoom = withCrib.filter((h) => h.children < 2);
	const expecting = marriage?.friendship.NextBirthingDate !== undefined;

	const requirements: BabyQuestionRequirement[] = [
		{
			id: "married",
			label: "Married to another player",
			met: married,
			detail: married
				? `Married to ${partner.name}`
				: "Not married to a player",
		},
		{
			id: "nursery",
			label: "One of your homes has the nursery",
			met: withNursery.length > 0,
			detail: married
				? `House upgrade: ${you.name} ${you.home.upgradeLevel}, ${partner.name} ${partner.home.upgradeLevel} (needs ${NURSERY_UPGRADE_LEVEL})`
				: "Needs a marriage",
		},
		{
			id: "crib",
			label: "Crib still in that home",
			met: withCrib.length > 0,
			detail:
				withNursery.length === 0
					? "Needs the nursery"
					: withCrib.length > 0
						? "The crib is there"
						: "A renovation removed it",
		},
		{
			id: "children",
			label: "That home has fewer than 2 children",
			met: withRoom.length > 0,
			detail:
				withCrib.length === 0
					? "Needs the nursery and crib"
					: withRoom.length > 0
						? "There's room for a child"
						: "Already has 2 children",
		},
		{
			id: "not-pregnant",
			label: "Not already having a child",
			met: !expecting,
			detail: expecting ? "A baby is already on the way" : "Not expecting",
		},
	];

	return {
		title: partner
			? `Will ${you.name} and ${partner.name} be asked about a baby?`
			: "Will two married players be asked about a baby?",
		requirements,
		eligible: requirements.every((r) => r.met),
		note: "One of the two players is asked at random, and both must say yes.",
	};
}

/** What the question needs to know about a player's home (the farmhouse, or their cabin) */
export function readHome(
	home: GameLocation | undefined,
	upgradeLevel: number,
): BabyQuestionHome {
	const characters = home?.characters;
	const npcs =
		characters && typeof characters === "object" ? [characters.NPC].flat() : [];
	const children = (npcs as unknown as RawNPC[]).filter(
		(npc) => npc?.["@_xsi:type"] === "Child",
	);
	return {
		upgradeLevel,
		cribStyle: home?.cribStyle,
		children: children.length,
		toddlers: children.filter(
			(child) => Number(child.daysOld) >= TODDLER_DAYS_OLD,
		).length,
	};
}

/** A character in the farmhouse; `daysOld` is a child's age in days */
type RawNPC = { "@_xsi:type"?: string; daysOld?: number | string };
