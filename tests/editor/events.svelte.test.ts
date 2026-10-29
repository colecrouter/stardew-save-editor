import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { readEvents } from "../../src/lib/editor/event-operations.ts";
import { VanillaEvents } from "../../src/lib/Events.ts";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures.ts";

async function openEvents() {
	const document = parser.parse(fixtureXml);
	const host = document.SaveGame.player;
	Object.assign(host, {
		eventsSeen: { int: [1, "Mod.Host_Event"], opaque: "keep" },
	});
	const guest = structuredClone(host);
	guest.UniqueMultiplayerID = "guest";
	guest.name = "Guest";
	Object.assign(guest, { eventsSeen: { int: [2], opaque: "guest" } });
	document.SaveGame.farmhands = { Farmer: [guest] };
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	const page = render(CharacterHarness, { model: opened.model });
	await fireEvent.click(page.getByRole("link", { name: "Events" }));
	return {
		...opened,
		page,
		hostId: String(host.UniqueMultiplayerID),
		async dispose() {
			page.unmount();
			await opened.close();
		},
	};
}

// Submit independent toggles before selection finishes: each command must retain
// its original farmer and its own discrete history step, even with focus retained.
it(
	"keeps queued event toggles on the original farmer and shares selection across pages",
	{ timeout: 25000 },
	async () => {
		const opened = await openEvents();
		const { page, model } = opened;
		try {
			const first = page.getByRole("checkbox", {
				name: "Abigail's 2 heart event",
			});
			const second = page.getByRole("checkbox", {
				name: "Abigail's 4 heart event",
			});
			expect((first as HTMLInputElement).checked).toBe(true);
			await fireEvent.click(first);
			await fireEvent.click(second);
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: "guest" },
			});
			const snapshot = await model.snapshot();
			await waitFor(() =>
				expect(
					(
						page.getByRole("checkbox", {
							name: "Abigail's 4 heart event",
						}) as HTMLInputElement
					).checked,
				).toBe(true),
			);
			expect(
				readEvents(snapshot.document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.seen.map((event) => event.id),
			).toEqual(["Mod.Host_Event", "2"]);
			expect(
				readEvents(snapshot.document)
					.find((owner) => owner.farmerId === "guest")
					?.seen.map((event) => event.id),
			).toEqual(["2"]);
			expect(snapshot.entries).toHaveLength(2);
			await model.commands.undo();
			expect(
				readEvents((await model.snapshot()).document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.seen.map((event) => event.id),
			).toEqual(["Mod.Host_Event"]);
			await model.commands.redo();
			await fireEvent.click(page.getByRole("link", { name: "Character" }));
			expect(
				(page.getByRole("combobox", { name: "Farmer" }) as HTMLSelectElement)
					.value,
			).toBe("guest");
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"validates custom IDs and keeps late add/remove work and feedback with its captured farmer",
	{ timeout: 25000 },
	async () => {
		const opened = await openEvents();
		const { page, model } = opened;
		try {
			const input = page.getByRole("textbox", {
				name: "Event ID to mark as seen",
			});
			const add = page.getByRole("button", { name: "Mark as seen" });
			await fireEvent.input(input, { target: { value: "1e3" } });
			expect((add as HTMLButtonElement).disabled).toBe(true);
			await fireEvent.input(input, { target: { value: "00042" } });
			expect(
				page.getByText("Saved as 42, without leading zeros."),
			).toBeTruthy();
			await fireEvent.submit(add.closest("form")!);
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: "guest" },
			});
			const snapshot = await model.snapshot();
			expect(
				readEvents(snapshot.document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.seen.some((event) => event.id === "42"),
			).toBe(true);
			expect(
				readEvents(snapshot.document)
					.find((owner) => owner.farmerId === "guest")
					?.seen.some((event) => event.id === "42"),
			).toBe(false);
			await waitFor(() =>
				expect(page.queryByText("Marked #42 as seen.")).toBeNull(),
			);
			// A successful add may clear its input before selection is published.
			// Enter the next ID before waiting for its pending guard to release.
			await fireEvent.input(input, { target: { value: "Mod.Example_Event" } });
			await waitFor(() =>
				expect((add as HTMLButtonElement).disabled).toBe(false),
			);
			await fireEvent.submit(add.closest("form")!);
			await model.snapshot();
			await waitFor(() =>
				expect(
					page.getByText("Marked #Mod.Example_Event as seen."),
				).toBeTruthy(),
			);
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search events" }),
				{ target: { value: "Mod.Example_Event" } },
			);
			const remove = page.getByRole("button", {
				name: "Remove Mod.Example_Event",
			});
			await waitFor(() =>
				expect((remove as HTMLButtonElement).disabled).toBe(false),
			);
			await fireEvent.click(remove);
			await model.snapshot();
			await waitFor(() =>
				expect(
					page.queryByRole("button", { name: "Remove Mod.Example_Event" }),
				).toBeNull(),
			);
			await model.commands.undo();
			await model.snapshot();
			await waitFor(() =>
				expect(
					page.getByRole("button", { name: "Remove Mod.Example_Event" }),
				).toBeTruthy(),
			);
			expect(
				readEvents((await model.snapshot()).document)
					.find((owner) => owner.farmerId === opened.hostId)
					?.seen.some((event) => event.id === "Mod.Example_Event"),
			).toBe(false);
		} finally {
			await opened.dispose();
		}
	},
);

it(
	"bounds mounted controls while search and grouping cover shared events across the catalog",
	{ timeout: 25000 },
	async () => {
		const opened = await openEvents();
		const { page, model } = opened;
		try {
			expect(page.getAllByRole("checkbox")).toHaveLength(24);
			const event = VanillaEvents.find((event) => event.npcs.length > 1);
			if (!event) throw new Error("Missing shared event fixture");
			await fireEvent.input(
				page.getByRole("searchbox", { name: "Search events" }),
				{ target: { value: event.name } },
			);
			const boxes = page.getAllByRole("checkbox", { name: event.name });
			expect(boxes).toHaveLength(event.npcs.length);
			await fireEvent.click(boxes[0]!);
			await model.snapshot();
			await waitFor(() =>
				expect(
					page
						.getAllByRole("checkbox", { name: event.name })
						.every((box) => (box as HTMLInputElement).checked),
				).toBe(true),
			);
			await fireEvent.change(page.getByRole("combobox", { name: "Group by" }), {
				target: { value: "location" },
			});
			expect(
				page.getByRole("region", { name: `${event.location} events` }),
			).toBeTruthy();
			expect(page.getAllByRole("checkbox", { name: event.name })).toHaveLength(
				1,
			);
			await fireEvent.change(
				page.getByRole("combobox", { name: "Show events" }),
				{ target: { value: "unseen" } },
			);
			expect(page.queryByRole("checkbox", { name: event.name })).toBeNull();
		} finally {
			await opened.dispose();
		}
	},
);
