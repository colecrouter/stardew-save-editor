import requirements from "../../../generated/achievement-requirements.json";
import type { Farmer, SaveDocument } from "./domain.ts";

// Optional presentation members may be omitted or explicitly unavailable.
// These transient projections do not encode presence of serialized save fields.
export interface AchievementDiagnostic {
	value?: number | undefined;
	target: number;
	unknown?: number | undefined;
	evidence?: string | undefined;
}

// Utility.checkForBooksReadAchievement names these power-book stats explicitly.
// The Queen of Sauce cookbook and skill XP books are outside that requirement.
const powerBooks = [
	"Book_Trash",
	"Book_Crabbing",
	"Book_Bombs",
	"Book_Roe",
	"Book_WildSeeds",
	"Book_Woodcutting",
	"Book_Defense",
	"Book_Friendship",
	"Book_Void",
	"Book_Speed",
	"Book_Marlon",
	"Book_PriceCatalogue",
	"Book_Diamonds",
	"Book_Mystery",
	"Book_AnimalCatalogue",
	"Book_Speed2",
	"Book_Artifact",
	"Book_Horse",
	"Book_Grass",
] as const;
// Saved scalars and container shapes are validated by SaveCodec. Diagnostics
// retain uncertainty for absent fields, duplicate evidence and domain constraints.

/** A known empty dictionary means zero; missing or duplicate evidence is unknown.
 * Stats use case-insensitive keys, whereas crop shipping uses exact object IDs. */
function count(
	entries: { key: string; value: number }[] | undefined,
	key: string,
	ignoreCase = false,
): number | undefined {
	if (entries === undefined) return;
	const matches = entries.filter((row) =>
		ignoreCase ? row.key.toLowerCase() === key.toLowerCase() : row.key === key,
	);
	return matches.length > 1
		? undefined
		: matches.length === 0
			? 0
			: matches[0]?.value;
}

/** Read the remaining vanilla achievement requirements without simulating the
 * events which award them. Historical-only outcomes explain their evidence. */
export function extraAchievementDiagnostics(
	document: SaveDocument,
	farmer: Farmer,
): Map<number, AchievementDiagnostic> {
	const result = new Map<number, AchievementDiagnostic>();
	const add = (
		id: number,
		value: number | undefined,
		target: number,
		evidence?: string,
		unknown = 0,
	) => result.set(id, { value, target, evidence, unknown });
	const recorded = (id: number) => farmer.achievements?.includes(id) === true;
	const mailLists = [
		farmer.mailReceived,
		farmer.mailForTomorrow,
		farmer.mailbox,
	];
	const flag = (key: string): number | undefined => {
		// Pending no-letter flags count as durable evidence, just as the game's
		// hasOrWillReceiveMail check does. Never borrow another farmer's mailbox.
		if (
			mailLists.some(
				(list, index) =>
					list?.some(
						(value) =>
							value === key || (index === 1 && value === `${key}%&NL&%`),
					) === true,
			)
		)
			return 1;
		return mailLists.every((list) => list !== undefined) ? 0 : undefined;
	};

	// Museum progress is shared and counts actual donation placements, not the
	// player's artifactsFound/mineralsFound discovery history or inventory.
	const museums = (document.SaveGame.locations ?? []).filter(
		(location) => location?.$type === "StardewValley.Locations.LibraryMuseum",
	);
	const pieces = museums.length === 1 ? museums[0]?.museumPieces : undefined;
	const positions = pieces?.map((piece) => `${piece.key.X},${piece.key.Y}`);
	// CLR floating-point coordinates permit NaN/Infinity, but those values cannot
	// identify a donation placement. Keep this domain check after scalar decoding.
	const museumCount =
		pieces &&
		positions &&
		pieces.every(
			(piece) =>
				Number.isFinite(piece.key.X) &&
				Number.isFinite(piece.key.Y) &&
				piece.value.length > 0,
		) &&
		new Set(positions).size === pieces.length &&
		new Set(pieces.map((piece) => piece.value)).size === pieces.length
			? pieces.length
			: undefined;
	add(5, museumCount, requirements.museumCount);
	add(28, museumCount, 40);

	// Crop membership comes from Data/Crops flags. Shipping a recipe ingredient,
	// owning a crop or shipping an unrelated collection item gives no credit.
	const poly = requirements.polyculture.map((key) =>
		count(farmer.basicShipped, key),
	);
	add(
		31,
		poly.filter((value) => value !== undefined && value >= 15).length,
		poly.length,
		"Number of required crops shipped at least 15 times.",
		poly.filter((value) => value === undefined).length,
	);
	const mono = requirements.monoculture.map((key) =>
		count(farmer.basicShipped, key),
	);
	const best = Math.max(
		0,
		...mono.filter((value): value is number => value !== undefined),
	);
	add(
		32,
		best,
		300,
		"Highest shipment count among eligible crops.",
		mono.includes(undefined) ? 300 : 0,
	);

	const books = powerBooks.map((key) => count(farmer.stats?.Values, key, true));
	add(
		35,
		books.filter((value) => value !== undefined && value !== 0).length,
		powerBooks.length,
		"Power books read; excludes the Queen of Sauce cookbook and skill XP books.",
		books.filter((value) => value === undefined).length,
	);
	add(
		40,
		flag("Visited_Island"),
		1,
		"Ginger Island visit flag, including pending mail.",
	);
	add(
		41,
		flag("reachedBottomOfHardMines"),
		1,
		"Dangerous-mine completion flag; ordinary mine depth is not equivalent.",
	);
	add(
		44,
		flag("Summit_event"),
		1,
		"Summit visit event; a 100% score alone does not establish that this visit happened.",
	);
	add(
		36,
		farmer.lastSeenMovieWeek !== undefined && farmer.lastSeenMovieWeek >= -1
			? Number(farmer.lastSeenMovieWeek >= 0)
			: undefined,
		1,
		"A nonnegative last movie week records a completed movie visit.",
	);

	// Forest.resetLocalState counts babies after the latest family's seven-day
	// growth delay. The date is the game's zero-based WorldDate.TotalDays.
	const game = document.SaveGame;
	const season = ["spring", "summer", "fall", "winter"].indexOf(
		game.currentSeason ?? "",
	);
	const totalDays =
		game.year !== undefined &&
		game.year >= 1 &&
		season >= 0 &&
		game.dayOfMonth !== undefined &&
		game.dayOfMonth >= 1 &&
		game.dayOfMonth <= 28
			? ((game.year - 1) * 4 + season) * 28 + game.dayOfMonth - 1
			: undefined;
	const fed = game.timesFedRaccoons;
	const last = game.daysPlayedWhenLastRaccoonBundleWasFinished;
	const babies =
		fed !== undefined &&
		fed >= 0 &&
		last !== undefined &&
		totalDays !== undefined
			? Math.max(0, fed - 1 - Number(totalDays - last < 7))
			: undefined;
	add(
		39,
		babies,
		8,
		"Raccoon babies after the latest family's seven-day growth delay.",
	);
	if (flag("seenRaccoonFinishEvent") === 1)
		add(
			39,
			8,
			8,
			"The raccoon family finale is recorded in this farmer's mail flags.",
		);

	// Obtaining an Infinity weapon grants the award immediately, but the item
	// can later be sold or moved. Positive inventory evidence suffices; absence
	// cannot prove the farmer never obtained one. Custom weapon classes stay opaque.
	const hasInfinity = farmer.items?.some(
		(item) =>
			item?.$type === "StardewValley.Tools.MeleeWeapon" &&
			["62", "63", "64"].includes(item.itemId ?? ""),
	);
	add(
		42,
		hasInfinity === true ? 1 : undefined,
		1,
		hasInfinity === true
			? "An Infinity weapon is present in this farmer's inventory."
			: "Past weapon ownership cannot be reconstructed from the current inventory.",
	);

	// Fair grange scores and Luau soup reactions live on transient Event objects.
	// Festival tokens and current friendship cannot reconstruct those outcomes.
	for (const id of [37, 38])
		add(
			id,
			undefined,
			1,
			"This festival result has no independent saved score; the recorded award is its durable evidence.",
		);
	// Award membership is historical evidence only for event/ownership milestones.
	// It does not override current museum, crop-shipping or book requirements.
	for (const id of [36, 37, 38, 39, 40, 41, 42, 44]) {
		if (recorded(id))
			add(
				id,
				1,
				1,
				"Completion is evidenced by this farmer's recorded award; the original event is not replayed.",
			);
	}
	return result;
}
