/**
 * Checks a parsed save (the `{ SaveGame }` object from XMLManager.parse) for
 * problems that would stop the game from loading it, or crash it once loaded.
 *
 * `errors` are definite problems; `warnings` are unusual but loadable.
 */

export interface SaveValidation {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export const SUPPORTED_VERSIONS = ["1.6"];

// The game stores money and item quality as `int`s, so it can't read anything
// outside this range
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;
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
			if (!("money" in farmer)) continue;
			const label =
				String(farmer.name ?? "").trim() ||
				(i === 0 ? "The main player" : `Farmhand ${i}`);
			const money = toInt32(farmer.money);
			if (money === undefined)
				errors.push(`${label}'s money (${farmer.money}) is out of range`);
			else if (money < 0)
				warnings.push(`${label}'s money (${money}) is negative`);
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

/** A short, human-readable summary of a failed validation */
export const describeProblems = (validation: SaveValidation, max = 2) => {
	const shown = validation.errors.slice(0, max).join("; ");
	const more = validation.errors.length - max;
	return more > 0 ? `${shown} (and ${more} more)` : shown;
};
