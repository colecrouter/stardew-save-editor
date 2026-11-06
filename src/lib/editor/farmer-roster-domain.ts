import type { DomainEditPort } from "./field-binding.ts";
import type { ImmutableView } from "./immutable-view.ts";
import type { FarmerRosterView } from "./farmer-roster-data.ts";
import { swapFarmers } from "./farmer-roster-operations.ts";

/** Commands capture farmer identities rather than stale positional indices. */
export function createFarmerRosterDomain(
	view: ImmutableView<FarmerRosterView>,
	model: DomainEditPort,
) {
	return {
		...view,
		swap: (sourceId: string, targetId: string) =>
			model.commands.transact(swapFarmers(sourceId, targetId)),
	};
}
