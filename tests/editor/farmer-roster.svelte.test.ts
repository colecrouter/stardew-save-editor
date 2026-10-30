import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model";
import { parser, fixtureXml, exportDocument } from "./fixtures";
import CharacterHarness from "./CharacterHarness.svelte";

// Reassignment must publish through the workspace's queue and preserve the
// identity selected by other panels, even when that farmer becomes the host.
it(
	"reassigns farmers with keyboard buttons and native dragging while preserving selection and Undo",
	{ timeout: 25000 },
	async () => {
		const document = parser.parse(fixtureXml),
			host = document.SaveGame.player,
			guest = structuredClone(host);
		const hostId = String(host.UniqueMultiplayerID),
			hostName = host.name;
		Object.assign(host, { homeLocation: "FarmHouse" });
		Object.assign(guest, {
			UniqueMultiplayerID: "123456789",
			name: "Guest",
			homeLocation: "CabinGuest",
		});
		document.SaveGame.farmhands = { Farmer: [guest] };
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		await opened.model.commands.selectFarmer("123456789");
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(page.getByRole("link", { name: "Farmhands" }));
			const up = await page.findByRole("button", { name: "Move Guest up" });
			await fireEvent.click(up);
			await waitFor(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player
						.UniqueMultiplayerID,
				).toBe(123456789),
			);
			expect(
				opened.model.atomBindings.registry.get(
					opened.model.atomBindings.selectedFarmerId,
				),
			).toBe("123456789");
			expect(
				(
					page.getByRole("button", {
						name: "Move Guest up",
					}) as HTMLButtonElement
				).disabled,
			).toBe(true);
			const source = page
				.getByRole("group", { name: "Exchange with Guest" })
				.querySelector("header");
			if (!source) throw new Error("Missing drag header");
			await fireEvent.dragStart(source, {
				dataTransfer: { setData: () => {} },
			});
			await fireEvent.drop(
				page.getByRole("group", { name: `Exchange with ${hostName}` }),
			);
			await waitFor(async () =>
				expect(
					String(
						(await opened.model.snapshot()).document.SaveGame.player
							.UniqueMultiplayerID,
					),
				).toBe(hostId),
			);
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player
						.UniqueMultiplayerID,
				).toBe(123456789),
			);
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(async () =>
				expect(
					String(
						(await opened.model.snapshot()).document.SaveGame.player
							.UniqueMultiplayerID,
					),
				).toBe(hostId),
			);
			expect(
				opened.model.atomBindings.registry.get(
					opened.model.atomBindings.selectedFarmerId,
				),
			).toBe("123456789");
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
