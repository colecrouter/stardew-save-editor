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

// Missing rows are an explicit editor choice, never opening-time save defaults.
it(
	"keeps absent villagers disabled until added and confirms individual removal",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml);
		Object.assign(document.SaveGame.player, { friendshipData: "" });
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Relationships" }));
			const points = () =>
				page.getByRole("spinbutton", {
					name: "Alex points",
				}) as HTMLInputElement;
			expect(points().disabled).toBe(true);
			expect((await opened.model.snapshot()).entries).toHaveLength(0);
			await fireEvent.click(page.getByRole("button", { name: /^Add Alex$/ }));
			await waitFor(() => expect(points().disabled).toBe(false), {
				timeout: 5000,
			});
			expect(points().value).toBe("0");
			// Projection arrives before the command promise finishes; wait for the
			// membership action to release its pending guard before opening removal.
			await waitFor(
				() =>
					expect(
						(
							page.getByRole("button", {
								name: /^Remove Alex$/,
							}) as HTMLButtonElement
						).disabled,
					).toBe(false),
				{ timeout: 5000 },
			);
			// Native dialog opening is supplied by the browser; happy-dom needs only the
			// open/close attribute behavior for this component interaction assertion.
			const dialog = page
				.getByRole("heading", { name: "Remove Alex?", hidden: true })
				.closest("dialog");
			if (!dialog) throw new Error("Missing relationship confirmation");
			dialog.showModal = () => {
				dialog.open = true;
			};
			dialog.close = () => {
				dialog.open = false;
			};
			await fireEvent.click(
				page.getByRole("button", { name: /^Remove Alex$/ }),
			);
			expect(dialog.open).toBe(true);
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			const form = dialog.querySelector("form");
			if (!form) throw new Error("Missing removal form");
			await fireEvent.submit(form);
			await waitFor(() => expect(points().disabled).toBe(true), {
				timeout: 5000,
			});
			expect((await opened.model.snapshot()).entries).toHaveLength(2);
			await opened.model.commands.undo();
			await waitFor(() => expect(points().disabled).toBe(false), {
				timeout: 5000,
			});
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
