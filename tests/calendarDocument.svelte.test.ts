import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import type { Save } from "$types/save";
import {
	initializeCalendarDocument,
	prepareCalendarDocument,
	type CalendarEdit,
} from "$lib/calendarDocument";
import { CalendarSeason } from "$lib/calendarSeason";
import { SaveManager } from "$lib/SaveManager.svelte";

it("the pure adapter and production calendar agree through date, weather and festival edits", async () => {
	mockIDB();
	const xml = await readFile("tests/TestSave", "utf8");
	let manager: SaveManager | undefined;
	let pending: Promise<void | boolean> = Promise.resolve();
	const close = $effect.root(() => {
		manager = new SaveManager();
		pending = manager.import(new File([xml], "Calendar comparison"));
	});
	try {
		await pending;
		flushSync();
		const save = manager?.save;
		if (!save) throw new Error("No save");
		let game: Save = $state.snapshot(save.raw.SaveGame);
		let state = initializeCalendarDocument(game);
		const actions: CalendarEdit[] = [
			{ type: "calendar-date", change: { year: 2 } },
			{ type: "calendar-date", change: { day: 8 } },
			{ type: "calendar-weather", day: "today", value: "Sun" },
			{ type: "calendar-weather", day: "today", value: "Rain" },
			{ type: "calendar-date", change: { day: 13 } },
			{ type: "calendar-date", change: { day: 14 } },
			{ type: "calendar-weather", day: "tomorrow", value: "Wind" },
			{ type: "calendar-date", change: { season: CalendarSeason.Winter } },
		];
		for (const action of actions) {
			if (action.type === "calendar-date") {
				if (action.change.year !== undefined)
					save.calendar.year = action.change.year;
				if (action.change.day !== undefined)
					save.calendar.day = action.change.day;
				if (action.change.season !== undefined)
					save.calendar.season = action.change.season;
			} else if (action.day === "today") save.calendar.today = action.value;
			else save.calendar.tomorrow = action.value;
			const prepared = prepareCalendarDocument(game, state, action);
			game = prepared.game;
			state = prepared.state;
			flushSync();
			expect($state.snapshot(save.raw.SaveGame)).toEqual(game);
		}
	} finally {
		manager?.reset();
		close();
	}
});
