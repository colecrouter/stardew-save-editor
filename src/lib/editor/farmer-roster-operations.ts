import { Data, Effect, Result } from "effect";
import type { SaveDocument } from "./domain.ts";
import { inspectFarmerRoster } from "./farmer-roster-data.ts";
import { InventoryEdits } from "./inventory-operations.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export class FarmerRosterInvalid extends Data.TaggedError(
	"FarmerRosterInvalid",
)<{ readonly message: string }> {}
const invalid = (message: string) =>
	Result.fail(new FarmerRosterInvalid({ message }));

/** Swap named farmer records while homes, cabins and cellars remain assigned to slots.
 * Callers supply a private draft; a later rejection must discard the whole snapshot. */
export function applyFarmerSwap(
	document: SaveDocument,
	sourceId: string,
	targetId: string,
): Result.Result<void, FarmerRosterInvalid> {
	const roster = inspectFarmerRoster(document);
	if (!roster.supported)
		return invalid(roster.reason ?? "The farmer roster is unsupported.");
	if (typeof sourceId !== "string" || typeof targetId !== "string")
		return invalid("Choose two current farmers.");
	const source = roster.active.findIndex(
			(farmer) => roster.idOf(farmer) === sourceId,
		),
		target = roster.active.findIndex(
			(farmer) => roster.idOf(farmer) === targetId,
		);
	if (source < 0 || target < 0)
		return invalid("A selected farmer is no longer available.");
	if (source === target) return Result.succeed(undefined);
	const ordered = [...roster.active],
		a = ordered[source],
		b = ordered[target];
	if (!a || !b) return invalid("A selected farmer is no longer available.");
	ordered[source] = b;
	ordered[target] = a;
	// Preserve unnamed cabin placeholders at their original serialized indices.
	// Only active farmhand slots receive the new named-farmer ordering.
	let next = 1;
	const hands = roster.entries.map((farmer) =>
		farmer.name.trim() ? (ordered[next++] ?? farmer) : farmer,
	);
	const host = ordered[0];
	if (!host) return invalid("The roster needs a host.");
	for (const [index, farmer] of ordered.entries()) {
		const home = roster.homeBySlot[index];
		if (!home) return invalid("A saved home assignment is unavailable.");
		Object.assign(farmer, { homeLocation: home });
		if (index === 0) continue;
		const cabin = roster.cabins.find(
			(raw) => raw.uniqueName === home || raw.name === home,
		);
		if (cabin) cabin.farmhandReference = farmer.UniqueMultiplayerID;
	}
	document.SaveGame.player = host;
	document.SaveGame.farmhands =
		document.SaveGame.farmhands === ""
			? { Farmer: hands }
			: { ...document.SaveGame.farmhands, Farmer: hands };
	// Transfer existing cellar/home pairs with the physical slots. Sparse cellar
	// IDs remain intact; indexing them as roster positions would duplicate owners.
	if (roster.rawCellars) {
		const assignments = [...roster.cellars];
		const nextOwners = new Map(
			roster.active.map((farmer, index) => [
				roster.idOf(farmer),
				ordered[index]?.UniqueMultiplayerID,
			]),
		);
		for (const entry of assignments) {
			const nextOwner = nextOwners.get(String(entry.value.long));
			if (nextOwner !== undefined) entry.value.long = nextOwner;
		}
		if (!assignments.some((entry) => entry.key.int === 1))
			assignments.push({
				key: { int: 1 },
				value: { long: host.UniqueMultiplayerID },
			});
		assignments.sort((left, right) => left.key.int - right.key.int);
		roster.rawCellars.item = assignments;
	}

	return Result.succeed(undefined);
}
/** Inventory authority replays this exact checked transition in transaction order. */
export function replayFarmerSwap(
	document: SaveDocument,
	sourceId: string,
	targetId: string,
): void {
	Result.getOrThrow(applyFarmerSwap(document, sourceId, targetId));
}
/** The inventory-owned capability authorizes only this bounded reassignment, not arbitrary raw writes. */
export const swapFarmers = Effect.fn("Farmers.swap")(function* (
	sourceId: string,
	targetId: string,
) {
	const inventory = yield* InventoryEdits;
	yield* recordAnnotatedOperation(
		inventory.swapFarmers(sourceId, targetId),
	).pipe(
		withReviewMetadata({
			label: "Reassign farmer slots",
			tags: [
				"farmers",
				"farmers:reassign",
				`farmer:${sourceId}`,
				`farmer:${targetId}`,
			],
		}),
	);
});
