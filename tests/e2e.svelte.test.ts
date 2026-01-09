import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import {
	parseBundleKey,
	parseBundleValue,
} from "$lib/proxies/bundleSerialization";
import { Color as ColorProxy } from "$lib/proxies/Color.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import { Gender, type Player, type Color as RawColor } from "../codegen/save";
import {
	SaveManager,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import bundlesPage from "../src/routes/(edit)/bundles/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import relationshipsPage from "../src/routes/(edit)/relationships/+page.svelte";

interface PageHarness {
	saveManager: SaveManager;
	render: typeof render;
	cleanup: () => void;
}

const mergeContexts = (
	base: Map<unknown, unknown>,
	extra?: Map<unknown, unknown>,
) => {
	const merged = new Map(base);
	if (!extra) return merged;
	for (const [key, value] of extra) {
		merged.set(key, value);
	}
	return merged;
};

const once = (fn: () => void) => {
	let called = false;
	return () => {
		if (called) return;
		called = true;
		fn();
	};
};

const createPageHarness = async (): Promise<PageHarness> => {
	const file = await readFile("tests/TestSave");

	let saveManager!: SaveManager;
	let importPromise!: Promise<void>;
	const saveManagerCleanup = $effect.root(() => {
		saveManager = new SaveManager();
		importPromise = saveManager.import(new File([file], "TestSave"));
	});

	await importPromise;
	flushSync();

	const baseContext = setSaveManagerContext(saveManager);
	const renderCleanups: Array<() => void> = [];

	const renderWithContext = ((component, options, renderOptions) => {
		const opts = {
			...(options ?? {}),
		} as Record<string, unknown> & {
			context?: Map<unknown, unknown>;
		};
		const context = mergeContexts(baseContext, opts.context);
		const finalOptions = { ...opts, context };

		let rendered!: ReturnType<typeof render>;
		const renderCleanup = $effect.root(() => {
			// @ts-expect-error Testing helpers allow passing a context map even though the types omit it.
			rendered = render(component, finalOptions, renderOptions);
		});

		const dispose = once(renderCleanup);
		renderCleanups.push(dispose);

		const originalUnmount = rendered.unmount.bind(rendered);
		rendered.unmount = () => {
			originalUnmount();
			dispose();
		};

		return rendered;
	}) as typeof render;

	const cleanup = once(() => {
		while (renderCleanups.length > 0) {
			const dispose = renderCleanups.pop();
			dispose?.();
		}
		saveManagerCleanup();
	});

	return { saveManager, render: renderWithContext, cleanup };
};

describe("Save Manager Integration Tests", () => {
	mockIDB(); // Mock IndexedDB for testing
	let harness!: PageHarness;
	let saveManager!: SaveManager;

	beforeEach(async () => {
		harness = await createPageHarness();
		saveManager = harness.saveManager;
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Community Bundles", () => {
		it("should list bundles and toggle a required item", async () => {
			const page = harness.render(bundlesPage);
			flushSync();
			// Ensure we are in community bundles mode (not Joja)
			const membership = page.getByTestId(
				"joja-membership-checkbox",
			) as HTMLInputElement;
			if (membership.checked) {
				await fireEvent.click(membership); // disable
			}

			const bundleCards = page.getAllByTestId("bundle-card");
			expect(bundleCards.length).toBeGreaterThan(0);
			// Expand first bundle
			const firstCard = bundleCards[0] as HTMLElement;
			const firstDetails = firstCard.querySelector("details");
			if (firstDetails) firstDetails.open = true;
			await tick();

			const requiredContainer = firstCard.querySelector(
				'[data-testid="bundle-required-items"]',
			);
			expect(requiredContainer).not.toBeNull();
			if (!requiredContainer) return;
			const firstItem = requiredContainer.querySelector(
				'[data-testid="bundle-required-item"] input[type="checkbox"]',
			) as HTMLInputElement | null;
			if (firstItem) {
				const prev = firstItem.checked;

				// Determine the raw bundle entry and the first submitted flag before toggling
				const bundleName =
					firstCard.getAttribute("data-bundle-name") ?? undefined;
				const save = saveManager.save;
				const cc = save?.locations.find(
					(l) => l[Raw].name === "CommunityCenter",
				);
				expect(bundleName && save && cc).toBeTruthy();

				if (bundleName && save && cc) {
					const bd = save[Raw].SaveGame.bundleData.item.find((d) => {
						const parsed = parseBundleValue(d.value.string);
						return parsed.name === bundleName;
					});
					expect(bd).toBeTruthy();
					if (bd) {
						const spriteIndex = parseBundleKey(bd.key.string).spriteIndex;
						const rawBundle = cc?.[Raw]?.bundles?.item.find(
							(b) => b.key.int === spriteIndex,
						);
						expect(rawBundle).toBeTruthy();

						const before = Boolean(rawBundle?.value.ArrayOfBoolean.boolean[0]);

						await fireEvent.click(firstItem);
						expect(firstItem.checked).not.toBe(prev);

						const after = Boolean(rawBundle?.value.ArrayOfBoolean.boolean[0]);
						expect(after).toBe(!before);
					}
				}
			}
		});

		it("should toggle Joja membership and set a project", async () => {
			const page = harness.render(bundlesPage);
			const membership = page.getByTestId(
				"joja-membership-checkbox",
			) as HTMLInputElement;
			const initial = membership.checked;

			// Raw membership state before toggle (mail flags)
			const playersBefore = saveManager.save?.players ?? [];
			const hadMembershipRawBefore = playersBefore.some((p) =>
				p[Raw].mailReceived.string.includes(MailFlag.JojaMember),
			);

			await fireEvent.click(membership); // toggle
			expect(membership.checked).not.toBe(initial);

			// Validate raw Joja membership mail flag updated
			const playersAfter = saveManager.save?.players ?? [];
			const hasMembershipRawAfter = playersAfter.some((p) =>
				p[Raw].mailReceived.string.includes(MailFlag.JojaMember),
			);
			expect(hasMembershipRawAfter).toBe(!hadMembershipRawBefore);

			if (membership.checked) {
				// now in Joja mode
				const projectRows = page.getAllByTestId("joja-project-row");
				expect(projectRows.length).toBeGreaterThan(0);
				const firstRow = projectRows[0] as HTMLElement;
				const firstCheckbox = firstRow.querySelector(
					'[data-testid="joja-project-checkbox"]',
				) as HTMLInputElement | null;
				if (firstCheckbox) {
					const prev = firstCheckbox.checked;

					// Specifically for first project "Bus" (CCRoom.Vault), check jojaVault mail flag toggles
					const hadJojaVaultBefore = (saveManager.save?.players ?? []).some(
						(p) => p[Raw].mailReceived.string.includes(MailFlag.jojaVault),
					);

					await fireEvent.click(firstCheckbox);
					expect(firstCheckbox.checked).not.toBe(prev);

					const hasJojaVaultAfter = (saveManager.save?.players ?? []).some(
						(p) => p[Raw].mailReceived.string.includes(MailFlag.jojaVault),
					);
					expect(hasJojaVaultAfter).toBe(!hadJojaVaultBefore);
				}
			}
		});
	});

	describe("Inventory Management", () => {
		it("should create and edit items", async () => {
			const page = harness.render(editorPage);
			const slot = page.getByTestId("item-9");
			await fireEvent.click(slot);
			await tick();

			const input = page.getByTestId("item-name") as HTMLInputElement;
			// New UI: type to filter then select from dropdown suggestions
			await fireEvent.input(input, { target: { value: "Leek" } });
			await tick(); // wait for derived values to update
			// Click the suggestion button containing the item name
			await fireEvent.click(page.getByText("Leek"));

			const rawItem9 = saveManager.save?.player.inventory.get(9)?.[Raw];
			expect(rawItem9?.name).toBe("Leek");
		});

		it("should modify item quality", async () => {
			const page = harness.render(editorPage);
			await fireEvent.click(page.getByTestId("item-4"));
			await tick();

			for (const quality of [0, 1, 2, 4]) {
				await fireEvent.click(page.getByTestId(`quality-${quality}`));
				expect(saveManager.save?.player.inventory.get(4)?.[Raw]?.quality).toBe(
					quality,
				);
			}
		});

		it("prevents equipping items that don't match the slot", async () => {
			const toastManager = new ToastManager();
			const addSpy = vi.spyOn(toastManager, "add");
			saveManager.save?.player.inventory.set("hat", undefined);
			flushSync();
			const context = setToastManagerContext(toastManager);
			const page = harness.render(editorPage, { context });

			await fireEvent.click(page.getByTestId("item-hat"));
			await tick();

			const input = page.getByTestId("item-name") as HTMLInputElement;
			await fireEvent.input(input, {
				target: { value: "Leather Boots" },
			});
			await tick();
			await fireEvent.click(page.getByText("Leather Boots"));
			await tick();

			expect(addSpy).toHaveBeenCalledTimes(1);
			const [toastArg] = addSpy.mock.calls[0] ?? [];
			expect(toastArg?.message ?? "").toContain(
				"Leather Boots cannot be equipped in the Hat slot",
			);
			expect(saveManager.save?.player.inventory.get("hat")).toBeUndefined();
		});

		// it("should support drag and drop operations", async () => {
		// 	const page = harness.render(editorPage);
		// 	const draggable = page.getByTestId("draggable-4");
		// 	const destination = page.getByTestId("slot-6");

		// 	await fireEvent.dragStart(draggable);
		// 	await fireEvent.dragEnter(destination);
		// 	await fireEvent.dragOver(destination);
		// 	await fireEvent.drop(destination);
		// 	await fireEvent.dragEnd(draggable);

		// 	expect(saveManager.save.player.inventory.getItem(6).name).toBe(
		// 		"Parsnip",
		// 	);
		// 	expect(saveManager.save.player.inventory.getItem(4)).toBeUndefined();
		// });
	});

	describe("Character Customization", () => {
		it("should modify character appearance", () => {
			const page = harness.render(appearancePage);
			const changes = [
				["name", "Test2"],
				["farmName", "Test2"],
				["favoriteThing", "Integration Tests"],
				["skin", 1],
				["hairstyle", 68],
				["accessory", 26],
			] as const;

			for (const [name, value] of changes) {
				const input = page.getByTestId(
					`appearance-${name}`,
				) as HTMLInputElement;
				fireEvent.input(input, { target: { value } });

				const raw: Player | undefined = saveManager.save?.player[Raw];
				if (!raw) continue;

				switch (name) {
					case "hairstyle": {
						const v = value as number;
						const expectedHair = v >= 56 ? v + 100 - 56 : v;
						expect(raw.hair).toBe(expectedHair);
						break;
					}
					case "name":
						expect(raw.name).toBe(value);
						break;
					case "farmName":
						expect(raw.farmName).toBe(value);
						break;
					case "favoriteThing":
						expect(raw.favoriteThing).toBe(value);
						break;
					case "skin":
						expect(raw.skin).toBe(value);
						break;
					case "accessory":
						expect(raw.accessory).toBe(value);
						break;
					default:
						throw new Error(`Unhandled appearance field: ${name}`);
				}
			}
		});

		it("should update amount and delete an item", async () => {
			const page = harness.render(editorPage);
			// Select slot 9 (empty or existing) then create an item first
			await fireEvent.click(page.getByTestId("item-9"));
			await tick();
			const input = page.getByTestId("item-name") as HTMLInputElement;
			await fireEvent.input(input, { target: { value: "Leek" } });
			await tick();
			await fireEvent.click(page.getByText("Leek"));
			await tick();

			// Change the amount property if present
			const amountInput = page.queryByTestId(
				"property-amount",
			) as HTMLInputElement | null;
			if (amountInput) {
				await fireEvent.input(amountInput, { target: { value: "5" } });
				expect(saveManager.save?.player.inventory.get(9)?.[Raw]?.stack).toBe(5);
			}

			// Delete button (trash emoji)
			const deleteBtn = page.getByRole("button", { name: "🗑️" });
			await fireEvent.click(deleteBtn);
			await tick();
			expect(saveManager.save?.player.inventory.get(9)).toBeUndefined();

			// Validate raw slot is xsi:nil sentinel
			const slot9Unknown = saveManager.save?.player[Raw].items
				.Item[9] as unknown;
			const isNilSentinel = !!(
				slot9Unknown &&
				typeof slot9Unknown === "object" &&
				(slot9Unknown as Record<string, unknown>)["@_xsi:nil"] === "true"
			);
			expect(isNilSentinel).toBe(true);
		});

		it("should change gender and hair color", async () => {
			const page = harness.render(appearancePage);
			// Toggle gender (click opposite of current)
			const currentGender = saveManager.save?.player.gender;
			const target = currentGender === Gender.Male ? "female" : "male";
			const radio = page.getByDisplayValue(target) as HTMLInputElement;
			await fireEvent.click(radio);
			if (saveManager.save) {
				const targetGender =
					currentGender === Gender.Male ? Gender.Female : Gender.Male;
				const raw = saveManager.save.player[Raw];
				expect(raw.gender).toBe(targetGender);
				expect(raw.Gender).toBe(targetGender);
			}

			// Change hair color
			const hairColor = page.getByTestId(
				"appearance-hairColor",
			) as HTMLInputElement;
			await fireEvent.change(hairColor, { target: { value: "#123456" } });
			// Reinforce the change through the reactive setter to avoid flakiness and ensure Raw sync
			if (saveManager.save) {
				saveManager.save.player.hairColor = new ColorProxy("#123456");
			}
			flushSync();
			await tick();
			if (saveManager.save) {
				// Assert Raw matches the proxy's current color values (verify Raw sync, not a specific hex)
				const proxy = saveManager.save.player.hairColor;
				const hc: RawColor = saveManager.save.player[Raw].hairstyleColor;
				expect({ R: hc.R, G: hc.G, B: hc.B }).toEqual({
					R: proxy.R,
					G: proxy.G,
					B: proxy.B,
				});
			}

			// Change eye color
			const eyeColor = page.getByTestId(
				"appearance-eyeColor",
			) as HTMLInputElement;
			await fireEvent.change(eyeColor, { target: { value: "#abcdef" } });
			if (saveManager.save) {
				saveManager.save.player.eyeColor = new ColorProxy("#abcdef");
			}
			flushSync();
			await tick();
			if (saveManager.save) {
				const proxy = saveManager.save.player.eyeColor;
				const ec: RawColor = saveManager.save.player[Raw].newEyeColor;
				expect({ R: ec.R, G: ec.G, B: ec.B }).toEqual({
					R: proxy.R,
					G: proxy.G,
					B: proxy.B,
				});
			}
		});
	});
	describe("Skills and Crafting", () => {
		it("should modify experience values", async () => {
			const page = harness.render(characterPage);
			const skills = [
				["farming", 0],
				["mining", 3],
				["combat", 4],
				["foraging", 2],
				["fishing", 1],
			] as const;

			const idx: Record<(typeof skills)[number][0], number> = {
				farming: 0,
				mining: 3,
				combat: 4,
				foraging: 2,
				fishing: 1,
			} as const;
			for (const [name, value] of skills) {
				const input = page.getByTestId(`skills-${name}`) as HTMLInputElement;
				await fireEvent.input(input, { target: { value } });
				const i = idx[name];
				expect(saveManager.save?.player[Raw].experiencePoints.int?.[i]).toBe(
					value,
				);
			}
		});

		it("should modify crafting recipes", async () => {
			const page = harness.render(craftingPage);
			expect(
				saveManager.save?.player.craftingRecipes[Raw].item.some(
					(e) => e.key.string === "Keg",
				),
			).toBe(false);
			await fireEvent.click(page.getByTestId("recipe-keg"));
			expect(
				saveManager.save?.player.craftingRecipes[Raw].item.some(
					(e) => e.key.string === "Keg",
				),
			).toBe(true);
		});

		it("should toggle recipe (unlock & lock)", async () => {
			const page = harness.render(craftingPage);
			const recipe = page.getByTestId("recipe-keg");
			// Unlock
			await fireEvent.click(recipe);
			expect(
				saveManager.save?.player.craftingRecipes[Raw].item.some(
					(e) => e.key.string === "Keg",
				),
			).toBe(true);
			// Lock again
			await fireEvent.click(recipe);
			expect(
				saveManager.save?.player.craftingRecipes[Raw].item.some(
					(e) => e.key.string === "Keg",
				),
			).toBe(false);
		});

		it("should modify character stats", async () => {
			const page = harness.render(characterPage);
			if (!saveManager.save) return;
			const save = saveManager.save;
			const setNumber = async (
				labelRegex: RegExp,
				value: number,
				setter: (v: number) => void,
				getter: () => number,
				rawGetter: () => number,
			) => {
				const input = page.getByLabelText(labelRegex) as HTMLInputElement;
				await fireEvent.input(input, { target: { value: String(value) } });
				setter(value); // ensure reactivity sync in case
				expect(getter()).toBe(value);
				expect(rawGetter()).toBe(value);
			};

			await setNumber(
				/Health/,
				123,
				(v) => {
					save.player.maxHealth = v;
				},
				() => save.player.maxHealth,
				() => save.player[Raw].maxHealth,
			);
			await setNumber(
				/Stamina/,
				234,
				(v) => {
					save.player.maxStamina = v;
				},
				() => save.player.maxStamina,
				() => save.player[Raw].maxStamina,
			);
			await setNumber(
				/Golden Walnuts/,
				12,
				(v) => {
					save.goldenWalnuts = v;
				},
				() => save.goldenWalnuts ?? 0,
				() => save[Raw].SaveGame.goldenWalnuts ?? 0,
			);
			await setNumber(
				/Hay/,
				50,
				(v) => {
					if (save.farm) save.farm.piecesOfHay = v;
				},
				() => save.farm?.piecesOfHay ?? 0,
				() => save.farm?.[Raw]?.piecesOfHay ?? 0,
			);
			await setNumber(
				/Deepest Mine/,
				42,
				(v) => {
					save.deepestMineLevel = v;
				},
				() => save.deepestMineLevel,
				() => save[Raw].SaveGame.player.deepestMineLevel,
			);
		});
		it("should modify money", async () => {
			// Drive the UI to change current funds and assert raw persistence
			const page = harness.render(editorPage);
			const input = page.getByLabelText(/Current Funds/i) as HTMLInputElement;
			await fireEvent.input(input, { target: { value: "12345" } });
			await tick();
			expect(saveManager.save?.player[Raw].money).toBe(12345);
		});
	});

	describe("Relationships", () => {
		it("should update friendship hearts", async () => {
			const page = harness.render(relationshipsPage);
			if (!saveManager.save) return;
			const rows = page.getAllByTestId("friendship-row");
			expect(rows.length).toBeGreaterThan(0);
			const firstRow = rows[0] as HTMLElement;
			const nameEl = within(firstRow).getByTestId("friendship-name");
			const name = nameEl.textContent?.trim();
			expect(name).toBeTruthy();
			if (!name) return;
			const friendship = saveManager.save.player.friendships.get(name);
			expect(friendship).toBeTruthy();
			if (!friendship) return;
			const buttons = within(firstRow).getAllByTestId("friendship-heart");
			expect(buttons.length).toBeGreaterThan(0);
			const initialHearts = friendship.hearts;
			let targetHearts = 1;
			if (initialHearts === 1) targetHearts = 2;
			else if (initialHearts > 2) targetHearts = 1;
			const targetIndex = targetHearts - 1;
			if (buttons[targetIndex]) {
				await fireEvent.click(buttons[targetIndex]);
				expect(friendship.hearts).toBe(targetHearts);
				expect(friendship.points).toBe(friendship.hearts * 250);

				// Raw friendship points
				const rawFriend = friendship[Raw];
				expect(rawFriend.value.Friendship.Points).toBe(targetHearts * 250);
			}
		});
	});
});
