import {
	formatDate,
	MAX_YEAR,
	SEASONS,
	totalDays,
	type GameDate,
} from "../calendar.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { record } from "./saved-collections.ts";

/** Saved eligibility facts, adapted from PR #241's baby-question presentation.
 * Game references: NPC.canGetPregnant, Utility.playersCanGetPregnantHere and
 * Child.dayUpdate. Runtime sleeping/location, invisibility and random overnight
 * event selection are deliberately not inferred from a save-file projection. */
export interface PregnancyRequirement {
	readonly label: string;
	readonly met: boolean | undefined;
	readonly detail: string;
}
export interface PregnancyView {
	readonly farmerId: string;
	readonly targetKey?: string;
	readonly spouse?: string;
	readonly kind: "none" | "villager" | "player";
	readonly supported: boolean;
	readonly reason?: string;
	readonly expecting: boolean;
	readonly daysUntilBirth?: number;
	readonly dueDate?: string;
	readonly eligible: boolean;
	readonly requirements: readonly PregnancyRequirement[];
}
const list = (raw: unknown): unknown[] =>
	raw === undefined || raw === null || raw === ""
		? []
		: Array.isArray(raw)
			? raw
			: [raw];
const whole = (raw: unknown): raw is number =>
	typeof raw === "number" && Number.isSafeInteger(raw);
const identity = (raw: unknown) =>
	typeof raw === "string" && raw.length > 0
		? raw
		: whole(raw)
			? String(raw)
			: undefined;

/** Reject malformed dates rather than silently normalizing a saved pregnancy. */
export function pregnancyDate(
	year: unknown,
	season: unknown,
	day: unknown,
): GameDate | undefined {
	const checkedSeason = SEASONS.find((candidate) => candidate === season);
	return whole(year) &&
		year >= 1 &&
		year <= MAX_YEAR &&
		checkedSeason &&
		whole(day) &&
		day >= 1 &&
		day <= 28
		? { year, season: checkedSeason, day }
		: undefined;
}
export function todayForPregnancy(
	document: SaveDocument,
): GameDate | undefined {
	const game: Record<string, unknown> = document.SaveGame;
	const season = whole(game.currentSeason)
		? SEASONS[game.currentSeason]
		: game.currentSeason;
	return pregnancyDate(game.year, season, game.dayOfMonth);
}

interface HomeFacts {
	readonly level?: number;
	readonly crib?: number;
	readonly children?: number;
	readonly toddlers?: number;
}
function homeFacts(
	document: SaveDocument,
	owner: Record<string, unknown>,
): HomeFacts {
	const locations: Record<string, unknown>[] = [];
	// Cabins live inside placed buildings, while the host house is a top-level
	// location. Search both without choosing a winner when identities collide.
	function visit(raw: unknown) {
		if (!record(raw)) return;
		locations.push(raw);
		for (const building of list(
			record(raw.buildings) ? raw.buildings.Building : undefined,
		))
			if (record(building)) visit(building.indoors);
	}
	for (const location of list(
		record(document.SaveGame.locations)
			? document.SaveGame.locations.GameLocation
			: undefined,
	))
		visit(location);
	const homeName =
		typeof owner.homeLocation === "string" ? owner.homeLocation : undefined;
	const homes = locations.filter(
		(location) =>
			location.name === homeName || location.uniqueName === homeName,
	);
	const home = homeName && homes.length === 1 ? homes[0] : undefined;
	const level = whole(owner.houseUpgradeLevel)
		? owner.houseUpgradeLevel
		: undefined;
	if (!home) return { level };
	const characters = home.characters;
	if (characters !== undefined && characters !== "" && !record(characters))
		return { level };
	const npcs = list(record(characters) ? characters.NPC : undefined);
	if (npcs.some((npc) => !record(npc))) return { level };
	const children = npcs.filter(
		(npc) => record(npc) && npc["@_xsi:type"] === "Child",
	);
	const ages = children.map((child) =>
		record(child) && whole(child.daysOld) ? child.daysOld : undefined,
	);
	return {
		level,
		crib: whole(home.cribStyle) ? home.cribStyle : undefined,
		children: children.length,
		toddlers: ages.some((age) => age === undefined)
			? undefined
			: ages.filter((age) => age !== undefined && age >= 55).length,
	};
}
function homeRequirements(homes: HomeFacts[]): PregnancyRequirement[] {
	// Requirements narrow the same candidate homes successively. A crib in one
	// house and spare room in another cannot together make a player couple eligible.
	const nursery = homes.filter(
		(home) => home.level !== undefined && home.level >= 2,
	);
	const cribs = nursery.filter(
		(home) => home.crib !== undefined && home.crib > 0,
	);
	const room = cribs.filter(
		(home) =>
			home.children !== undefined &&
			home.children < 2 &&
			home.toddlers === home.children,
	);
	const known = homes.every(
		(home) =>
			home.level !== undefined &&
			home.crib !== undefined &&
			home.children !== undefined &&
			home.toddlers !== undefined,
	);
	return [
		{
			label: "A home has the nursery",
			met: nursery.length > 0 ? true : known ? false : undefined,
			detail: "Requires house upgrade 2 or higher.",
		},
		{
			label: "Crib still in that home",
			met: cribs.length > 0 ? true : known ? false : undefined,
			detail:
				"The nursery must have a crib; removed or unsupported cribs do not count.",
		},
		{
			label: "Under two children there, all toddlers",
			met: room.length > 0 ? true : known ? false : undefined,
			detail: "Every existing child in that home must be at least 55 days old.",
		},
	];
}

/** Engine-only target resolution. The mutable saved record stays behind the
 * projection boundary; queued writes must resolve and compare this key again. */
export function inspectPregnancy(document: SaveDocument, farmerId: string) {
	const all: Record<string, unknown>[] = farmers(document).flatMap((owner) =>
		record(owner) ? [owner] : [],
	);
	const matches = all.filter(
		(owner) => identity(owner.UniqueMultiplayerID) === farmerId,
	);
	const owner = matches.length === 1 ? matches[0] : undefined;
	const today = todayForPregnancy(document);
	const empty: PregnancyView = {
		farmerId,
		kind: "none",
		supported: false,
		expecting: false,
		eligible: false,
		requirements: [],
		reason: owner
			? "No unambiguous saved marriage is available."
			: "Choose a farmer with a unique saved identifier.",
	};
	if (!owner) return { view: empty };
	const dictionary = owner.friendshipData;
	const friendships = list(record(dictionary) ? dictionary.item : undefined);
	const spouses = friendships.flatMap((entry) =>
		record(entry) &&
		record(entry.key) &&
		typeof entry.key.string === "string" &&
		record(entry.value) &&
		record(entry.value.Friendship) &&
		entry.value.Friendship.Status === "Married"
			? [{ name: entry.key.string, saved: entry.value.Friendship }]
			: [],
	);
	const game: Record<string, unknown> = document.SaveGame;
	const pairs = list(
		record(game.farmerFriendships) ? game.farmerFriendships.item : undefined,
	);
	const playerSpouses = pairs.flatMap((entry) => {
		if (
			!record(entry) ||
			!record(entry.key) ||
			!record(entry.key.FarmerPair) ||
			!record(entry.value) ||
			!record(entry.value.Friendship) ||
			entry.value.Friendship.Status !== "Married"
		)
			return [];
		const pair = entry.key.FarmerPair;
		const first = identity(pair.Farmer1),
			second = identity(pair.Farmer2);
		const partner =
			first === farmerId ? second : second === farmerId ? first : undefined;
		return partner && partner !== farmerId
			? [{ partner, saved: entry.value.Friendship }]
			: [];
	});
	if (spouses.length + playerSpouses.length !== 1) return { view: empty };
	const npc = spouses[0],
		pair = playerSpouses[0];
	// A dictionary with the same villager key twice is ambiguous even when only
	// one duplicate claims marriage. Never use its status to pick a writable winner.
	if (
		npc &&
		friendships.filter(
			(entry) =>
				record(entry) && record(entry.key) && entry.key.string === npc.name,
		).length !== 1
	)
		return { view: empty };
	// Player-pair dictionary keys are unordered identities. Duplicates with a
	// different status are still ambiguous and cannot authorize a pregnancy write.
	if (
		pair &&
		pairs.filter((entry) => {
			if (!record(entry) || !record(entry.key) || !record(entry.key.FarmerPair))
				return false;
			const key = entry.key.FarmerPair;
			const first = identity(key.Farmer1),
				second = identity(key.Farmer2);
			return (
				(first === farmerId && second === pair.partner) ||
				(second === farmerId && first === pair.partner)
			);
		}).length !== 1
	)
		return { view: empty };
	const partners = pair
		? all.filter(
				(candidate) => identity(candidate.UniqueMultiplayerID) === pair.partner,
			)
		: [];
	const partner = partners.length === 1 ? partners[0] : undefined;
	const saved = npc?.saved ?? pair?.saved;
	if (!saved || (pair && !partner)) return { view: empty };
	const kind: PregnancyView["kind"] = npc ? "villager" : "player";
	const spouse =
		npc?.name ??
		(typeof partner?.name === "string" ? partner.name : "Other farmer");
	const targetKey = JSON.stringify([kind, npc?.name ?? pair?.partner]);
	const rawDate = saved.NextBirthingDate;
	const absent =
		rawDate === undefined ||
		rawDate === null ||
		rawDate === "" ||
		(record(rawDate) &&
			(rawDate["@_xsi:nil"] === true || rawDate["@_xsi:nil"] === "true"));
	// Nil marks an absent WorldDate even if stale coordinates remain attached.
	const due =
		!absent && record(rawDate)
			? pregnancyDate(rawDate.Year, rawDate.Season, rawDate.DayOfMonth)
			: undefined;
	const supported = today !== undefined && (absent || due !== undefined);
	const requirements: PregnancyRequirement[] = [
		{
			label: npc ? "Married to a villager" : "Married to another player",
			met: true,
			detail: `Married to ${spouse}.`,
		},
		...homeRequirements([
			homeFacts(document, owner),
			...(partner ? [homeFacts(document, partner)] : []),
		]),
	];
	if (npc) {
		const wedding = record(saved.WeddingDate)
			? pregnancyDate(
					saved.WeddingDate.Year,
					saved.WeddingDate.Season,
					saved.WeddingDate.DayOfMonth,
				)
			: undefined;
		const marriedDays =
			today && wedding ? totalDays(today) - totalDays(wedding) : undefined;
		requirements.splice(
			1,
			0,
			{
				label: "Not roommates or divorcing",
				met:
					saved.RoommateMarriage === undefined
						? undefined
						: saved.RoommateMarriage === false &&
							owner.divorceTonight !== true &&
							npc.name !== "Krobus",
				detail:
					"Roommates and spouses divorcing tonight cannot receive the question.",
			},
			{
				label: "10 hearts with the spouse",
				met: whole(saved.Points) ? saved.Points >= 2500 : undefined,
				detail: "Requires at least 2,500 friendship points.",
			},
			{
				label: "Married at least seven days",
				met: marriedDays === undefined ? undefined : marriedDays >= 7,
				detail:
					marriedDays === undefined
						? "Wedding date unavailable."
						: `Married ${marriedDays} days.`,
			},
		);
	}
	requirements.push({
		label: "Not already expecting",
		met: absent,
		detail: due
			? `Due ${formatDate(due)}.`
			: absent
				? "No baby is on the way."
				: "The saved due date is unsupported.",
	});
	const view: PregnancyView = {
		farmerId,
		targetKey,
		spouse,
		kind,
		supported,
		expecting: !absent,
		daysUntilBirth:
			due && today ? totalDays(due) - totalDays(today) : undefined,
		dueDate: due ? formatDate(due) : undefined,
		eligible: requirements.every((requirement) => requirement.met === true),
		requirements,
		reason: supported
			? undefined
			: "The saved date or pregnancy due date is unsupported.",
	};
	return { view, saved, today };
}

/** Publish only intuitive eligibility and due-date facts, never saved references. */
export const readPregnancy = (
	document: SaveDocument,
	farmerId: string,
): PregnancyView => inspectPregnancy(document, farmerId).view;
