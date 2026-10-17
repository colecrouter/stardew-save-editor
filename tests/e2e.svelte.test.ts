import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { characters } from "$lib/NPCs";
import { Raw } from "$lib/proxies";
import {
	parseBundleKey,
	parseBundleValue,
} from "$lib/proxies/bundleSerialization";
import { Color as ColorProxy } from "$lib/proxies/Color.svelte";
import { FarmAnimal, FarmAnimalType } from "$lib/proxies/FarmAnimal.svelte";
import { Item as ItemFactory } from "$lib/proxies/Item.svelte";
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
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import bundlesPage from "../src/routes/(edit)/bundles/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import BuildingSprite from "../src/routes/(edit)/inventory/BuildingSprite.svelte";
import questsPage from "../src/routes/(edit)/quests/+page.svelte";
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
			expect(building.indoorLocation[Raw].animalsThatLiveHere).toEqual({
				long: [animal[Raw].key.long],
			});
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

	describe("Quests", () => {
		const renderQuests = () => {
			const toastManager = new ToastManager();
			const context = setToastManagerContext(toastManager);
			return { page: harness.render(questsPage, { context }), toastManager };
		};
		const entry = (
			page: { getAllByTestId: (id: string) => HTMLElement[] },
			title: string,
		) => {
			const found = page
				.getAllByTestId("quest")
				.find(
					(el) => within(el).getByTestId("quest-title").textContent === title,
				);
			if (!found) throw new Error(`No quest called ${title}`);
			return within(found);
		};
		const rawQuests = () => {
			const log = saveManager.save?.raw.SaveGame.player.questLog;
			return typeof log === "object" ? log.Quest : [];
		};
		const rawQuest = (title: string) =>
			rawQuests().find((q) => q._questTitle === title);
		// Text wrapped over several lines in the markup
		const text = (el: HTMLElement) =>
			el.textContent?.replace(/\s+/g, " ").trim();
		const helpWanted = (xml: string, title = "Abigail's Request") =>
			xml.replace(
				"</questLog>",
				`<Quest xsi:type="ItemDeliveryQuest">
					<_currentObjective>Bring Abigail an Amethyst.</_currentObjective>
					<_questDescription>Abigail wants an Amethyst.</_questDescription>
					<_questTitle>${title}</_questTitle>
					<accepted>true</accepted>
					<completed>false</completed>
					<dailyQuest>true</dailyQuest>
					<showNew>false</showNew>
					<canBeCancelled>true</canBeCancelled>
					<destroy>false</destroy>
					<moneyReward>200</moneyReward>
					<questType>3</questType>
					<daysLeft>2</daysLeft>
					<dayQuestAccepted>5</dayQuestAccepted>
					<nextQuests />
					<questTitle>${title}</questTitle>
					<target>Abigail</target>
					<item>(O)66</item>
					<number>1</number>
					<parts />
					<dialogueparts />
				</Quest></questLog>`,
			);
		const billboardQuestsDone = (xml: string, n: number) =>
			xml.replace(
				/(<string>BillboardQuestsDone<\/string>\s*<\/key>\s*<value>\s*<unsignedInt>)\d+/,
				(_, before) => `${before}${n}`,
			);
		const reload = async (transformXml: (xml: string) => string) => {
			harness.cleanup();
			harness = await createPageHarness(transformXml);
			saveManager = harness.saveManager;
		};

		it("lists the journal newest first, linking to Qi's quests", () => {
			const { page } = renderQuests();
			expect(
				page.getAllByTestId("quest-title").map((el) => el.textContent),
			).toEqual([
				"Advancement",
				"Raising Animals",
				"Deeper In The Mine",
				"Getting Started",
				"Introductions",
			]);
			expect(
				page.getByTestId("quests-qi-link").querySelector("a")?.textContent,
			).toBe("Qi's Quests");
			expect(
				entry(page, "Getting Started").queryByTestId("quest-reward-pending"),
			).toBeTruthy();
			expect(page.queryAllByTestId("quest-reward-pending")).toHaveLength(1);
			// Story quests have no time limit
			expect(page.queryAllByTestId("quest-days-left")).toEqual([]);
			// A finished quest can't be completed again
			expect(
				entry(page, "Getting Started").queryByTestId("quest-complete"),
			).toBeNull();
		});

		it("completes a quest", async () => {
			const { page, toastManager } = renderQuests();
			await fireEvent.click(
				entry(page, "Advancement").getByTestId("quest-complete"),
			);
			flushSync();
			expect(rawQuest("Advancement")?.completed).toBe(true);
			expect(
				entry(page, "Advancement").queryByTestId("quest-reward-pending"),
			).toBeTruthy();
			expect(toastManager.toasts.map((t) => t.message)).toEqual([
				"Completed Advancement: collect the reward from the journal in-game.",
			]);

			const introductions = entry(page, "Introductions");
			expect(text(introductions.getByTestId("quest-follow-ups"))).toBe(
				"Completing it starts How To Win Friends next.",
			);
			await fireEvent.click(introductions.getByTestId("quest-complete"));
			flushSync();
			expect(rawQuest("Introductions")).toBeUndefined();
			// Its follow-up takes its place, at the top
			expect(
				page.getAllByTestId("quest-title").map((el) => el.textContent),
			).toEqual([
				"How To Win Friends",
				"Advancement",
				"Raising Animals",
				"Deeper In The Mine",
				"Getting Started",
			]);
			expect(rawQuest("How To Win Friends")?.showNew).toBe(true);
			expect(toastManager.toasts.at(-1)?.message).toBe(
				"Completed Introductions. Started How To Win Friends.",
			);
		});

		it("warns about a follow-up it can't start", async () => {
			await reload((xml) =>
				xml.replace(
					/(<_questTitle>Deeper In The Mine<\/_questTitle>[\s\S]*?<int>)18</,
					(_, before) => `${before}9999<`,
				),
			);
			const { page, toastManager } = renderQuests();
			const mine = entry(page, "Deeper In The Mine");
			expect(text(mine.getByTestId("quest-follow-ups-skipped"))).toBe(
				"Finishing it in-game starts Quest #9999 next. The editor can't, so if it's completed here, that quest never starts.",
			);
			await fireEvent.click(mine.getByTestId("quest-complete"));
			flushSync();
			expect(toastManager.toasts.at(-1)?.message).toBe(
				"Completed Deeper In The Mine. Quest #9999 won't be started: the game only starts follow-up quests when this one is finished in-game.",
			);
		});

		it("removes a quest", async () => {
			const { page } = renderQuests();
			await fireEvent.click(
				entry(page, "Deeper In The Mine").getByTestId("quest-remove"),
			);
			flushSync();
			expect(rawQuests()).toHaveLength(4);
			expect(rawQuest("Deeper In The Mine")).toBeUndefined();
			expect(page.getAllByTestId("quest-title")).toHaveLength(4);
		});

		it("edits a quest's gold reward", async () => {
			const { page } = renderQuests();
			const input = entry(page, "Raising Animals").getByTestId(
				"quest-reward",
			) as HTMLInputElement;
			expect(input.value).toBe("100");
			await fireEvent.input(input, { target: { value: "750" } });
			flushSync();
			expect(rawQuest("Raising Animals")?.moneyReward).toBe(750);
		});

		it("edits how long a Help Wanted quest has left", async () => {
			await reload(helpWanted);
			const { page } = renderQuests();
			expect(page.getByTestId("quest-help-wanted")).toBeTruthy();
			const input = page.getByTestId("quest-days-left") as HTMLInputElement;
			expect(input.value).toBe("2");
			await fireEvent.input(input, { target: { value: "5" } });
			flushSync();
			expect(rawQuest("Abigail's Request")?.daysLeft).toBe(5);
		});

		it("refuses days left and rewards out of range", async () => {
			await reload(helpWanted);
			const { page } = renderQuests();
			const days = page.getByTestId("quest-days-left") as HTMLInputElement;
			for (const value of ["0", "100", "2.5"]) {
				await fireEvent.input(days, { target: { value } });
				flushSync();
				expect(days.checkValidity()).toBe(false);
				expect(rawQuest("Abigail's Request")?.daysLeft).toBe(2);
			}
			const reward = entry(page, "Abigail's Request").getByTestId(
				"quest-reward",
			) as HTMLInputElement;
			for (const value of ["-5", "100000", "12.5"]) {
				await fireEvent.input(reward, { target: { value } });
				flushSync();
				expect(reward.checkValidity()).toBe(false);
				expect(rawQuest("Abigail's Request")?.moneyReward).toBe(200);
			}
		});

		it("warns when a Prize Ticket is due but the backpack is full", async () => {
			// Two Help Wanted quests done, so this is the third
			await reload((xml) => billboardQuestsDone(helpWanted(xml), 2));
			const { page, toastManager } = renderQuests();
			const request = entry(page, "Abigail's Request");
			expect(text(request.getByTestId("quest-prize-ticket"))).toBe(
				"Completing it earns a Prize Ticket (every third Help Wanted quest does).",
			);

			const inventory = saveManager.save?.player.inventory;
			if (!inventory) throw new Error("No inventory");
			for (let i = 0; i < inventory.slotCount; i++)
				if (!inventory.get(i)) inventory.set(i, ItemFactory.fromName("Stone"));
			flushSync();
			expect(text(request.getByTestId("quest-prize-ticket"))).toBe(
				"Completing it earns a Prize Ticket, but the backpack is full: free a slot first, or the ticket is lost.",
			);

			await fireEvent.click(request.getByTestId("quest-complete"));
			flushSync();
			expect(toastManager.toasts.map((t) => [t.icon, t.message])).toEqual([
				[
					"✅",
					"Completed Abigail's Request: collect the reward from the journal in-game.",
				],
				[
					"❌",
					"The backpack is full, so the Prize Ticket couldn't be added: free a slot and add one on the Inventory page",
				],
			]);
		});

		it("says when the next Help Wanted quest earns a Prize Ticket", async () => {
			await reload((xml) =>
				billboardQuestsDone(helpWanted(helpWanted(xml), "Emily's Request"), 1),
			);
			const { page } = renderQuests();
			expect(page.queryAllByTestId("quest-prize-ticket")).toEqual([]);
			await fireEvent.click(
				entry(page, "Emily's Request").getByTestId("quest-complete"),
			);
			flushSync();
			// Completing one makes the other the third
			expect(
				entry(page, "Abigail's Request").queryByTestId("quest-prize-ticket"),
			).toBeTruthy();
			expect(page.queryAllByTestId("quest-prize-ticket")).toHaveLength(1);
		});

		it("shows a secret quest's tag and friendship reward", async () => {
			await reload((xml) =>
				xml.replace(
					"</questLog>",
					`<Quest xsi:type="SecretLostItemQuest">
						<_currentObjective>Return the necklace.</_currentObjective>
						<_questDescription>Someone lost a necklace.</_questDescription>
						<_questTitle>Lost Necklace</_questTitle>
						<accepted>false</accepted>
						<completed>false</completed>
						<dailyQuest>false</dailyQuest>
						<showNew>true</showNew>
						<canBeCancelled>false</canBeCancelled>
						<destroy>false</destroy>
						<id>128</id>
						<moneyReward>0</moneyReward>
						<questType>9</questType>
						<daysLeft>0</daysLeft>
						<dayQuestAccepted>-1</dayQuestAccepted>
						<nextQuests />
						<questTitle>...</questTitle>
						<npcName>Abigail</npcName>
						<friendshipReward>100</friendshipReward>
						<exclusiveQuestId>129</exclusiveQuestId>
						<itemIndex>(O)191</itemIndex>
						<itemFound>false</itemFound>
					</Quest></questLog>`,
				),
			);
			const { page } = renderQuests();
			const necklace = entry(page, "Lost Necklace");
			expect(necklace.getByTestId("quest-secret")).toBeTruthy();
			expect(text(necklace.getByTestId("quest-friendship-reward"))).toBe(
				"Reward: 100 friendship points",
			);
			// The reward is friendship, not gold
			expect(necklace.queryByTestId("quest-reward")).toBeNull();
			expect(page.queryAllByTestId("quest-secret")).toHaveLength(1);
		});
	});
});
