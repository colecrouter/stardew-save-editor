import type { Farmer, Location, SaveDocument } from "./domain.ts";
import { nonemptyText } from "./plain-data.ts";
import { isKnownLocation } from "./saved-types.ts";

const idOf = (farmer: Farmer) => farmer.UniqueMultiplayerID?.toString();
type Cabin = Extract<
	Location,
	{
		readonly $type: "StardewValley.Locations.Cabin";
	}
>;

/** Engine-only checked roster. Empty-name cabin placeholders stay at their raw slots. */
export function inspectFarmerRoster(document: SaveDocument) {
	const game = document.SaveGame;
	const entries = game.farmhands;
	const candidates = [game.player, ...entries];
	const active = candidates.filter(
		(farmer): farmer is Farmer & { name: string } =>
			farmer != null && farmer.name !== undefined && farmer.name.trim() !== "",
	);
	// Nil farmhand slots and unnamed placeholders retain their serialized positions.
	const ids = candidates.map((farmer) =>
		farmer == null ? undefined : idOf(farmer),
	);
	let reason: string | undefined;
	if (
		active[0] !== game.player ||
		candidates.some((farmer) => farmer == null || farmer.name === undefined)
	)
		reason = "The saved farmer list is unsupported.";
	else if (
		active.some(
			(farmer) =>
				nonemptyText(idOf(farmer)) === undefined ||
				ids.filter((id) => id === idOf(farmer)).length !== 1,
		)
	)
		reason =
			"Farmer identities must be present and unique before reassigning slots.";
	else if (
		active.some(
			(farmer) => !(farmer.homeLocation != null && farmer.homeLocation !== ""),
		)
	)
		reason = "Each farmer needs a supported saved home location.";
	const homeBySlot = active.map((farmer) => farmer.homeLocation ?? "");
	// The codec guarantees dictionary entry shapes and Int64 owner values. Positive
	// cellar identities and one-to-one ownership remain roster constraints.
	const rawCellars = game.cellarAssignments;
	const cellars = rawCellars ?? [];
	if (cellars.some((entry) => entry.key < 1))
		reason ??= "The saved cellar assignments are unsupported.";
	const keys = new Set<number>(),
		owners = new Set<string>();
	for (const entry of cellars) {
		if (keys.has(entry.key) || owners.has(String(entry.value))) {
			reason ??= "The saved cellar assignments are ambiguous or unsupported.";
			continue;
		}
		keys.add(entry.key);
		owners.add(String(entry.value));
	}
	// Cellar numbers are persistent location identities, not contiguous roster
	// positions. Keep each existing cellar paired with its owner's physical home.
	const hostId = idOf(game.player);
	if (
		cellars.some(
			(entry) =>
				(entry.key === 1 && String(entry.value) !== hostId) ||
				(String(entry.value) === hostId && entry.key !== 1),
		)
	)
		reason ??= "The saved host cellar assignment is ambiguous.";

	// Slot homes must remain a one-to-one assignment. Otherwise refreshing cabin
	// references would overwrite the same home twice and silently pick a winner.
	if (new Set(homeBySlot).size !== homeBySlot.length)
		reason ??= "Farmer slot homes are ambiguous.";

	const cabins: Cabin[] = [];
	function visit(raw: Location | null | undefined) {
		if (raw == null) return;
		// Opaque locations or buildings may hide another matching cabin. They cannot
		// authorize reassignment because typed traversal cannot establish uniqueness.
		if (!isKnownLocation(raw)) {
			reason ??= "The saved home locations are unsupported.";
			return;
		}
		for (const building of raw.buildings ?? []) {
			if (building == null) continue;
			if (building.$type === "$unknown") {
				reason ??= "The saved home locations are unsupported.";
				continue;
			}
			const indoors = building.indoors;
			if (indoors?.$type === "StardewValley.Locations.Cabin")
				cabins.push(indoors);
			visit(indoors);
		}
	}
	for (const location of game.locations ?? []) visit(location);
	for (const home of homeBySlot.slice(1, active.length)) {
		if (
			cabins.filter((cabin) => cabin.uniqueName === home || cabin.name === home)
				.length > 1
		)
			reason ??= "A farmhand home matches more than one cabin.";
	}
	return {
		active,
		entries,
		homeBySlot,
		cellars,
		rawCellars,
		cabins,
		supported: reason === undefined,
		reason,
		idOf,
	};
}

export interface FarmerRosterPlayerView {
	readonly farmerId: string;
	readonly position: number;
	readonly host: boolean;
	readonly name: string;
	readonly home: string;
	readonly farmName: string;
	readonly played?: string | undefined;
	readonly moneyEarned?: number | undefined;
}
export interface FarmerRosterView {
	readonly supported: boolean;
	readonly reason?: string | undefined;
	readonly placeholders: number;
	readonly players: readonly FarmerRosterPlayerView[];
}
/** Reassignment UI sees slot/home semantics and display values, never raw farmer records. */
export function readFarmerRoster(document: SaveDocument): FarmerRosterView {
	const roster = inspectFarmerRoster(document);
	return {
		supported: roster.supported,
		reason: roster.reason,
		placeholders: roster.entries.length + 1 - roster.active.length,
		players: roster.active.map((farmer, index) => {
			// Played time is a decoded UInt64. Divide before formatting so even long
			// play histories keep exact whole minutes without Number precision loss.
			const milliseconds = farmer.millisecondsPlayed;
			const minutes =
				milliseconds !== undefined && milliseconds >= 0n
					? milliseconds / 60000n
					: undefined;
			return {
				farmerId: roster.idOf(farmer) ?? "",
				position: index + 1,
				host: index === 0,
				name: farmer.name,
				home: roster.homeBySlot[index] ?? "Unsupported home",
				farmName: farmer.farmName ?? "Unknown",
				played:
					minutes === undefined
						? undefined
						: `${minutes / 60n}h ${minutes % 60n}m`,
				moneyEarned:
					farmer.totalMoneyEarned !== undefined &&
					Number.isFinite(farmer.totalMoneyEarned)
						? farmer.totalMoneyEarned
						: undefined,
			};
		}),
	};
}
