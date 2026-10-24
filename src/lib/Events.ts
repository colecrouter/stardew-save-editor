// Event names aren't in the game's data files (the Data/Events keys are just IDs and
// preconditions), so wiki/events.json holds them, copied from the Stardew Modding Wiki's
// List of Vanilla Event IDs (https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs,
// CC BY-SA 4.0). It isn't fetched, as the wiki sits behind Cloudflare, so edit it by hand
// to add or fix an event.
import eventData from "$lib/wiki/events.json";

/** A vanilla event from the Stardew Modding Wiki's List of Vanilla Event IDs */
export interface EventInfo {
	/** Event ID as stored in the save's eventsSeen list */
	id: string;
	/** Short title, e.g. "Abigail's 2 heart event" */
	name: string;
	/** The rest of the wiki's description (empty when the title says it all) */
	description: string;
	/** Where the event plays, e.g. "Pierre's General Store" */
	location: string;
	/** Characters the wiki lists the event under (empty for e.g. Grandpa's evaluation) */
	npcs: string[];
}

/** Vanilla events, by character (each in heart order), then the rest by location */
export const VanillaEvents: readonly EventInfo[] = eventData;

export const VanillaEventsById: ReadonlyMap<string, EventInfo> = new Map(
	VanillaEvents.map((event) => [event.id, event]),
);
