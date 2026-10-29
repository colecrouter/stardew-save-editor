import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import CharacterHarness from "./CharacterHarness.svelte";
import { parser, fixtureXml, exportDocument } from "./fixtures";

// Exercise real full-save projections, the shared farmer selector, and grouped
// field edits together: pending work must never migrate to the next farmer.
it(
	"groups relationship typing and shares selection with Character without retargeting edits",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		const host = document.SaveGame.player;
		Object.assign(host, {
			friendshipData: {
				item: [
					{
						key: { string: "Abigail" },
						value: {
							Friendship: { Points: 100, Status: "Friendly", GiftsThisWeek: 0 },
						},
					},
				],
			},
		});
		const guest = structuredClone(host);
		guest.UniqueMultiplayerID = "guest";
		guest.name = "Guest";
		Object.assign(guest, {
			friendshipData: {
				item: [
					{
						key: { string: "Abigail" },
						value: {
							Friendship: { Points: 700, Status: "Dating", GiftsThisWeek: 2 },
						},
					},
				],
			},
		});
		document.SaveGame.farmhands = { Farmer: [guest] };
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Relationships" }));
			const points = page.getByRole("spinbutton", {
				name: "Abigail points",
			}) as HTMLInputElement;
			points.focus();
			await fireEvent.input(points, { target: { value: "200" } });
			await fireEvent.input(points, { target: { value: "500" } });
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: "guest" },
			});
			await waitFor(
				() =>
					expect(
						(
							page.getByRole("spinbutton", {
								name: "Abigail points",
							}) as HTMLInputElement
						).value,
					).toBe("700"),
				{ timeout: 5000 },
			);
			const snapshot = await opened.model.snapshot();
			expect(snapshot.entries).toHaveLength(1);
			expect(
				opened.model.atomBindings.registry
					.get(opened.model.atomBindings.view)
					?.relationships.find(
						(farmer) => farmer.farmerId === String(host.UniqueMultiplayerID),
					)?.relationships[0]?.points,
			).toBe(500);
			await fireEvent.click(page.getByRole("link", { name: "Character" }));
			expect(
				(page.getByRole("combobox", { name: "Farmer" }) as HTMLSelectElement)
					.value,
			).toBe("guest");
			await opened.model.commands.undo();
			await fireEvent.click(page.getByRole("link", { name: "Relationships" }));
			await fireEvent.change(page.getByRole("combobox", { name: "Farmer" }), {
				target: { value: String(host.UniqueMultiplayerID) },
			});
			await waitFor(
				() =>
					expect(
						(
							page.getByRole("spinbutton", {
								name: "Abigail points",
							}) as HTMLInputElement
						).value,
					).toBe("100"),
				{ timeout: 5000 },
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
