import type { ImmutableView } from "./immutable-view.ts";
import type { ProgressAchievement, ProgressCategory } from "./progress-data.ts";

/** Hide secret awards until this farmer has a recorded award. Current
 * requirements, including uncertain evidence, cannot stand in for that record. */
export function concealedAchievement(
	award: ImmutableView<ProgressAchievement>,
	hideSpoilers: boolean,
) {
	return hideSpoilers && award.hidden && award.recorded !== true;
}

/** Endgame categories reveal their identity after positive saved progress.
 * Missing or uncertain evidence stays concealed; normal collection checklists
 * remain useful. Return a presentation copy so scores and save data stay intact. */
export function presentProgressCategory(
	category: ImmutableView<ProgressCategory>,
	hideSpoilers: boolean,
): ImmutableView<ProgressCategory> {
	if (!hideSpoilers) return category;
	const endgame = ["obelisks", "clock", "walnuts"].includes(category.id);
	const discovered = category.requirements.some(
		(row) => row.status === "complete" || (row.value ?? 0) > 0,
	);
	if (endgame && !discovered)
		return {
			...category,
			label: "Undiscovered milestone",
			note: "Turn off Hide spoilers to see this milestone's requirements.",
			section: undefined,
			requirements: category.requirements.map((row) => ({
				...row,
				id: row.id ?? row.name,
				name: "Undiscovered requirement",
			})),
		};
	// A Stardrop's source can reveal a story reward even after other sources
	// were found. Reveal each source only when its own completion is established.
	if (category.id === "stardrops")
		return {
			...category,
			requirements: category.requirements.map((row) =>
				row.status === "complete"
					? row
					: {
							...row,
							id: row.id ?? row.name,
							name: "Undiscovered Stardrop source",
						},
			),
		};
	return category;
}
