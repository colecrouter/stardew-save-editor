/**
 * Checks a parsed save (the `{ SaveGame }` object from XMLManager.parse) for
 * some known problems that would stop the game from loading it, or crash it
 * once loaded. Passing only means none of these checks found anything; it
 * doesn't prove the game will load the save.
 *
 * `errors` are definite problems; `warnings` are unusual but loadable.
 */

import type { ToastType } from "$lib/ToastManager.svelte";

export interface SaveValidation {
	/** No errors were found (there may still be warnings) */
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export const SUPPORTED_VERSIONS = ["1.6"];

// The game stores money, item quality and the date as `int`s, so it can't read
// anything outside this range
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;
// Stats are `uint`s (Stats.Values)
const UINT32_MAX = 4_294_967_295;
// The game's Season enum, in order
const SEASONS = ["spring", "summer", "fall", "winter"];
const DAYS_PER_SEASON = 28;
// Normal, silver, gold and iridium (there is no quality 3). The game still
// loads other values, it just shows them oddly
const STAR_QUALITIES = new Set([0, 1, 2, 4]);
// This Rarecrow, (BC)126, keeps the hat it's wearing in `quality` (hat ID + 1)
const HAT_RARECROW_ID = "126";
// The Missing Bundle has no reward, so a pending reward for it crashes the game
const MISSING_BUNDLE = 36;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] =>
	Array.isArray(value)
		? value
		: value === undefined || value === ""
			? []
			: [value];

// A whole number, as the game's XML reader would accept it
const toInteger = (value: unknown) => {
	if (typeof value === "number")
		return Number.isInteger(value) ? value : undefined;
	if (typeof value === "string" && /^\s*-?\d+\s*$/.test(value))
		return Number(value);
	return undefined;
};

// A whole number that fits in the game's `int`
const toInt32 = (value: unknown) => {
	const number = toInteger(value);
	return number !== undefined && number >= INT32_MIN && number <= INT32_MAX
		? number
		: undefined;
};

const isTrue = (value: unknown) => value === true || value === "true";

// The season the game reads, if it can: a name in any case, or the season's
// number (Game1.currentSeason, through Utility.TryParseEnum)
const toSeason = (value: unknown) => {
	const text = String(value ?? "")
		.trim()
		.toLowerCase();
	const index = toInteger(text);
	return index === undefined
		? SEASONS.find((season) => season === text)
		: SEASONS[index];
};

const itemsHave = (count: number) =>
	`${count} item${count === 1 ? " has" : "s have"}`;

// Walk every object in the save, calling `visit` on each one that looks like an item
const forEachItem = (node: unknown, visit: (item: Json) => void) => {
	const stack: unknown[] = [node];
	while (stack.length) {
		const current = stack.pop();
		if (Array.isArray(current)) {
			for (const value of current) stack.push(value);
		} else if (isObject(current)) {
			if ("itemId" in current && "stack" in current) visit(current);
			for (const value of Object.values(current))
				if (typeof value === "object" && value !== null) stack.push(value);
		}
	}
};

export const validateSave = (parsed: unknown): SaveValidation => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const result = () => ({ valid: errors.length === 0, errors, warnings });

	const game = isObject(parsed) ? parsed.SaveGame : undefined;
	if (!isObject(game)) {
		errors.push("Not a Stardew Valley save (no <SaveGame> data)");
		return result();
	}

	const version = String(game.gameVersion ?? "");
	if (!SUPPORTED_VERSIONS.some((v) => version.startsWith(v)))
		errors.push(`Unsupported game version "${version || "missing"}"`);

	const id = toInteger(game.uniqueIDForThisGame);
	if (id === undefined || id < 0)
		errors.push("Missing or invalid unique ID (uniqueIDForThisGame)");

	// Date. The game can't load a season it can't read, or a day or year that
	// isn't an int. Other days and years, and snow outside winter, load, but
	// the game never makes them itself
	const season = toSeason(game.currentSeason);
	if (season === undefined)
		errors.push(
			`The season (${game.currentSeason ?? "missing"}) isn't spring, summer, fall or winter`,
		);
	// A missing day or year loads as 0
	const day = toInt32(game.dayOfMonth ?? 0);
	if (day === undefined)
		errors.push(
			`The day of the month (${game.dayOfMonth}) isn't a number the game can read`,
		);
	else if (day < 1 || day > DAYS_PER_SEASON)
		warnings.push(
			`The day of the month (${day}) isn't 1 to ${DAYS_PER_SEASON}`,
		);
	const year = toInt32(game.year ?? 0);
	if (year === undefined)
		errors.push(`The year (${game.year}) isn't a number the game can read`);
	else if (year < 1) warnings.push(`The year (${year}) is less than 1`);
	if (isTrue(game.isSnowing) && season !== undefined && season !== "winter")
		warnings.push(`It's snowing in ${season}, and only snows in winter`);

	// Players
	const player = game.player;
	if (!isObject(player)) {
		errors.push("Missing the main player");
	} else {
		if (!String(player.name ?? "").trim())
			warnings.push("The main player has no name");
		if (!String(player.farmName ?? "").trim())
			warnings.push("The farm has no name");

		// Unclaimed cabins have a farmhand with no name, which is normal
		const farmhands = isObject(game.farmhands)
			? asArray(game.farmhands.Farmer).filter(isObject)
			: [];
		for (const [i, farmer] of [player, ...farmhands].entries()) {
			const label =
				String(farmer.name ?? "").trim() ||
				(i === 0 ? "The main player" : `Farmhand ${i}`);
			if ("money" in farmer) {
				const money = toInt32(farmer.money);
				if (money === undefined)
					errors.push(`${label}'s money (${farmer.money}) is out of range`);
				else if (money < 0)
					warnings.push(`${label}'s money (${money}) is negative`);
			}

			// A stat that doesn't fit in a `uint` can't be read back
			const stats =
				isObject(farmer.stats) && isObject(farmer.stats.Values)
					? asArray(farmer.stats.Values.item).filter(isObject)
					: [];
			for (const stat of stats) {
				const value = isObject(stat.value) ? stat.value.unsignedInt : undefined;
				if (value === undefined) continue;
				const name = isObject(stat.key) ? stat.key.string : undefined;
				const number = toInteger(value);
				if (number === undefined || number < 0 || number > UINT32_MAX)
					errors.push(
						`${label}'s ${name ?? "unnamed"} stat (${value}) is out of range`,
					);
			}
		}
	}

	// Locations
	const locations = isObject(game.locations)
		? asArray(game.locations.GameLocation).filter(isObject)
		: [];
	if (locations.length === 0) {
		errors.push("The save has no locations");
	} else {
		const names = new Set(locations.map((l) => l.name));
		for (const required of ["Farm", "FarmHouse"])
			if (!names.has(required)) errors.push(`Missing the ${required} location`);
	}

	// Community Center
	const cc = locations.find((l) => l.name === "CommunityCenter");
	if (cc) {
		// Six rooms, plus a seventh once the Abandoned Joja Mart is restored
		const areas = isObject(cc.areasComplete)
			? asArray(cc.areasComplete.boolean)
			: [];
		if (areas.length !== 6 && areas.length !== 7)
			errors.push(
				`The Community Center has ${areas.length} rooms recorded; the game expects 6 or 7`,
			);

		const rewards = isObject(cc.bundleRewards)
			? asArray(cc.bundleRewards.item).filter(isObject)
			: [];
		for (const reward of rewards) {
			const key = isObject(reward.key) ? toInteger(reward.key.int) : undefined;
			const value = isObject(reward.value) ? reward.value.boolean : undefined;
			if (key === MISSING_BUNDLE && isTrue(value))
				errors.push(
					"The Missing Bundle has a reward waiting, which crashes the game",
				);
		}
	}

	// Items, wherever they are (inventories, chests, machines...)
	let unreadableQuality = 0;
	let unusualQuality = 0;
	let badStack = 0;
	forEachItem(game, (item) => {
		if (item.quality !== undefined) {
			const quality = toInt32(item.quality);
			const isHatRarecrow =
				isTrue(item.bigCraftable) && String(item.itemId) === HAT_RARECROW_ID;
			if (quality === undefined) unreadableQuality++;
			else if (!STAR_QUALITIES.has(quality) && !isHatRarecrow) unusualQuality++;
		}
		if ((toInteger(item.stack) ?? 0) < 1) badStack++;
	});
	if (unreadableQuality)
		errors.push(
			`${itemsHave(unreadableQuality)} a quality the game can't read`,
		);
	if (unusualQuality)
		warnings.push(
			`${itemsHave(unusualQuality)} an unusual quality (not normal, silver, gold or iridium)`,
		);
	if (badStack) warnings.push(`${itemsHave(badStack)} a stack of less than 1`);

	return result();
};

/** A short summary of a list of problems: the first one, and how many more */
export const describeProblems = ([first = "", ...rest]: string[]) =>
	rest.length ? `${first} (and ${rest.length} more)` : first;

/**
 * The toast to show once a save has been uploaded or downloaded. Problems
 * stay up longer, so there's time to read them.
 */
export const describeResult = (
	action: "uploaded" | "downloaded",
	validation?: SaveValidation,
): { message: string; type: ToastType; duration: number } => {
	if (validation && !validation.valid)
		return {
			message: `Save file ${action}, but it has problems: ${describeProblems([...validation.errors, ...validation.warnings])}`,
			type: "failure",
			duration: 10000,
		};
	if (validation?.warnings.length)
		return {
			message: `Save file ${action}, with ${validation.warnings.length === 1 ? "a warning" : "warnings"}: ${describeProblems(validation.warnings)}`,
			type: "warning",
			duration: 10000,
		};
	return { message: `Save file ${action}!`, type: "success", duration: 5000 };
};
