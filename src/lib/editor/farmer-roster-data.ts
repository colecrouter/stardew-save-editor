import type { Farmer, SaveDocument } from "./domain.ts";

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const idOf = (farmer: Farmer) =>
	typeof farmer.UniqueMultiplayerID === "string" &&
	farmer.UniqueMultiplayerID.length > 0
		? farmer.UniqueMultiplayerID
		: typeof farmer.UniqueMultiplayerID === "number" &&
			  Number.isSafeInteger(farmer.UniqueMultiplayerID)
			? String(farmer.UniqueMultiplayerID)
			: undefined;
const empty = (value: unknown) =>
	value === undefined || value === null || value === "";
const values = (value: unknown): unknown[] =>
	empty(value) ? [] : Array.isArray(value) ? value : [value];

interface CellarEntry {
	key: { int: number };
	value: { long: string | number };
}
const cellarEntry = (value: unknown): value is CellarEntry =>
	record(value) &&
	record(value.key) &&
	record(value.value) &&
	typeof value.key.int === "number" &&
	Number.isSafeInteger(value.key.int) &&
	value.key.int >= 1 &&
	(typeof value.value.long === "string" ||
		(typeof value.value.long === "number" &&
			Number.isSafeInteger(value.value.long)));

/** Engine-only checked roster. Empty-name cabin placeholders stay at their raw slots. */
export function inspectFarmerRoster(document: SaveDocument) {
	const game = document.SaveGame;
	const hands = game.farmhands === "" ? [] : game.farmhands.Farmer;
	const entries = Array.isArray(hands) ? hands : [];
	const candidates = [game.player, ...entries];
	const active = candidates.filter(
		(farmer) =>
			record(farmer) &&
			typeof farmer.name === "string" &&
			farmer.name.trim() !== "",
	);
	const ids = candidates.map((farmer) =>
		record(farmer) ? idOf(farmer) : undefined,
	);
	let reason: string | undefined;
	if (
		!Array.isArray(hands) ||
		!record(game.player) ||
		active[0] !== game.player ||
		candidates.some(
			(farmer) => !record(farmer) || typeof farmer.name !== "string",
		)
	)
		reason = "The saved farmer list is unsupported.";
	else if (
		active.some(
			(farmer) =>
				!idOf(farmer) || ids.filter((id) => id === idOf(farmer)).length !== 1,
		)
	)
		reason =
			"Farmer identities must be present and unique before reassigning slots.";
	else if (
		active.some(
			(farmer) =>
				!record(farmer) ||
				typeof farmer.homeLocation !== "string" ||
				!farmer.homeLocation,
		)
	)
		reason = "Each farmer needs a supported saved home location.";
	const homeBySlot = active.map((farmer) =>
		record(farmer) && typeof farmer.homeLocation === "string"
			? farmer.homeLocation
			: "",
	);
	const rawGame: Record<string, unknown> = game;
	const rawCellars = rawGame.cellarAssignments;
	const savedCellars = record(rawCellars) ? values(rawCellars.item) : [];
	const cellars = savedCellars.filter(cellarEntry);
	if (cellars.length !== savedCellars.length)
		reason ??= "The saved cellar assignments are unsupported.";
	const keys = new Set<number>(),
		owners = new Set<string>();
	if (!empty(rawCellars) && !record(rawCellars))
		reason ??= "The saved cellar assignments are unsupported.";
	for (const entry of cellars) {
		if (keys.has(entry.key.int) || owners.has(String(entry.value.long))) {
			reason ??= "The saved cellar assignments are ambiguous or unsupported.";
			continue;
		}
		keys.add(entry.key.int);
		owners.add(String(entry.value.long));
	}
	// Cellar numbers are persistent location identities, not contiguous roster
	// positions. Keep each existing cellar paired with its owner's physical home.
	const hostId = idOf(game.player);
	if (
		cellars.some(
			(entry) =>
				(entry.key.int === 1 && String(entry.value.long) !== hostId) ||
				(String(entry.value.long) === hostId && entry.key.int !== 1),
		)
	)
		reason ??= "The saved host cellar assignment is ambiguous.";

	// Slot homes must remain a one-to-one assignment. Otherwise refreshing cabin
	// references would overwrite the same home twice and silently pick a winner.
	if (new Set(homeBySlot).size !== homeBySlot.length)
		reason ??= "Farmer slot homes are ambiguous.";

	const cabins: Record<string, unknown>[] = [];
	function visit(raw: unknown) {
		if (!record(raw)) return;
		const buildings = record(raw.buildings)
			? values(raw.buildings.Building)
			: [];
		for (const building of buildings) {
			if (!record(building) || !record(building.indoors)) continue;
			if (building.indoors["@_xsi:type"] === "Cabin")
				cabins.push(building.indoors);
			visit(building.indoors);
		}
	}
	const locations = record(game.locations)
		? values(game.locations.GameLocation)
		: [];
	locations.forEach(visit);
	for (const home of homeBySlot.slice(1, active.length)) {
		const matching = cabins.filter(
			(cabin) => cabin.uniqueName === home || cabin.name === home,
		);
		if (
			matching.some((cabin) => {
				const reference = cabin.farmhandReference;
				return (
					!empty(reference) &&
					!(
						typeof reference === "string" ||
						(typeof reference === "number" && Number.isSafeInteger(reference))
					)
				);
			})
		)
			reason ??= "A cabin's saved farmer reference is unsupported.";

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
		rawCellars: record(rawCellars) ? rawCellars : undefined,
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
	readonly played?: string;
	readonly moneyEarned?: number;
}
export interface FarmerRosterView {
	readonly supported: boolean;
	readonly reason?: string;
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
			const raw = record(farmer) ? farmer : undefined;
			const milliseconds = raw?.millisecondsPlayed;
			const minutes =
				typeof milliseconds === "number" &&
				Number.isFinite(milliseconds) &&
				milliseconds >= 0
					? Math.floor(milliseconds / 60000)
					: undefined;
			return {
				farmerId: roster.idOf(farmer) ?? "",
				position: index + 1,
				host: index === 0,
				name: farmer.name,
				home: roster.homeBySlot[index] ?? "Unsupported home",
				farmName:
					typeof farmer.farmName === "string" ? farmer.farmName : "Unknown",
				played:
					minutes === undefined
						? undefined
						: `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
				moneyEarned:
					typeof raw?.totalMoneyEarned === "number" &&
					Number.isFinite(raw.totalMoneyEarned)
						? raw.totalMoneyEarned
						: undefined,
			};
		}),
	};
}
