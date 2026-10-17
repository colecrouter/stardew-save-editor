import { describe, expect, it } from "vitest";
import { parseEventWikitext, splitDescription } from "../codegen/wikiEvents";
import events from "../generated/events.json";

const npcs = ["Abigail", "Leo", "Lewis", "Pam", "Penny", "Robin", "Sebastian"];

const heading = (text: string) =>
	`| colspan="5" style="text-align:center; background-color:#bbe1ac" |'''${text}'''`;

// The shape of the List of Vanilla Event IDs, with a few of its quirks
const wikitext = `{{LastEdit}}<br><br>
For anyone who needs to reference a vanilla event.

= '''Grouped by Location''' =

{| class="wikitable" style="width:50%"
! style="width:10%" | '''Event ID'''
! style="width:70%" | '''Event Description'''
|-
${heading("Location: Bus Stop")}
|-
|60367
|Part of the introduction event. After the farmer arrives in Pelican Town, Robin and Lewis show them to their new farmhouse.
|-
${heading("Location: Farmhouse")}
|-
|558291
|Grandpa returns and evaluates the farmer's progress.
|-
${heading("Location: Mountain")}
|-
|9333219
|Sebastian's 14 heart event (part 1): he catches an injured frog with the farmer's help.
|-
|8959199
|Leo's 9 heart event: a montage of him settling into life in the Valley.
|-
${heading("Location: Pam & Penny's Trailer")}
|-
|36
|Penny's 6 heart event: she tries cooking for the farmer.
|-
|36
|Completion of Pam's potato juice quest.
|-
${heading("Location: Pierre's General Store")}
|-
|3
|Abigail's 8 heart event: she brings out a spirit board.
|-
|1
|Abigail's 2 heart event: she asks the farmer to play [[Journey of the Prairie King]] with her.
|-
${heading("Location: Town")}
|-
|611173
|Completion of Pam and Penny's house upgrade.
|-
|611173
|Completion of Pam and Penny's house upgrade. A variation with the same ID plays when the farmer is married to Penny.
|-
${heading("Location: Beach")}
|-
|739330
|Willy's introduction event where he gives the farmer a fishing rod.
|-
|}

= '''Grouped by Character''' =

{| class="wikitable" style="width:50%"
! style="width:10%" | '''Event ID'''
! style="width:70%" | '''Event Description'''
! style="width:20%" | '''Event Location'''
|-
${heading("Abigail")}
|-
|1
|Abigail's 2 heart event: she asks the farmer to play Journey of the Prairie King with her.
|Pierre's General Store
|-
|3
|Abigail's 8 heart event: she brings out a spirit board.
|Pierre's General Store
|-
${heading("Lewis")}
|-
|60367
|Part of the introduction event.
|Bus Stop
|-
${heading("Pam")}
|-
|36
|Completion of Pam's potato juice quest.
|Pam & Penny's Trailer
|-
|611173
|Completion of Pam and Penny's house upgrade.
|Town
|-
${heading("Penny")}
|-
|36
|Penny's 6 heart event: she tries cooking for the farmer.
|Pam & Penny's Trailer
|-
${heading("Robin")}
|-
|60367
|Part of the introduction event.
|Robin's Carpentry Shop
|-
${heading("Sebastian")}
|-
|9333219
|Mountain
|Sebastian's 14 heart event (part 1): he catches an injured frog with the farmer's help.
|-
|}

[[Category:Events]]`;

const parsed = parseEventWikitext(wikitext, npcs);
const byId = (id: string) => parsed.find((event) => event.id === id);

describe("event wiki parsing", () => {
	it("reads each event's name, description and location", () => {
		expect(byId("1")).toEqual({
			id: "1",
			name: "Abigail's 2 heart event",
			description:
				"She asks the farmer to play Journey of the Prairie King with her.",
			location: "Pierre's General Store",
			npcs: ["Abigail"],
		});
	});

	it("splits a description into a title and the rest", () => {
		expect(splitDescription("Abigail's 4 heart event: she plays.")).toEqual({
			name: "Abigail's 4 heart event",
			description: "She plays.",
		});
		expect(
			splitDescription(
				"Part of the introduction event. After the farmer arrives, Robin and Lewis greet them.",
			),
		).toEqual({
			name: "Part of the introduction event",
			description: "After the farmer arrives, Robin and Lewis greet them.",
		});
		expect(
			splitDescription(
				"Willy's introduction event where he gives the farmer a fishing rod.",
			),
		).toEqual({
			name: "Willy's introduction event where he gives the farmer a fishing rod",
			description: "",
		});
	});

	it("lists every character an event is grouped under", () => {
		expect(byId("60367")?.npcs).toEqual(["Lewis", "Robin"]);
		expect(byId("36")?.npcs).toEqual(["Pam", "Penny"]);
	});

	it("tells whose event one missing from the character table is from its name", () => {
		expect(byId("8959199")?.npcs).toEqual(["Leo"]);
		expect(byId("558291")?.npcs).toEqual([]);
		// Willy isn't a known villager here
		expect(byId("739330")?.npcs).toEqual([]);
	});

	it("joins two different events listed under one ID", () => {
		expect(byId("36")).toMatchObject({
			name: "Penny's 6 heart event / Completion of Pam's potato juice quest",
			description: "She tries cooking for the farmer.",
		});
	});

	it("keeps the longer of two descriptions of one event", () => {
		expect(byId("611173")).toMatchObject({
			name: "Completion of Pam and Penny's house upgrade",
			description:
				"A variation with the same ID plays when the farmer is married to Penny.",
			location: "Town",
		});
	});

	it("takes locations from the location table, not the character table's mixed-up cells", () => {
		expect(byId("9333219")?.location).toBe("Mountain");
		expect(byId("9333219")?.name).toBe("Sebastian's 14 heart event (part 1)");
		expect(byId("60367")?.location).toBe("Bus Stop");
	});

	it("orders events by character in heart order, then the rest by location", () => {
		expect(parsed.map((event) => event.id)).toEqual([
			"1",
			"3",
			"60367",
			"36",
			"611173",
			"9333219",
			"558291",
			"8959199",
			"739330",
		]);
	});

	it("fails loudly if the page changes shape", () => {
		expect(() => parseEventWikitext("{| |}", npcs)).toThrow(
			"Grouped by Character",
		);
		expect(() =>
			parseEventWikitext("= '''Grouped by Character''' =", npcs),
		).toThrow("No events");
	});
});

describe("generated event names", () => {
	it("has a name and location for each of many unique events", () => {
		expect(events.length).toBeGreaterThanOrEqual(150);
		expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
		for (const event of events) {
			expect(event.name).not.toBe("");
			expect(event.location).not.toBe("");
		}
	});

	it("names the test save's events", () => {
		const ids = new Set(events.map((event) => event.id));
		for (const id of ["60367", "739330", "100162"]) expect(ids).toContain(id);
		expect(events.find((event) => event.id === "1")).toMatchObject({
			name: "Abigail's 2 heart event",
			location: "Pierre's General Store",
			npcs: ["Abigail"],
		});
	});
});
