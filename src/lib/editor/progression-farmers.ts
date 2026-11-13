import { Effect } from "effect";
import { farmers, MutationError, type SaveDocument } from "./domain.ts";

/** Match the game's/legacy editor's active roster for all-player progression.
 * Empty-name farmhand records are unclaimed cabin placeholders, not recipients.
 * Keep players with missing names as typed failures rather than silently skipping them. */
export const progressionFarmers = Effect.fn("Progression.farmers")(function* (
	document: SaveDocument,
) {
	const candidates = farmers(document);
	if (
		candidates.some(
			(farmer, index) =>
				farmer.name === undefined || (index === 0 && !farmer.name.trim()),
		)
	)
		return yield* new MutationError(
			"A saved player name is unsupported for all-player progression.",
		);
	return candidates.filter(
		(farmer, index) => index === 0 || farmer.name?.trim() !== "",
	);
});
