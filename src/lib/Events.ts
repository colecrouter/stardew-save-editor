import eventData from "$generated/events.json";
import type { EventInfo } from "$types/wikiEvents";

/** Vanilla events named from the Stardew Modding Wiki, from `npm run dump:events` */
export const VanillaEvents: readonly EventInfo[] = eventData;

export const VanillaEventsById: ReadonlyMap<string, EventInfo> = new Map(
	VanillaEvents.map((event) => [event.id, event]),
);
