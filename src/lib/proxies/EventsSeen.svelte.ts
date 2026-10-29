import { SvelteSet } from "svelte/reactivity";
import type { EventIdList } from "$types/save";
import { type DataProxy, Raw } from ".";

/**
 * IDs of the events (cutscenes) a player has seen.
 *
 * The game plays an event when the player enters its location, its preconditions match
 * and its ID isn't listed here; finishing it adds the ID. Removing an ID lets it play again,
 * adding one skips it (without anything the event would have given).
 */
export class EventsSeen
	extends SvelteSet<string>
	implements DataProxy<EventIdList>
{
	public [Raw]: EventIdList;

	constructor(events: EventIdList) {
		// Numeric IDs parse as numbers; other 1.6 IDs (e.g. from mods) are strings
		super((events.int ?? []).map(String));
		this[Raw] = events;

		$effect(() => {
			this[Raw].int = Array.from(this);
		});
	}
}

// Share validation with v2 without pulling reactive proxies into its domain.
export { toEventId } from "../eventId.ts";
