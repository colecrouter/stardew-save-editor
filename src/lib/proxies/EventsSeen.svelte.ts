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

/**
 * The ID to save for an event ID typed by the user, or undefined if it can't be saved.
 *
 * Event keys separate the ID from the preconditions with "/", and preconditions such as
 * `e <id>` list IDs separated by spaces, so neither can be in an ID. Saves are read with
 * number parsing, so an ID that looks like a number must be written the way it reads back:
 * "01" would load as "1" and "1e3" as "1000", a different event. Leading zeros are dropped,
 * and other numbers that don't read back the same (by JavaScript's rules, which accept a
 * few more forms than the parser) are refused.
 */
export function toEventId(input: string): string | undefined {
	const id = input.trim().replace(/^0+(?=\d+$)/, "");
	if (!/^[^\s/]+$/.test(id)) return undefined;
	const number = Number(id);
	return Number.isFinite(number) && String(number) !== id ? undefined : id;
}
