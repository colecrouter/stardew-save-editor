import catalog from "../../../generated/progress.json";
import {
	farmers,
	type Farmer,
	type Location,
	type SaveDocument,
} from "./domain.ts";
import { skillDefinitions } from "./character-data.ts";
import { isKnownLocation } from "./saved-types.ts";
import { readRecipes, type RecipeFarmerView } from "./recipe-operations.ts";
import { recipeProgress } from "./progress.ts";
import { extraAchievementDiagnostics } from "./achievement-diagnostics.ts";

export type ProgressSection =
	| "recipes"
	| "character"
	| "relationships"
	| "buildings";
export interface ProgressRequirement {
	// Collection IDs distinguish same-name objects; named rules use their name.
	id?: string;
	name: string;
	status: "complete" | "missing" | "unknown";
	value?: number;
	target?: number;
	learned?: boolean;
}
export interface ProgressCategory {
	id: string;
	label: string;
	weight: number;
	completed: number;
	total: number;
	unknown: number;
	requirements: ProgressRequirement[];
	section?: ProgressSection;
	note?: string;
	// Lower and upper bounds refer to the fraction of this category's weight.
	// Binary categories grant nothing until every requirement is satisfied.
	lower: number;
	upper: number;
}
export interface ProgressAchievement {
	id: number;
	name: string;
	description: string;
	recorded?: boolean;
	value?: number;
	target?: number;
	evidence?: string;
	status: "Requirements satisfied" | "In progress" | "Unable to determine";
}
export interface ProgressFarmer {
	farmerId: string;
	name: string;
	eligible?: boolean;
	categories: ProgressCategory[];
	achievements: ProgressAchievement[];
}
export interface ProgressView {
	farmers: ProgressFarmer[];
	shared: ProgressCategory[];
	leaders: { category: ProgressCategory; farmer?: string }[];
	waivers?: number;
	lower: number;
	upper: number;
}

const integer = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value);
/** Dictionary absence and duplicate keys are uncertainty, never an empty result.
 * Stats dictionaries use ordinal-ignore-case; ordinary collection keys do not. */
function entry<K extends string | number, V>(
	entries: readonly { key: K; value: V }[] | undefined,
	key: K,
	ignoreCase = false,
) {
	const matches = entries?.filter((row) =>
		ignoreCase
			? String(row.key).toLowerCase() === String(key).toLowerCase()
			: row.key === key,
	);
	return {
		readable: matches !== undefined && matches.length <= 1,
		present: (matches?.length ?? 0) > 0,
		value: matches?.[0]?.value,
	};
}
/** Keep missing evidence distinct from a measured result below the threshold. */
function requirement(
	name: string,
	value: number | undefined,
	target: number,
): ProgressRequirement {
	return {
		name,
		value,
		target,
		status:
			value === undefined
				? "unknown"
				: value >= target
					? "complete"
					: "missing",
	};
}
/** Fractional categories count satisfied requirements; binary categories need
 * the entire list. Unknown requirements bound both possible outcomes. */
function category(
	id: string,
	label: string,
	weight: number,
	requirements: ProgressRequirement[],
	section?: ProgressSection,
	binary = false,
): ProgressCategory {
	const completed = requirements.filter(
		(row) => row.status === "complete",
	).length;
	const unknown = requirements.filter((row) => row.status === "unknown").length;
	const total = requirements.length;
	return {
		id,
		label,
		weight,
		requirements,
		completed,
		unknown,
		total,
		section,
		lower: binary ? Number(completed === total) : completed / total,
		upper: binary
			? Number(completed + unknown === total)
			: (completed + unknown) / total,
	};
}

function collections(farmer: Farmer) {
	// Shipping and fishing completion use membership, not a positive counter.
	// Fishing keys are qualified object IDs; shipping keys are unqualified IDs.
	const shipping = category(
		"shipping",
		"Produce & forage shipped",
		15,
		catalog.shipping.map((item) => {
			const saved = entry(farmer.basicShipped, item.id);
			return {
				...requirement(
					item.name,
					saved.readable ? Number(saved.present) : undefined,
					1,
				),
				id: item.id,
			};
		}),
	);
	const fishing = category(
		"fishing",
		"Fish caught",
		10,
		catalog.fish.map((item) => {
			const saved = entry(farmer.fishCaught, `(O)${item.id}`);
			return requirement(
				item.name,
				saved.readable ? Number(saved.present) : undefined,
				1,
			);
		}),
	);
	return [shipping, fishing];
}
function friendships(farmer: Farmer) {
	// Perfection uses catalog membership and a fixed 8/10-heart threshold,
	// independently of dating/marriage status. Children are outside this list.
	return category(
		"friends",
		"Great friends",
		11,
		catalog.friends.map((friend) => {
			const saved = entry(farmer.friendshipData, friend.name);
			const points = saved.value?.Points;
			return requirement(
				friend.name,
				saved.readable && (!saved.present || integer(points))
					? (points ?? 0)
					: undefined,
				friend.points,
			);
		}),
		"relationships",
	);
}
function skills(farmer: Farmer) {
	const requirements = skillDefinitions.map((skill) =>
		requirement(
			skill.label,
			integer(farmer[skill.levelField]) ? farmer[skill.levelField] : undefined,
			10,
		),
	);
	const result = category(
		"skills",
		"Farmer level",
		5,
		requirements,
		"character",
	);
	// Farmer.Level divides the six saved base levels by two (integer division).
	// Luck normally stays zero; do not derive levels from XP or temporary buffs.
	const levels = [
		...skillDefinitions.map((skill) => farmer[skill.levelField]),
		farmer.luckLevel,
	];
	const level = levels.every((value) => integer(value) && value >= 0)
		? Math.min(
				25,
				Math.floor(
					levels.reduce<number>((sum, value) => sum + (value ?? 0), 0) / 2,
				),
			)
		: undefined;
	result.lower = level === undefined ? 0 : level / 25;
	result.upper = level === undefined ? 1 : level / 25;
	return result;
}
function monsters(farmer: Farmer) {
	const counts = farmer.stats?.specificMonstersKilled;
	return category(
		"monsters",
		"Monster Slayer Hero",
		10,
		catalog.monsters.map((goal) => {
			const values = goal.targets.map((target) => entry(counts, target, true));
			const readable = values.every(
				(saved) => saved.readable && (!saved.present || integer(saved.value)),
			);
			return requirement(
				goal.name,
				readable
					? values.reduce((sum, saved) => sum + (saved.value ?? 0), 0)
					: undefined,
				goal.count,
			);
		}),
		undefined,
		true,
	);
}
function stardrops(document: SaveDocument, farmer: Farmer) {
	// Match Utility.foundAllStardrops: received, tomorrow and the active mailbox
	// all count. A tomorrow letter can carry the game's no-letter suffix.
	// Game1.mailbox is the active player's mailbox. Diagnose this save as loaded
	// by its host, including SaveGame's obsolete mailbox migration when needed.
	// Engine callers can supply unsupported baselines before codec round-tripping.
	// Treat a malformed mail container as unreadable instead of failing publication.
	const received = Array.isArray(farmer.mailReceived)
		? farmer.mailReceived
		: undefined;
	const tomorrow = Array.isArray(farmer.mailForTomorrow)
		? farmer.mailForTomorrow
		: undefined;
	const hostMailbox = Array.isArray(document.SaveGame.player.mailbox)
		? document.SaveGame.player.mailbox
		: undefined;
	const legacyMailbox = Array.isArray(document.SaveGame.mailbox)
		? document.SaveGame.mailbox
		: undefined;
	const mailbox = hostMailbox?.length
		? hostMailbox
		: (legacyMailbox ?? hostMailbox);
	const mail = (key: string): number | undefined => {
		if (
			received?.includes(key) ||
			tomorrow?.some((value) => value === key || value === `${key}%&NL&%`) ||
			mailbox?.includes(key)
		)
			return 1;
		return received !== undefined &&
			tomorrow !== undefined &&
			mailbox !== undefined
			? 0
			: undefined;
	};
	const sources = [
		["Stardew Valley Fair", "CF_Fair"],
		["Master Angler", "CF_Fish"],
		["The Mines, floor 100", "CF_Mines"],
		["Krobus", "CF_Sewer"],
		["Museum collection", "museumComplete"],
		["Spouse", "CF_Spouse"],
		["Old Master Cannoli", "CF_Statue"],
	] as const;
	const requirements = sources.map(([name, key]) => {
		let value = mail(key);
		if (key === "CF_Mines" && value !== 1) {
			const chest = entry(farmer.chestConsumedLevels, 100);
			if (chest.readable && chest.value === true) value = 1;
			else if (!chest.readable) value = undefined;
		}
		return requirement(name, value, 1);
	});
	const result = category(
		"stardrops",
		"Found all Stardrops",
		10,
		requirements,
		undefined,
		true,
	);
	// The historical completion marker is an explicit alternative to the seven
	// individual flags. It does not authorize inventing those missing flags.
	if (received?.includes("gotMaxStamina")) {
		result.lower = result.upper = 1;
		result.note =
			"The game's all-Stardrops completion marker is present, independently of the individual source flags.";
	} else if (received === undefined) result.upper = 1;
	return result;
}

function buildings(document: SaveDocument) {
	const complete = new Set<string>();
	let readable = document.SaveGame.locations !== undefined;
	const seen = new Set<object>();
	function visit(location: Location | null) {
		if (!isKnownLocation(location) || seen.has(location)) {
			readable = false;
			return;
		}
		seen.add(location);
		// The game counts completed buildings worldwide, including interiors.
		// Opaque locations/buildings can hide a required type, so absent types
		// remain uncertain if any part of the world could not be inspected.
		for (const building of location.buildings ?? []) {
			if (!building || building.$type === "$unknown") {
				readable = false;
				continue;
			}
			if (
				typeof building.buildingType !== "string" ||
				!integer(building.daysOfConstructionLeft)
			)
				readable = false;
			else if (building.daysOfConstructionLeft <= 0)
				complete.add(building.buildingType);
			if (building.indoors) visit(building.indoors);
		}
	}
	for (const location of document.SaveGame.locations ?? []) visit(location);
	const built = (name: string) =>
		requirement(name, complete.has(name) ? 1 : readable ? 0 : undefined, 1);
	return [
		category(
			"obelisks",
			"Obelisks",
			4,
			[
				"Earth Obelisk",
				"Water Obelisk",
				"Desert Obelisk",
				"Island Obelisk",
			].map(built),
			"buildings",
		),
		category("clock", "Golden Clock", 10, [built("Gold Clock")], "buildings"),
	];
}

function achievements(
	document: SaveDocument,
	farmer: Farmer,
	categories: ProgressCategory[],
): ProgressAchievement[] {
	const diagnostics = extraAchievementDiagnostics(document, farmer);
	const add = (
		id: number,
		value: number | undefined,
		target: number,
		unknown = 0,
	) => diagnostics.set(id, { value, target, unknown });
	// These are current requirements, independent of the retained achievement IDs.
	// An earned award remains recorded after progress is edited backward.
	for (const [id, target] of [
		[0, 15000],
		[1, 50000],
		[2, 250000],
		[3, 1000000],
		[4, 10000000],
	] as const)
		add(
			id,
			integer(farmer.totalMoneyEarned) ? farmer.totalMoneyEarned : undefined,
			target,
		);
	for (const [categoryId, milestones] of [
		[
			"cooking",
			[
				[15, 10],
				[16, 25],
				[17, 0],
			],
		],
		[
			"crafting",
			[
				[20, 15],
				[21, 30],
				[22, 0],
			],
		],
		[
			"fishing",
			[
				[24, 10],
				[25, 24],
				[26, 0],
			],
		],
		["shipping", [[34, 0]]],
	] as const) {
		const progress = categories.find((row) => row.id === categoryId)!;
		for (const [id, target] of milestones)
			add(id, progress.completed, target || progress.total, progress.unknown);
	}
	// Friendship achievements inspect every saved relationship, including children.
	// Unlike Perfection they are not restricted to the vanilla villager catalog.
	for (const [id, points, target] of [
		[6, 1250, 1],
		[7, 2500, 1],
		[9, 2500, 8],
		[11, 1250, 4],
		[12, 1250, 10],
		[13, 1250, 20],
	] as const) {
		const entries = farmer.friendshipData;
		const readable =
			entries?.every((saved) => integer(saved.value?.Points)) &&
			new Set(entries.map((saved) => saved.key)).size === entries.length;
		add(
			id,
			readable
				? entries?.filter((saved) => (saved.value?.Points ?? 0) >= points)
						.length
				: undefined,
			target,
		);
	}
	// House milestones describe upgrades already reached; cellar level 3 also
	// meets the second-upgrade requirement even though Stats awards it at level 2.
	add(
		18,
		integer(farmer.houseUpgradeLevel) ? farmer.houseUpgradeLevel : undefined,
		1,
	);
	add(
		19,
		integer(farmer.houseUpgradeLevel) ? farmer.houseUpgradeLevel : undefined,
		2,
	);
	const quests = entry(farmer.stats?.Values, "questsCompleted", true);
	const questCount =
		quests.readable && (!quests.present || integer(quests.value))
			? (quests.value ?? 0)
			: undefined;
	add(29, questCount, 10);
	add(30, questCount, 40);
	const fishingCounts = catalog.fish.map((fish) =>
		entry(farmer.fishCaught, `(O)${fish.id}`),
	);
	add(
		27,
		fishingCounts.every(
			(saved) =>
				saved.readable &&
				(!saved.present || (integer(saved.value?.[0]) && saved.value[0] >= 0)),
		)
			? fishingCounts.reduce((sum, saved) => sum + (saved.value?.[0] ?? 0), 0)
			: undefined,
		100,
	);
	// Future catalog awards without a matching evaluator remain uncertain.
	// Neither missing evidence nor current progress changes saved membership.
	return catalog.achievements.map((award) => {
		const progress = diagnostics.get(award.id);
		const recorded = !Array.isArray(farmer.achievements)
			? undefined
			: farmer.achievements.includes(award.id);
		return {
			...award,
			recorded,
			value: progress?.value,
			target: progress?.target,
			evidence: progress?.evidence,
			status: !progress
				? "Unable to determine"
				: progress.value === undefined
					? "Unable to determine"
					: progress.value >= progress.target
						? "Requirements satisfied"
						: progress.value + (progress.unknown ?? 0) >= progress.target
							? "Unable to determine"
							: "In progress",
		};
	});
}

/** Pure projection of the supported vanilla completion rules. Reads never award
 * achievements, normalize saved counters, deliver mail or trigger endgame events.
 * Rule owners: Utility.percentGameComplete/get*Percent/foundAllStardrops,
 * Farmer.Level, Stats.checkFor*Achievements and AdventureGuild.IsComplete. */
export function readProgress(
	document: SaveDocument,
	recipes: RecipeFarmerView[] = readRecipes(document),
): ProgressView {
	const all = farmers(document);
	const players: ProgressFarmer[] = all.map((farmer, index) => {
		const farmerId = farmer.UniqueMultiplayerID?.toString() ?? "";
		const recipe = recipes[index]!;
		const categories = [
			...collections(farmer),
			friendships(farmer),
			skills(farmer),
			monsters(farmer),
			stardrops(document, farmer),
			...(["cooking", "crafting"] as const).map((kind) => {
				const progress = recipeProgress(recipe, kind);
				return category(
					kind,
					kind === "cooking" ? "Cooking recipes made" : "Crafting recipes made",
					10,
					progress.requirements,
					"recipes",
				);
			}),
		];
		// Duplicate/missing player IDs cannot select a reliable farmer in the UI.
		if (!recipe.supported)
			for (const progress of categories) {
				progress.lower = 0;
				progress.upper = 1;
				progress.completed = 0;
				progress.unknown = progress.total;
				progress.requirements = progress.requirements.map((row) => ({
					...row,
					status: "unknown",
				}));
			}
		return {
			farmerId,
			name: farmer.name || "Unnamed farmer",
			eligible: index === 0 ? true : farmer.isCustomized,
			categories,
			achievements: achievements(document, farmer, categories),
		};
	});
	const shared = [
		...buildings(document),
		category("walnuts", "Golden Walnuts found", 5, [
			requirement(
				"Golden Walnuts found",
				integer(document.SaveGame.goldenWalnutsFound) &&
					document.SaveGame.goldenWalnutsFound >= 0
					? document.SaveGame.goldenWalnutsFound
					: undefined,
				130,
			),
		]),
	];
	const walnuts = shared.find((row) => row.id === "walnuts")!;
	const found = document.SaveGame.goldenWalnutsFound;
	walnuts.lower = integer(found) && found >= 0 ? Math.min(found, 130) / 130 : 0;
	walnuts.upper = integer(found) && found >= 0 ? walnuts.lower : 1;
	// The best whole result wins each category. Never union partial player lists;
	// uncustomized cabin placeholders are excluded from the game's calculation.
	const leaders = players[0]!.categories.map((baseline, index) => {
		const eligible = players.filter((player) => player.eligible === true);
		const leader = eligible.reduce(
			(best, candidate) =>
				candidate.categories[index]!.lower > best.categories[index]!.lower
					? candidate
					: best,
			eligible[0]!,
		);
		const highest = leader.categories[index]!;
		const upper = Math.max(
			...players
				.filter((player) => player.eligible !== false)
				.map((player) =>
					player.eligible === undefined ? 1 : player.categories[index]!.upper,
				),
		);
		return { category: { ...highest, upper }, farmer: leader.name };
	});
	const waiverCount = document.SaveGame.perfectionWaivers;
	// An unreadable waiver count could cover any remaining gap. Preserve that
	// uncertainty rather than silently assuming the farmer bought no waivers.
	const waivers =
		integer(waiverCount) && waiverCount >= 0 ? waiverCount : undefined;
	const weighted = [...leaders.map((leader) => leader.category), ...shared];
	return {
		farmers: players,
		shared,
		leaders,
		waivers,
		lower: Math.min(
			100,
			weighted.reduce((sum, row) => sum + row.lower * row.weight, 0) +
				(waivers ?? 0),
		),
		upper:
			waivers === undefined
				? 100
				: Math.min(
						100,
						weighted.reduce((sum, row) => sum + row.upper * row.weight, 0) +
							waivers,
					),
	};
}
