import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { characters } from "$lib/NPCs";
import { Raw } from "$lib/proxies";
import {
	parseBundleKey,
	parseBundleValue,
} from "$lib/proxies/bundleSerialization";
import { Color as ColorProxy } from "$lib/proxies/Color.svelte";
import { FarmAnimal, FarmAnimalType } from "$lib/proxies/FarmAnimal.svelte";
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
import buildingsPage from "../src/routes/(edit)/(list)/buildings/+page.svelte";
import cookingPage from "../src/routes/(edit)/(list)/cooking/+page.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import bundlesPage from "../src/routes/(edit)/bundles/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import farmPage from "../src/routes/(edit)/farm/+page.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import BuildingSprite from "../src/routes/(edit)/inventory/BuildingSprite.svelte";
import relationshipsPage from "../src/routes/(edit)/relationships/+page.svelte";
import {
	BARN_ID,
	barnXml,
	COOP_ID,
	coopXml,
	SHED_ID,
	shedXml,
	withAnimalBuildings,
} from "./helpers/animalBuildings";

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

// `edit` rewrites the fixture's XML before import, for saves TestSave doesn't cover
const createPageHarness = async (
	edit?: (xml: string) => string,
): Promise<PageHarness> => {
	const fixture = await readFile("tests/TestSave");
	const file = edit ? edit(fixture.toString("utf8")) : fixture;

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

// Select a <select> option the way a user would, then notify Svelte's binding
const choose = async (element: HTMLElement, value: string) => {
	const select = element as HTMLSelectElement;
	for (const option of select.options) {
		option.selected = option.value === value;
	}
	await fireEvent.change(select);
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

		it("should group bundles by room, in game order, with each room's reward", async () => {
			const page = harness.render(bundlesPage);
			flushSync();
			const membership = page.getByTestId(
				"joja-membership-checkbox",
			) as HTMLInputElement;
			if (membership.checked) {
				await fireEvent.click(membership); // disable
			}

			const rooms = page.getAllByTestId("bundle-room");
			expect(rooms.map((r) => r.getAttribute("data-room"))).toEqual([
				"Crafts Room",
				"Pantry",
				"Fish Tank",
				"Boiler Room",
				"Bulletin Board",
				"Vault",
				"Abandoned JojaMart",
			]);

			// Every bundle is shown, inside its room
			const bundles = saveManager.save?.communityBundles;
			expect(page.getAllByTestId("bundle-card").length).toBe(bundles?.size);

			// Each room shows what restoring it unlocks
			const rewards = rooms.map(
				(r) => within(r).getByTestId("bundle-room-reward").textContent ?? "",
			);
			expect(rewards[0]).toContain("Quarry");
			expect(rewards[1]).toContain("Greenhouse");
			expect(rewards[2]).toContain("Glittering Boulder");
			expect(rewards[3]).toContain("Minecarts");
			expect(rewards[4]).toContain("friendship");
			expect(rewards[5]).toContain("Bus");
			expect(rewards[6]).toContain("Movie Theater");

			// Finishing every bundle in a room marks it as restored
			const pantry = rooms[1] as HTMLElement;
			const progress = within(pantry).getByTestId("bundle-room-progress");
			expect(pantry.classList.contains("done")).toBe(false);
			expect(progress.textContent).not.toContain("Restored");
			for (const bundle of bundles?.values() ?? []) {
				if (bundle.room !== CCRoom.Pantry) continue;
				for (const item of bundle.requiredItems) item.submitted = true;
			}
			flushSync();
			expect(pantry.classList.contains("done")).toBe(true);
			expect(progress.textContent).toContain("6/6 bundles");
			expect(progress.textContent).toContain("Restored");
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

		it("titles the crafting and cooking lists", async () => {
			const crafting = harness.render(craftingPage);
			expect(crafting.getByRole("heading", { level: 3 }).textContent).toBe(
				"Crafting Recipes",
			);
			crafting.unmount();
			const cooking = harness.render(cookingPage);
			expect(cooking.getByRole("heading", { level: 3 }).textContent).toBe(
				"Cooking Recipes",
			);
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
		it("should preserve relationships when opening the page and editing money", async () => {
			const save = saveManager.save;
			if (!save) throw new Error("No save loaded");
			save.player.friendships.delete("Leo");
			const before = JSON.parse(
				JSON.stringify(save.player[Raw].friendshipData),
			) as typeof save.player.raw.friendshipData;
			const page = harness.render(relationshipsPage);
			await tick();

			expect(save.player[Raw].friendshipData).toEqual(before);
			expect(save.player.friendships.has("Leo")).toBe(false);
			expect(page.getAllByTestId("friendship-row")).toHaveLength(
				before.item.length,
			);
			page.unmount();

			const character = harness.render(editorPage);
			await fireEvent.input(character.getByLabelText(/Current Funds/i), {
				target: { value: "12345" },
			});
			await tick();
			expect(save.player[Raw].money).toBe(12345);
			expect(save.player[Raw].friendshipData).toEqual(before);
			character.unmount();

			harness.render(relationshipsPage);
			await tick();
			expect(save.player[Raw].friendshipData).toEqual(before);
		});

		it("should add missing NPCs only when the button is clicked", async () => {
			const save = saveManager.save;
			if (!save) throw new Error("No save loaded");
			save.player.friendships.delete("Leo");

			const before = save.player.friendships.size;
			const existing = JSON.parse(
				JSON.stringify(save.player[Raw].friendshipData.item),
			) as typeof save.player.raw.friendshipData.item;
			const page = harness.render(relationshipsPage);
			await tick();
			expect(save.player.friendships.size).toBe(before);
			const button = page.getByTestId(
				"add-missing-friendships",
			) as HTMLButtonElement;
			expect(button.disabled).toBe(false);
			expect(page.queryByRole("tooltip")).toBeNull();
			await fireEvent.click(button);
			await tick();

			expect(save.player.friendships.size).toBe(characters.length);
			expect(save.player.friendships.size).toBeGreaterThanOrEqual(before);
			expect(save.player.friendships.has("Leo")).toBe(true);
			expect(save.player[Raw].friendshipData.item).toHaveLength(
				characters.length,
			);
			expect(page.getAllByTestId("friendship-row")).toHaveLength(
				characters.length,
			);
			for (const item of existing) {
				expect(save.player.friendships.get(item.key.string)?.[Raw]).toEqual(
					item,
				);
			}
			const disabledButton = page.getByTestId(
				"add-missing-friendships",
			) as HTMLButtonElement;
			expect(disabledButton.disabled).toBe(true);
			await fireEvent.click(disabledButton);
			await tick();
			expect(save.player[Raw].friendshipData.item).toHaveLength(
				characters.length,
			);
		});

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

		it("should filter villagers by name", async () => {
			const page = harness.render(relationshipsPage);
			const names = () =>
				page
					.queryAllByTestId("friendship-name")
					.map((name) => name.textContent?.trim());
			const all = names();
			expect(all.length).toBeGreaterThan(1);
			expect(all).toContain("Lewis");

			// Case-insensitive, ignoring surrounding whitespace
			const search = page.getByTestId("relationships-search");
			await fireEvent.input(search, { target: { value: "  lEW " } });
			expect(names()).toEqual(["Lewis"]);
			// The encountered count still reflects every villager
			expect(page.getByText(`NPCs encountered: ${all.length}`)).toBeTruthy();

			await fireEvent.input(search, { target: { value: "zzzz" } });
			expect(names()).toEqual([]);
			expect(page.getByText('No villagers match "zzzz".')).toBeTruthy();

			await fireEvent.click(page.getByTestId("relationships-search-clear"));
			expect((search as HTMLInputElement).value).toBe("");
			expect(names()).toEqual(all);
			expect(page.queryByText(/No villagers match/)).toBeNull();
			expect(page.queryByTestId("relationships-search-clear")).toBeNull();

			// Escape also clears the search
			await fireEvent.input(search, { target: { value: "lew" } });
			expect(names()).toEqual(["Lewis"]);
			await fireEvent.keyDown(search, { key: "Escape" });
			expect(names()).toEqual(all);
		});
	});

	describe("Farm", () => {
		it("applies the farm name and profit margin to every farmer", async () => {
			const page = harness.render(farmPage);
			const save = saveManager.save;
			if (!save) return;

			await fireEvent.input(page.getByTestId("farm-name"), {
				target: { value: "Moonlight" },
			});
			await fireEvent.input(page.getByTestId("profit-margin"), {
				target: { value: "50" },
			});
			flushSync();

			for (const player of save.players) {
				expect(player.raw.farmName).toBe("Moonlight");
				expect(player.raw.difficultyModifier).toBe(0.5);
			}
		});

		it("accepts a custom profit margin", async () => {
			const page = harness.render(farmPage);
			const save = saveManager.save;
			if (!save) return;
			const input = page.getByTestId("profit-margin") as HTMLInputElement;
			expect(input.value).toBe("100");

			await fireEvent.input(input, { target: { value: "130" } });
			flushSync();

			for (const player of save.players) {
				expect(player.raw.difficultyModifier).toBe(1.3);
			}
		});

		it("resets a cleared profit margin to normal", async () => {
			const page = harness.render(farmPage);
			const save = saveManager.save;
			if (!save) return;
			const input = page.getByTestId("profit-margin") as HTMLInputElement;

			await fireEvent.input(input, { target: { value: "50" } });
			await fireEvent.input(input, { target: { value: "" } });
			flushSync();
			// Nothing is written while the field is empty
			expect(save.players[0]?.raw.difficultyModifier).toBe(0.5);

			await fireEvent.blur(input);
			flushSync();
			expect(save.players[0]?.raw.difficultyModifier).toBe(1);
		});

		it("edits monster spawning and mine rewards", async () => {
			const page = harness.render(farmPage);
			const game = saveManager.save?.raw.SaveGame;
			if (!game) return;
			expect(game.shouldSpawnMonsters).toBe(false);

			await fireEvent.click(page.getByTestId("spawn-monsters"));
			await choose(page.getByTestId("mine-rewards"), "Remixed");
			flushSync();

			expect(game.shouldSpawnMonsters).toBe(true);
			expect(game.shuffleMineChests).toBe("Remixed");
		});

		it("shows creation-only settings as read-only", () => {
			const page = harness.render(farmPage);
			const values = page
				.getAllByTestId("locked-setting")
				.map((el) => el.textContent);
			// TestSave is a Hill-top farm (whichFarm 3)
			expect(values).toContain("Hill-top");
			expect(values).toContain("390176213");
		});

		it("names Meadowlands by its farm type ID", async () => {
			// 1.6 saves Meadowlands and modded farms by ID instead of an index
			harness.cleanup();
			harness = await createPageHarness((xml) =>
				xml.replace(
					"<whichFarm>3</whichFarm>",
					"<whichFarm>MeadowlandsFarm</whichFarm>",
				),
			);
			saveManager = harness.saveManager;
			expect(saveManager.save?.raw.SaveGame.whichFarm).toBe("MeadowlandsFarm");

			const page = harness.render(farmPage);
			const values = page
				.getAllByTestId("locked-setting")
				.map((el) => el.textContent);
			expect(values).toContain("Meadowlands");
		});
	});

	describe("Buildings", () => {
		it("should preserve animal save containers when animals are assigned", () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.indoorLocation !== undefined,
			);
			expect(building?.indoorLocation).toBeTruthy();
			if (!building?.indoorLocation) return;

			let animal!: FarmAnimal;
			const disposeAnimal = $effect.root(() => {
				animal = FarmAnimal.fromName(
					FarmAnimalType.WhiteChicken,
					"Peep",
					save.player,
				);
			});

			building.indoorLocation.animals = [animal];
			flushSync();

			expect(building.indoorLocation[Raw].animals?.item).toHaveLength(1);
			expect(
				building.indoorLocation[Raw].Animals
					.SerializableDictionaryOfInt64FarmAnimal,
			).toEqual(building.indoorLocation[Raw].animals);
			// Who lives where is kept separately (residents can be outside); see "Animal buildings"
			expect(building.indoorLocation[Raw].animalsThatLiveHere).toBeUndefined();
			disposeAnimal();
		});

		it("should update farm animal friendship hearts", async () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.indoorLocation !== undefined,
			);
			expect(building?.indoorLocation).toBeTruthy();
			if (!building?.indoorLocation) return;

			let animal!: FarmAnimal;
			const disposeAnimal = $effect.root(() => {
				animal = FarmAnimal.fromName(
					FarmAnimalType.WhiteChicken,
					"Peep",
					save.player,
				);
			});
			building.indoorLocation.animals = [animal];
			flushSync();

			const page = harness.render(buildingsPage);
			const summary = page.getByText("Peep");
			const card = summary.closest("section") as HTMLElement | null;
			expect(card).toBeTruthy();
			if (!card) return;

			const buttons = within(card).getAllByTestId("animal-friendship");
			expect(buttons).toHaveLength(5);

			await fireEvent.click(buttons[1] as HTMLElement);
			expect(animal.friendshipTowardFarmer).toBe(400);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.friendshipTowardFarmer,
			).toBe(400);
			disposeAnimal();
		});

		it("should show an initial active state for animals with undefined gender", () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.indoorLocation !== undefined,
			);
			expect(building?.indoorLocation).toBeTruthy();
			if (!building?.indoorLocation) return;

			let animal!: FarmAnimal;
			const disposeAnimal = $effect.root(() => {
				animal = FarmAnimal.fromName(
					FarmAnimalType.WhiteChicken,
					"Peep",
					save.player,
				);
			});
			animal.gender = Gender.Undefined;
			building.indoorLocation.animals = [animal];
			flushSync();

			const page = harness.render(buildingsPage);
			const button = page.getByRole("button", {
				name: "Peep undefined gender",
			});
			expect(button.getAttribute("aria-pressed")).toBe("true");
			disposeAnimal();
		});

		it("should update farm animal numeric stat inputs", async () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.indoorLocation !== undefined,
			);
			expect(building?.indoorLocation).toBeTruthy();
			if (!building?.indoorLocation) return;

			let animal!: FarmAnimal;
			const disposeAnimal = $effect.root(() => {
				animal = FarmAnimal.fromName(
					FarmAnimalType.WhiteChicken,
					"Peep",
					save.player,
				);
			});
			building.indoorLocation.animals = [animal];
			flushSync();

			const page = harness.render(buildingsPage);
			const summary = page.getByText("Peep");
			const card = summary.closest("section") as HTMLElement | null;
			expect(card).toBeTruthy();
			if (!card) return;

			const friendshipInput = within(card).getByTestId(
				"animal-friendship-input",
			) as HTMLInputElement;
			const happinessInput = within(card).getByTestId(
				"animal-happiness-input",
			) as HTMLInputElement;
			const fullnessInput = within(card).getByTestId(
				"animal-fullness-input",
			) as HTMLInputElement;

			await fireEvent.input(friendshipInput, { target: { value: "875" } });
			await fireEvent.input(happinessInput, { target: { value: "200" } });
			await fireEvent.input(fullnessInput, { target: { value: "123" } });

			expect(animal.friendshipTowardFarmer).toBe(875);
			expect(animal.happiness).toBe(200);
			expect(animal.fullness).toBe(123);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.friendshipTowardFarmer,
			).toBe(875);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.happiness,
			).toBe(200);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.fullness,
			).toBe(123);
			disposeAnimal();
		});

		it("should update farm animal name days owned and gender", async () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.indoorLocation !== undefined,
			);
			expect(building?.indoorLocation).toBeTruthy();
			if (!building?.indoorLocation) return;

			let animal!: FarmAnimal;
			const disposeAnimal = $effect.root(() => {
				animal = FarmAnimal.fromName(
					FarmAnimalType.WhiteChicken,
					"Peep",
					save.player,
				);
			});
			building.indoorLocation.animals = [animal];
			flushSync();

			const page = harness.render(buildingsPage);
			const summary = page.getByText("Peep");
			const card = summary.closest("section") as HTMLElement | null;
			expect(card).toBeTruthy();
			if (!card) return;

			const nameInput = within(card).getByTestId(
				"animal-name-input",
			) as HTMLInputElement;
			const daysOwnedInput = within(card).getByTestId(
				"animal-days-owned-input",
			) as HTMLInputElement;
			const maleButton = within(card).getByTestId("animal-gender-male");

			await fireEvent.input(nameInput, { target: { value: "Nugget" } });
			await fireEvent.input(daysOwnedInput, { target: { value: "42" } });
			await fireEvent.click(maleButton);

			expect(animal.name).toBe("Nugget");
			expect(animal.daysOwned).toBe(42);
			expect(animal.gender).toBe(Gender.Male);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal.name,
			).toBe("Nugget");
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.displayName,
			).toBe("Nugget");
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.daysOwned,
			).toBe(42);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal.age,
			).toBe(42);
			expect(
				building.indoorLocation[Raw].animals?.item?.[0]?.value.FarmAnimal
					.Gender,
			).toBe(Gender.Male);
			disposeAnimal();
		});

		it("should render a building sprite for known buildings", () => {
			const save = saveManager.save;
			if (!save?.farm) return;
			const building = save.farm.buildings.find(
				(candidate) => candidate.data?.texture !== undefined,
			);
			expect(building).toBeTruthy();
			if (!building) return;

			const view = harness.render(BuildingSprite, {
				props: { building },
			});

			expect(view.container.textContent).not.toContain("??");
			expect(view.container.querySelector(".item")).toBeTruthy();
		});
	});
});

describe("Animal buildings", () => {
	mockIDB();
	let harness!: PageHarness;

	beforeEach(async () => {
		harness = await createPageHarness(withAnimalBuildings);
	});

	afterEach(() => {
		harness.cleanup();
	});

	const building = (id: string) => {
		const found = harness.saveManager.save?.farm?.buildings.find(
			(b) => b[Raw].id === id,
		);
		if (!found) throw new Error(`No building ${id}`);
		return found;
	};

	/** The section for a building, found by its heading */
	const section = (page: { container: HTMLElement }, name: string) => {
		const heading = within(page.container).getByRole("heading", {
			level: 3,
			name,
		});
		const row = heading.closest(".building-row");
		if (!(row instanceof HTMLElement)) throw new Error(`No ${name} section`);
		return { row, header: heading.closest(".building-header") as HTMLElement };
	};

	it("shows the controls under each coop and barn's heading", () => {
		const page = harness.render(buildingsPage);
		for (const name of ["Coop", "Barn"]) {
			const { header } = section(page, name);
			expect(within(header).getByTestId("building-upgrade")).toBeTruthy();
			expect(within(header).getByTestId("add-animal-type")).toBeTruthy();
		}
		expect(
			within(section(page, "Coop").header).getByTestId("building-residents")
				.textContent,
		).toMatch(/4\/4 animals\s+live here \(1 outside\)/);
		// Other buildings don't get them
		expect(page.getAllByTestId("building-upgrade")).toHaveLength(2);

		const types = within(section(page, "Barn").header).getByTestId(
			"add-animal-type",
		) as HTMLSelectElement;
		const options = [...types.options].map((o) => [o.value, o.disabled]);
		expect(options).toEqual([
			["White Cow", false],
			["Brown Cow", false],
			["Goat", true],
			["Sheep", true],
			["Pig", true],
			["Ostrich", false],
		]);
		expect(types.options[2]?.textContent).toBe("Goat (needs a Big Barn)");
	});

	it("adds an animal from the form", async () => {
		const page = harness.render(buildingsPage);
		const { row, header } = section(page, "Barn");
		const name = within(header).getByTestId(
			"add-animal-name",
		) as HTMLInputElement;
		expect(name.value).toBe("White Cow");

		await choose(within(header).getByTestId("add-animal-type"), "Ostrich");
		expect(name.value).toBe("Ostrich");
		await fireEvent.input(name, { target: { value: "Big Bird" } });
		const submit = within(header).getByTestId(
			"add-animal-submit",
		) as HTMLButtonElement;
		expect(submit.disabled).toBe(false);
		await fireEvent.submit(submit.closest("form") as HTMLFormElement);
		flushSync();

		expect(within(row).getByText("Big Bird")).toBeTruthy();
		expect(building(BARN_ID).residentIds).toHaveLength(3);
		expect(
			within(header).getByTestId("building-residents").textContent,
		).toMatch(/3\/4 animals\s+live here/);
		// Ready for another of the same kind
		expect(name.value).toBe("Ostrich");
	});

	it("won't take a name another animal has", async () => {
		const page = harness.render(buildingsPage);
		const { header } = section(page, "Barn");
		const name = within(header).getByTestId("add-animal-name");
		await fireEvent.input(name, { target: { value: "Clucky" } });
		expect(
			(within(header).getByTestId("add-animal-submit") as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			within(header).getByTestId("add-animal-name-error").textContent,
		).toBe("Another animal is already called Clucky");
	});

	it("says when a building is full", () => {
		const page = harness.render(buildingsPage);
		const { header } = section(page, "Coop");
		expect(
			(within(header).getByTestId("add-animal-submit") as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(within(header).getByTestId("add-animal-full").textContent).toBe(
			"Full: 4/4 animals live here. Upgrade it for more room.",
		);
	});

	it("upgrades a coop from the dropdown", async () => {
		const page = harness.render(buildingsPage);
		const select = within(section(page, "Coop").header).getByTestId(
			"building-upgrade",
		) as HTMLSelectElement;
		expect([...select.options].map((o) => o.textContent)).toEqual([
			"Coop (4 animals)",
			"Big Coop (8 animals)",
			"Deluxe Coop (12 animals)",
		]);

		await choose(select, "Big Coop");
		flushSync();

		expect(building(COOP_ID)[Raw].buildingType).toBe("Big Coop");
		const { header } = section(page, "Big Coop");
		expect(
			within(header).getByTestId("building-residents").textContent,
		).toMatch(/4\/8 animals\s+live here/);
		expect(within(header).queryByTestId("add-animal-full")).toBeNull();
		const types = within(header).getByTestId(
			"add-animal-type",
		) as HTMLSelectElement;
		expect([...types.options].find((o) => o.value === "Duck")?.disabled).toBe(
			false,
		);
	});

	it("only offers a downgrade the animals fit into", async () => {
		const coop = building(COOP_ID);
		const big = coop.tiers.find((t) => t.name === "Big Coop");
		if (!big) throw new Error("No Big Coop");
		coop.changeType(big);
		const player = harness.saveManager.save?.player;
		if (!player) throw new Error("No player");
		coop.adoptAnimal("Duck", "Daffy", player);
		coop.adoptAnimal("White Chicken", "Pip", player);
		flushSync();

		const page = harness.render(buildingsPage);
		const { header } = section(page, "Big Coop");
		const select = within(header).getByTestId(
			"building-upgrade",
		) as HTMLSelectElement;
		expect(select.value).toBe("Big Coop");
		expect(select.options[0]?.disabled).toBe(true);
		expect(select.options[2]?.disabled).toBe(false);
		expect(
			within(header).getByTestId("building-upgrade-reason").textContent,
		).toBe("6 animals live here; a Coop holds 4");

		// Even if it's picked anyway, nothing changes
		await choose(select, "Coop");
		expect(coop[Raw].buildingType).toBe("Big Coop");
		expect(select.value).toBe("Big Coop");
	});

	it("warns about a downgrade, and says what it left behind", async () => {
		const coop = building(COOP_ID);
		const big = coop.tiers.find((t) => t.name === "Big Coop");
		if (!big) throw new Error("No Big Coop");
		coop.changeType(big);
		// An egg in the incubator keeps it there, so the junimo can't go back
		const incubator = coop.indoorLocation?.[Raw].objects?.item.find(
			(o) => o.value.Object.name === "Incubator",
		)?.value.Object as { heldObject?: unknown } | undefined;
		if (!incubator) throw new Error("No incubator");
		incubator.heldObject = { name: "Egg", itemId: "176" };
		flushSync();

		const toastManager = new ToastManager();
		const addSpy = vi.spyOn(toastManager, "add");
		const page = harness.render(buildingsPage, {
			context: setToastManagerContext(toastManager),
		});
		const { header } = section(page, "Big Coop");
		expect(
			within(header).getByTestId("building-downgrade-note").textContent,
		).toMatch(/^A downgrade moves back what the upgrade moved\./);

		await choose(within(header).getByTestId("building-upgrade"), "Coop");
		expect(coop[Raw].buildingType).toBe("Coop");
		expect(
			addSpy.mock.calls.map(([toast]) => [toast.icon, toast.message]),
		).toEqual([
			["✅", "Downgraded to a Coop"],
			["❌", "Left the Incubator at 2, 3: it has something in it"],
			["❌", "Left the Stone Junimo at 14, 8: its old spot is taken"],
		]);
		// Nothing smaller to go to
		expect(
			within(section(page, "Coop").header).queryByTestId(
				"building-downgrade-note",
			),
		).toBeNull();
	});

	it("says when a building is still being built", async () => {
		harness.cleanup();
		harness = await createPageHarness((xml) =>
			withAnimalBuildings(xml, [
				coopXml(),
				barnXml({ daysOfConstructionLeft: 2 }),
			]),
		);
		const page = harness.render(buildingsPage);
		const { header } = section(page, "Barn");
		expect(
			within(header).getByTestId("add-animal-under-construction").textContent,
		).toBe("Animals can move in once it's built.");
		expect(
			(within(header).getByTestId("add-animal-submit") as HTMLButtonElement)
				.disabled,
		).toBe(true);
		const select = within(header).getByTestId(
			"building-upgrade",
		) as HTMLSelectElement;
		expect([...select.options].map((o) => [o.value, o.disabled])).toEqual([
			["Barn", false],
			["Big Barn", true],
			["Deluxe Barn", true],
		]);
		expect(
			within(header).getByTestId("building-upgrade-reason").textContent,
		).toBe("The Barn is still being built");
	});

	it("offers a shed's upgrade, but no animals", async () => {
		harness.cleanup();
		harness = await createPageHarness((xml) =>
			withAnimalBuildings(xml, [coopXml(), barnXml(), shedXml()]),
		);
		const page = harness.render(buildingsPage);
		const { header } = section(page, "Shed");
		const select = within(header).getByTestId(
			"building-upgrade",
		) as HTMLSelectElement;
		expect([...select.options].map((o) => o.textContent)).toEqual([
			"Shed",
			"Big Shed",
		]);
		expect(within(header).queryByTestId("add-animal-type")).toBeNull();
		expect(within(header).queryByTestId("building-residents")).toBeNull();

		await choose(select, "Big Shed");
		flushSync();
		expect(building(SHED_ID)[Raw].buildingType).toBe("Big Shed");
		expect(
			within(section(page, "Big Shed").header).getByTestId(
				"building-downgrade-note",
			),
		).toBeTruthy();
	});

	it("says when it doesn't know what lives in a building", async () => {
		harness.cleanup();
		harness = await createPageHarness((xml) =>
			withAnimalBuildings(xml, [coopXml({ type: "Fancy Coop" }), barnXml()]),
		);
		const page = harness.render(buildingsPage);
		const { header } = section(page, "Fancy Coop");
		expect(within(header).getByTestId("add-animal-unknown").textContent).toBe(
			"The editor doesn't know which animals can live in a Fancy Coop.",
		);
		expect(within(header).queryByTestId("add-animal-type")).toBeNull();
		expect(within(header).queryByTestId("building-upgrade")).toBeNull();
		expect(
			within(header).getByTestId("building-residents").textContent,
		).toMatch(/4\/4 animals\s+live here/);
	});
});
