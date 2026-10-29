import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { Result } from "effect";
import { openEditor } from "../../src/lib/editor/editor-model";
import { createCatalogItem } from "../../src/lib/editor/item-catalog";
import { createRandom, rollTrinket } from "../../src/lib/TrinketStats";
import BackpackHarness from "./BackpackHarness.svelte";
import { fixtureXml, parser, exportDocument } from "./fixtures";
import type { SaveDocument } from "../../src/lib/editor/domain";

function catalog(id: string) {
	const item = createCatalogItem(id);
	if (!item) throw Error(`Missing catalog fixture: ${id}`);
	return item;
}
async function open(mutate: (document: SaveDocument) => void) {
	const document = parser.parse(fixtureXml);
	mutate(document);
	const opened = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	const page = render(BackpackHarness, { model: opened.model });
	return {
		...opened,
		page,
		dispose: async () => {
			page.unmount();
			await opened.close();
		},
	};
}
const waitCommitted = async (assertion: () => Promise<void>) =>
	waitFor(assertion, { timeout: 5000 });

// Real commands and whole-document exports protect opaque saved fields. The full
// fixture and queued edits need a bounded integration budget on slower CI runners.
describe("item property controls", { timeout: 25_000 }, () => {
	it.each(["equipment", "backpack"] as const)(
		"edits %s boots immediately, retains focus through rapid input, and exports only the intended fields",
		async (location) => {
			const opened = await open((document) => {
				const boots = { ...catalog("Sneakers"), modData: { opaque: "007" } };
				if (location === "equipment") document.SaveGame.player.boots = boots;
				else document.SaveGame.player.items.Item[3] = boots;
			});
			try {
				const before = (await opened.model.snapshot()).document;
				await fireEvent.click(
					opened.page.getByRole("button", {
						name:
							location === "equipment" ? "Boots: Sneakers" : "Slot 4: Sneakers",
					}),
				);
				const defense = opened.page.getByRole("spinbutton", {
					name: "Defense",
				}) as HTMLInputElement;
				const immunity = opened.page.getByRole("spinbutton", {
					name: "Immunity",
				}) as HTMLInputElement;
				defense.focus();
				await fireEvent.input(defense, { target: { value: "7" } });
				await fireEvent.input(defense, { target: { value: "78" } });
				const readBoots = async () => {
					const farmer = (await opened.model.snapshot()).document.SaveGame
						.player;
					return (
						location === "equipment" ? farmer.boots : farmer.items.Item[3]
					) as Record<string, unknown>;
				};
				await waitCommitted(async () =>
					expect((await readBoots()).defenseBonus).toBe(78),
				);
				expect(document.activeElement).toBe(defense);
				const entries = (await opened.model.snapshot()).entries.length;
				await fireEvent.input(defense, { target: { value: "" } });
				expect(defense.value).toBe("");
				expect((await opened.model.snapshot()).entries).toHaveLength(entries);
				await fireEvent.input(defense, { target: { value: "79" } });
				await waitCommitted(async () =>
					expect((await readBoots()).defenseBonus).toBe(79),
				);
				// All values in the focused field share one Undo entry, including a
				// blank replacement. Undo restores the original boot stat in one step.
				expect(entries).toBe(1);
				await opened.model.commands.undo();
				await waitFor(() => expect(defense.value).toBe("1"));
				await fireEvent.input(defense, { target: { value: "100" } });
				await waitFor(() =>
					expect(defense.getAttribute("aria-invalid")).toBe("true"),
				);
				expect(defense.value).toBe("1");
				expect((await opened.model.snapshot()).cursor).toBe(0);
				await fireEvent.input(defense, { target: { value: "1" } });
				await waitFor(() =>
					expect(defense.getAttribute("aria-invalid")).toBeNull(),
				);
				expect((await opened.model.snapshot()).cursor).toBe(0);
				await fireEvent.input(defense, { target: { value: "78" } });
				await waitCommitted(async () =>
					expect((await readBoots()).defenseBonus).toBe(78),
				);
				await fireEvent.input(immunity, { target: { value: "4" } });
				await waitCommitted(async () =>
					expect((await readBoots()).immunityBonus).toBe(4),
				);
				const expected = structuredClone(before);
				const changed = (
					location === "equipment"
						? expected.SaveGame.player.boots
						: expected.SaveGame.player.items.Item[3]
				) as Record<string, unknown>;
				changed.defenseBonus = 78;
				changed.immunityBonus = 4;
				const exported = await opened.model.commands.export();
				if (!exported || Result.isFailure(exported))
					throw Error("Expected successful export");
				expect(
					parser.parse(new TextDecoder().decode(exported.success)),
				).toEqual(expected);
			} finally {
				await opened.dispose();
			}
		},
	);

	it("edits weapon decimals, object base values, and the bottomless flag as independent actions", async () => {
		const opened = await open((document) => {
			const can = document.SaveGame.player.items.Item[2] as Record<
				string,
				unknown
			>;
			can.isBottomless = false;
			can.IsBottomless = false;
		});
		try {
			const before = (await opened.model.snapshot()).document;
			const chance = opened.page.getByRole("spinbutton", {
				name: "Critical chance",
			});
			await fireEvent.input(chance, { target: { value: "0.25" } });
			await waitCommitted(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[0],
				).toMatchObject({ critChance: 0.25 }),
			);
			await fireEvent.click(
				opened.page.getByRole("button", { name: "Slot 5: Parsnip" }),
			);
			await fireEvent.input(
				opened.page.getByRole("spinbutton", { name: "Base price" }),
				{ target: { value: "123" } },
			);
			await fireEvent.input(
				opened.page.getByRole("spinbutton", { name: "Edibility" }),
				{ target: { value: "42" } },
			);
			await waitCommitted(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[4],
				).toMatchObject({ price: 123, edibility: 42 }),
			);
			await fireEvent.click(
				opened.page.getByRole("button", { name: "Slot 3: Watering Can" }),
			);
			await fireEvent.click(
				opened.page.getByRole("checkbox", { name: "Bottomless" }),
			);
			await waitCommitted(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[2],
				).toMatchObject({ isBottomless: true, IsBottomless: true }),
			);
			await opened.model.commands.undo();
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items.Item[2],
			).toEqual(before.SaveGame.player.items.Item[2]);
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items.Item[4],
			).toMatchObject({ price: 123, edibility: 42 });
		} finally {
			await opened.dispose();
		}
	});

	it("edits clothing and colored-object RGB while preserving alpha and opaque color members", async () => {
		const opened = await open((document) => {
			const pants = document.SaveGame.player.pantsItem as Record<
				string,
				unknown
			>;
			pants.clothesColor = {
				R: 1,
				G: 2,
				B: 3,
				A: 128,
				PackedValue: 2147680769,
				custom: "keep",
			};
			document.SaveGame.player.items.Item[3] = {
				...catalog("Parsnip"),
				"@_xsi:type": "ColoredObject",
				color: { R: 10, G: 20, B: 30, A: 77, custom: { opaque: true } },
			};
		});
		try {
			await fireEvent.click(
				opened.page.getByRole("button", { name: /^Pants:/ }),
			);
			await fireEvent.input(opened.page.getByLabelText("Color"), {
				target: { value: "#123456" },
			});
			await waitCommitted(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.pantsItem,
				).toMatchObject({
					clothesColor: {
						R: 18,
						G: 52,
						B: 86,
						A: 128,
						PackedValue: 2153133074,
						custom: "keep",
					},
				}),
			);
			await fireEvent.click(
				opened.page.getByRole("button", { name: "Slot 4: Parsnip" }),
			);
			await fireEvent.input(opened.page.getByLabelText("Color"), {
				target: { value: "#abcdef" },
			});
			await waitCommitted(async () =>
				expect(
					(await opened.model.snapshot()).document.SaveGame.player.items
						.Item[3],
				).toMatchObject({
					color: { R: 171, G: 205, B: 239, A: 77, custom: { opaque: true } },
				}),
			);
			await opened.model.commands.undo();
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items.Item[3],
			).toMatchObject({
				color: { R: 10, G: 20, B: 30, A: 77, custom: { opaque: true } },
			});
		} finally {
			await opened.dispose();
		}
	});

	it("edits a trinket's derived level through its seed and restores it with Undo", async () => {
		const opened = await open((document) => {
			document.SaveGame.player.trinketItem = {
				...catalog("FairyBox"),
				generationSeed: 0,
				modData: { opaque: "keep" },
			};
		});
		try {
			const before = (await opened.model.snapshot()).document;
			await fireEvent.click(
				opened.page.getByRole("button", { name: /^Trinket:/ }),
			);
			const level = opened.page.getByRole("spinbutton", {
				name: "Level",
			}) as HTMLInputElement;
			const target = level.value === "5" ? 4 : 5;
			await fireEvent.input(level, { target: { value: String(target) } });
			await waitCommitted(async () => {
				const document = (await opened.model.snapshot()).document;
				const item = document.SaveGame.player.trinketItem as Record<
					string,
					unknown
				>;
				const context = {
					useLegacyRandom: document.SaveGame.useLegacyRandom === true,
					totalMoneyEarned: Number(
						document.SaveGame.player.totalMoneyEarned ?? 0,
					),
				};
				const stats = rollTrinket(
					"FairyBox",
					createRandom(Number(item.generationSeed), context.useLegacyRandom),
					context,
				);
				expect(stats).toMatchObject({ kind: "FairyBox", level: target });
				expect(item.modData).toEqual({ opaque: "keep" });
			});
			await opened.model.commands.undo();
			await waitFor(() => expect(level.value).not.toBe(String(target)));
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.dispose();
		}
	});
	it("selects Frog Egg colors through derived stats and leaves seedless trinkets read-only", async () => {
		const opened = await open((document) => {
			document.SaveGame.player.trinketItem = {
				...catalog("FrogEgg"),
				generationSeed: 0,
			};
			const seedless = catalog("FairyBox");
			delete seedless.generationSeed;
			document.SaveGame.player.items.Item[3] = seedless;
		});
		try {
			await fireEvent.click(
				opened.page.getByRole("button", { name: /^Trinket:/ }),
			);
			const color = opened.page.getByRole("combobox", {
				name: "Color",
			}) as HTMLSelectElement;
			const before = (await opened.model.snapshot()).document;
			const target = [...color.options].find(
				(option) => option.value !== color.value,
			)?.value;
			if (target === undefined) throw Error("Expected another frog color");
			// Happy DOM's :checked selector currently excludes selected OPTIONs.
			// Restore native select semantics only inside this test, without a product shim.
			const originalQuery = color.querySelector.bind(color);
			const query = vi
				.spyOn(color, "querySelector")
				.mockImplementation((selector) =>
					selector === ":checked"
						? ([...color.options].find((option) => option.selected) ?? null)
						: originalQuery(selector),
				);
			try {
				await fireEvent.change(color, { target: { value: target } });
			} finally {
				query.mockRestore();
			}
			await waitCommitted(async () => {
				const document = (await opened.model.snapshot()).document;
				const item = document.SaveGame.player.trinketItem as Record<
					string,
					unknown
				>;
				const context = {
					useLegacyRandom: document.SaveGame.useLegacyRandom === true,
					totalMoneyEarned: Number(
						document.SaveGame.player.totalMoneyEarned ?? 0,
					),
				};
				expect(
					rollTrinket(
						"FrogEgg",
						createRandom(Number(item.generationSeed), context.useLegacyRandom),
						context,
					),
				).toMatchObject({ kind: "FrogEgg", variant: Number(target) });
			});
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before);
			await fireEvent.click(
				opened.page.getByRole("button", { name: /^Slot 4:/ }),
			);
			expect(
				opened.page.queryByRole("spinbutton", { name: "Level" }),
			).toBeNull();
			expect((await opened.model.snapshot()).document).toEqual(before);
		} finally {
			await opened.dispose();
		}
	});
});
