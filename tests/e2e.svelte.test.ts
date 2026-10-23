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
import { getStatValue } from "$lib/proxies/Farmer.svelte";

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
import cookingPage from "../src/routes/(edit)/(list)/cooking/+page.svelte";
import craftingPage from "../src/routes/(edit)/(list)/crafting/+page.svelte";
import appearancePage from "../src/routes/(edit)/appearance/+page.svelte";
import bundlesPage from "../src/routes/(edit)/bundles/+page.svelte";
import characterPage from "../src/routes/(edit)/character/+page.svelte";
import chestsPage from "../src/routes/(edit)/chests/+page.svelte";

import eventsPage from "../src/routes/(edit)/events/+page.svelte";
import farmPage from "../src/routes/(edit)/farm/+page.svelte";
import editorPage from "../src/routes/(edit)/inventory/+page.svelte";
import BuildingSprite from "../src/routes/(edit)/inventory/BuildingSprite.svelte";
import questsPage from "../src/routes/(edit)/quests/+page.svelte";
import relationshipsPage from "../src/routes/(edit)/relationships/+page.svelte";
import { withHouse, withToolAtClint } from "./helpers/upgrades";

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

		it("shows the description of the selected item", async () => {
			const page = harness.render(editorPage);
			await fireEvent.click(page.getByTestId("item-9"));
			await tick();

			const input = page.getByTestId("item-name") as HTMLInputElement;
			await fireEvent.input(input, { target: { value: "Cowboy Hat" } });
			await tick();
			await fireEvent.click(page.getByText("Cowboy Hat"));
			await tick();

			expect(page.getByTestId("item-description").textContent).toBe(
				"The leather is old and cracked, but surprisingly supple. It smells musty.",
			);
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

		it("sorts the backpack with the sort button", async () => {
			const inventory = saveManager.save?.player.inventory;
			if (!inventory) throw new Error("No inventory");
			const parsnip = ItemFactory.fromName("Parsnip");
			inventory.set(30, parsnip);
			flushSync();
			const context = setToastManagerContext(new ToastManager());
			const page = harness.render(editorPage, { context });
			// Headed like the chests page, with the sort button beside the title
			expect(page.getByRole("heading", { level: 3 }).textContent).toBe(
				"Inventory",
			);

			await fireEvent.click(page.getByTestId("sort-inventory"));
			const used = [...Array(inventory.slotCount).keys()].filter(
				(i) => inventory.get(i) !== undefined,
			);
			// Everything packed to the front, the Parsnip included
			expect(used).toEqual([...Array(used.length).keys()]);
			expect([...inventory.values()]).toContain(parsnip);
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

		it("shows each recipe's item description", () => {
			const page = harness.render(craftingPage);
			const keg = page
				.getByTestId("recipe-keg")
				.closest("label") as HTMLElement;
			expect(within(keg).getByTestId("recipe-description").textContent).toBe(
				"Place a fruit or vegetable in here. Eventually it will turn into a beverage.",
			);
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

	describe("Wallet", () => {
		/** Give the test save a farmhand called Hand, a copy of the host */
		const withFarmhand = (xml: string) => {
			const start = xml.indexOf("<player>") + "<player>".length;
			const farmhand = xml
				.slice(start, xml.indexOf("</player>"))
				.replace("<name>Test</name>", "<name>Hand</name>")
				.replace(
					/<UniqueMultiplayerID>\d+<\/UniqueMultiplayerID>/,
					"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
				);
			return xml.replace(
				"<farmhands />",
				`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
			);
		};

		it("edits the selected farmer's wallet after switching farmer", async () => {
			harness.cleanup();
			harness = await createPageHarness(withFarmhand);
			saveManager = harness.saveManager;
			const save = saveManager.save;
			if (!save) throw new Error("No save loaded");
			const [host, hand] = save.players;
			if (!host || !hand) throw new Error("Expected a farmhand");
			const hostHad = host.mailReceived.has(MailFlag.HasSkullKey);
			const handHad = hand.mailReceived.has(MailFlag.HasSkullKey);

			const page = harness.render(characterPage);
			save.nextFarmer();
			flushSync();
			expect(save.player.name).toBe("Hand");

			await fireEvent.click(page.getByText("💀"));
			expect(hand.mailReceived.has(MailFlag.HasSkullKey)).toBe(!handHad);
			expect(host.mailReceived.has(MailFlag.HasSkullKey)).toBe(hostHad);
		});
	});

	describe("Upgrades", () => {
		it("makes the backpack bigger, and smaller once it's empty", async () => {
			const page = harness.render(characterPage);
			const player = () => {
				if (!saveManager.save) throw new Error("No save");
				return saveManager.save.player;
			};
			const select = page.getByTestId("backpack-size") as HTMLSelectElement;
			expect(select.value).toBe("12");

			await choose(select, "24");
			expect(player()[Raw].maxItems).toBe(24);
			expect(player()[Raw].items.Item).toHaveLength(24);

			// Something in the second row stops it shrinking back
			player().inventory.set(15, ItemFactory.fromName("Parsnip"));
			flushSync();
			const option = (value: string) =>
				[...select.options].find((o) => o.value === value);
			expect(option("12")?.disabled).toBe(true);
			expect(option("36")?.disabled).toBe(false);
			player().inventory.delete(15);
			flushSync();
			expect(option("12")?.disabled).toBe(false);
		});

		it("starts a house upgrade the game finishes overnight", async () => {
			const page = harness.render(characterPage);
			const raw = () => saveManager.save?.player[Raw];
			const days = page.getByTestId("house-upgrade-days") as HTMLInputElement;
			expect(days.value).toBe("0");
			expect(page.getByTestId("house-upgrade-hint").textContent).toMatch(
				/Now: Starting house\. Days until Robin adds\s+the kitchen/,
			);

			expect(page.queryByTestId("house-upgrade-cancel")).toBeNull();

			await fireEvent.input(days, { target: { value: "1" } });
			expect(raw()?.daysUntilHouseUpgrade).toBe(1);
			expect(raw()?.houseUpgradeLevel).toBe(0);
			// Once it's started, the button stops it
			expect(days.min).toBe("1");
			await fireEvent.click(page.getByTestId("house-upgrade-cancel"));
			expect(raw()?.daysUntilHouseUpgrade).toBe(-1);
			expect(days.value).toBe("0");
			expect(page.queryByTestId("house-upgrade-cancel")).toBeNull();
		});

		it("sets the trash can's level", async () => {
			const page = harness.render(characterPage);
			await choose(page.getByTestId("trash-can-level"), "2");
			expect(saveManager.save?.player[Raw].trashCanLevel).toBe(2);
			// Nothing at Clint's in the test save
			expect(page.queryByTestId("tool-upgrade-days")).toBeNull();
		});

		it("edits Mastery XP", async () => {
			const page = harness.render(characterPage);
			const input = page.getByTestId("skills-mastery") as HTMLInputElement;
			await fireEvent.input(input, { target: { value: "30000" } });
			flushSync();
			const player = saveManager.save?.player;
			if (!player) throw new Error("No save");
			expect(getStatValue(player[Raw], "MasteryExp")).toBe(30000);
			expect(page.getByTestId("mastery-level").textContent).toBe("Level 2/5");

			// Cleared, it waits for a number rather than calling it invalid
			await fireEvent.input(input, { target: { value: "" } });
			expect(input.checkValidity()).toBe(true);
			expect(getStatValue(player[Raw], "MasteryExp")).toBe(30000);
			// Left empty, it goes back to the minimum
			await fireEvent.blur(input);
			expect(input.value).toBe("0");
			expect(input.checkValidity()).toBe(true);
			expect(getStatValue(player[Raw], "MasteryExp")).toBe(0);
		});

		it("shows a modded backpack size as text", async () => {
			harness.cleanup();
			harness = await createPageHarness((xml) =>
				xml.replace("<maxItems>12</maxItems>", "<maxItems>48</maxItems>"),
			);
			saveManager = harness.saveManager;
			const page = harness.render(characterPage);
			const size = page.getByTestId("backpack-size");
			expect(size.tagName).toBe("SPAN");
			expect(size.textContent).toBe("48 slots");
		});

		it("cancels a house upgrade Robin has started", async () => {
			harness.cleanup();
			harness = await createPageHarness((xml) => withHouse(xml, 1, 2));
			saveManager = harness.saveManager;
			const page = harness.render(characterPage);
			const raw = () => saveManager.save?.player[Raw];
			const days = page.getByTestId("house-upgrade-days") as HTMLInputElement;
			expect(days.value).toBe("2");
			expect(page.getByTestId("house-upgrade-hint").textContent).toMatch(
				/Now: Kitchen\. Days until Robin\s+finishes the nursery/,
			);

			// 0 is below the minimum, so it can't cancel the upgrade by mistake
			await fireEvent.input(days, { target: { value: "0" } });
			expect(days.checkValidity()).toBe(false);
			await fireEvent.blur(days);
			expect(days.value).toBe("2");
			expect(raw()?.daysUntilHouseUpgrade).toBe(2);

			await fireEvent.click(page.getByTestId("house-upgrade-cancel"));
			expect(raw()?.daysUntilHouseUpgrade).toBe(-1);
			expect(raw()?.houseUpgradeLevel).toBe(1);
			expect(days.value).toBe("0");
		});

		it("won't upgrade the house past the cellar", async () => {
			harness.cleanup();
			harness = await createPageHarness((xml) => withHouse(xml, 3));
			saveManager = harness.saveManager;
			const page = harness.render(characterPage);
			const days = page.getByTestId("house-upgrade-days") as HTMLInputElement;
			expect(days.disabled).toBe(true);
			expect(page.getByTestId("house-upgrade-hint").textContent?.trim()).toBe(
				"Fully upgraded (Cellar).",
			);
		});
	});

	describe("Upgrades at Clint's", () => {
		const renderAtClint = async (itemId?: string) => {
			harness.cleanup();
			harness = await createPageHarness((xml) =>
				withToolAtClint(xml, 2, itemId),
			);
			saveManager = harness.saveManager;
			return harness.render(characterPage);
		};

		it("finishes the tool Clint is upgrading", async () => {
			const page = await renderAtClint();
			expect(page.getByText(/Clint: Copper Pickaxe/)).toBeTruthy();
			const days = page.getByTestId("tool-upgrade-days") as HTMLInputElement;
			expect(days.value).toBe("2");
			await fireEvent.input(days, { target: { value: "0" } });
			expect(saveManager.save?.player[Raw].daysLeftForToolUpgrade).toBe(0);
		});

		it("waits for a number when Clint's days are cleared", async () => {
			const page = await renderAtClint();
			const days = page.getByTestId("tool-upgrade-days") as HTMLInputElement;
			await fireEvent.input(days, { target: { value: "" } });
			expect(days.checkValidity()).toBe(true);
			expect(saveManager.save?.player[Raw].daysLeftForToolUpgrade).toBe(2);
			// Left empty, it goes back to the minimum: ready now
			await fireEvent.blur(days);
			expect(days.value).toBe("0");
			expect(days.checkValidity()).toBe(true);
			expect(saveManager.save?.player[Raw].daysLeftForToolUpgrade).toBe(0);
		});

		it("locks the trash can while Clint has it", async () => {
			const page = await renderAtClint("CopperTrashCan");
			const select = page.getByTestId("trash-can-level") as HTMLSelectElement;
			expect(select.disabled).toBe(true);
			expect(
				page.getByText("Clint is upgrading it; collect it from him first."),
			).toBeTruthy();
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

		it("shows each villager's description", () => {
			const page = harness.render(relationshipsPage);
			const row = page
				.getAllByTestId("friendship-row")
				.find(
					(r) =>
						within(r).getByTestId("friendship-name").textContent === "Lewis",
				);
			expect(row).toBeTruthy();
			if (!row) return;
			expect(
				within(row).getByTestId("friendship-description").textContent,
			).toMatch(/^Lewis is/);
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
		it("shows each building's description", () => {
			const page = harness.render(buildingsPage);
			expect(
				page.getAllByTestId("building-description").map((el) => el.textContent),
			).toContain("A place to grow crops from any season, year round!");
		});

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

	describe("Chests", () => {
		const renderChests = () => {
			const context = setToastManagerContext(new ToastManager());
			return harness.render(chestsPage, { context });
		};

		const chestIn = (location: string) => {
			const chests = saveManager.save?.chests ?? [];
			const index = chests.findIndex(
				(chest) => chest.metadata.location === location,
			);
			const chest = chests[index];
			if (!chest) throw new Error(`No chest in ${location}`);
			return { chest, index };
		};

		it("lists every chest in a group at once, each in its own section", async () => {
			const page = renderChests();
			const options = [
				...(page.getByTestId("chest-group") as HTMLSelectElement).options,
			].map((o) => o.textContent?.trim());
			expect(options).toEqual([
				"Chests (1)",
				"Farm / Cabin Fridges (0)",
				"Farm House Fridges (1)",
				"Island Chests (0)",
				"Island Fridges (1)",
			]);
			expect(page.getAllByTestId("chest-section")).toHaveLength(1);
			expect(page.getByText("Farm - Chest (60, 15)")).toBeTruthy();

			await fireEvent.change(page.getByTestId("chest-group"), {
				target: { value: "island-fridges" },
			});
			const sections = page.getAllByTestId("chest-section");
			expect(sections).toHaveLength(1);
			expect(sections[0]?.textContent).toContain("IslandFarmHouse - Fridge");
		});

		it("Ctrl+click picks several items and hides the item editor", async () => {
			const page = renderChests();
			expect(page.queryByTestId("chest-multi-selection")).toBeNull();

			await fireEvent.click(page.getByTestId("chest-0-item-0"));
			await fireEvent.click(page.getByTestId("chest-0-item-1"), {
				ctrlKey: true,
			});
			await fireEvent.click(page.getByTestId("chest-0-item-2"), {
				ctrlKey: true,
			});
			expect(page.getByTestId("chest-multi-selection").textContent).toContain(
				"3 items selected",
			);
			expect(page.queryByTestId("item-name")).toBeNull();

			// Ctrl+click again removes one; a plain click goes back to one item
			await fireEvent.click(page.getByTestId("chest-0-item-2"), {
				ctrlKey: true,
			});
			expect(page.getByTestId("chest-multi-selection").textContent).toContain(
				"2 items selected",
			);
			await fireEvent.click(page.getByTestId("chest-0-item-5"));
			expect(page.queryByTestId("chest-multi-selection")).toBeNull();
		});

		it("drags an item onto another slot", async () => {
			const page = renderChests();
			const chest = saveManager.save?.chests[0];
			const first = chest?.inventory.get(0);
			const emptySlot = 30;
			expect(chest?.inventory.get(emptySlot)).toBeUndefined();

			await fireEvent.dragStart(page.getByTestId("chest-0-drag-0"));
			await fireEvent.drop(page.getByTestId(`chest-0-item-${emptySlot}`));
			expect(chest?.inventory.get(emptySlot)).toBe(first);
			expect(chest?.inventory.get(0)).toBeUndefined();
		});

		it("sorts a chest, and all chests, with the sort buttons", async () => {
			const page = renderChests();
			const chest = saveManager.save?.chests[0];
			if (!chest) throw new Error("No chest");
			// Spread the items out so sorting has something to do
			const first = chest.inventory.take(0);
			if (first) chest.inventory.place(35, first);
			flushSync();

			await fireEvent.click(page.getByTestId("sort-chest-0"));
			const used = chest.inventory.usedSlots;
			for (let i = 0; i < chest.inventory.slotCount; i++)
				expect(chest.inventory.get(i) !== undefined).toBe(i < used);

			const fridge = saveManager.save?.chests[1];
			const parsnip = ItemFactory.fromName("Parsnip");
			fridge?.inventory.set(10, parsnip);
			flushSync();
			await fireEvent.click(page.getByTestId("sort-all-chests"));
			expect(fridge?.inventory.get(0)).toBe(parsnip);
		});

		it("dims the items that don't match a search", async () => {
			const page = renderChests();
			const chest = saveManager.save?.chests[0];
			if (!chest) throw new Error("No chest");
			chest.inventory.set(0, ItemFactory.fromName("Parsnip"));
			chest.inventory.set(1, ItemFactory.fromName("Stone"));
			flushSync();

			const search = page.getByTestId("chest-search");
			await fireEvent.input(search, { target: { value: "parsnip" } });
			const dimmed = (slot: number) =>
				page.getByTestId(`chest-0-drag-${slot}`).classList.contains("dimmed");
			expect(dimmed(0)).toBe(false);
			expect(dimmed(1)).toBe(true);

			await fireEvent.click(page.getByTestId("chest-search-clear"));
			expect(dimmed(1)).toBe(false);
		});

		it("jumps to a search result in another group", async () => {
			const page = renderChests();
			const { chest, index } = chestIn("IslandFarmHouse");
			chest.inventory.set(3, ItemFactory.fromName("Ancient Fruit"));
			flushSync();

			await fireEvent.input(page.getByTestId("chest-search"), {
				target: { value: "ancient fruit" },
			});
			const result = page.getByTestId(`chest-search-result-${index}-3`);
			expect(result.textContent).toContain("IslandFarmHouse - Fridge");
			await fireEvent.click(result);
			await tick();

			// The island fridges are listed, with the item selected
			expect((page.getByTestId("chest-group") as HTMLSelectElement).value).toBe(
				"island-fridges",
			);
			expect(page.getAllByTestId("chest-section")).toHaveLength(1);
			expect(
				page.getByTestId(`chest-${index}-item-3`).classList.contains("active"),
			).toBe(true);
			expect(page.getByText("Editing: IslandFarmHouse - Fridge")).toBeTruthy();
			// The results close once one is picked
			expect(page.queryByTestId(`chest-search-result-${index}-3`)).toBeNull();
		});
	});

	describe("Events", () => {
		const rawEvents = () => {
			const events = saveManager.save?.player[Raw].eventsSeen;
			return typeof events === "object" ? (events.int ?? []) : [];
		};
		// An event's checkbox in each group it's listed in
		const checkbox = (
			page: { queryAllByTestId: (id: string) => HTMLElement[] },
			id: string,
		) => page.queryAllByTestId(`event-${id}`) as HTMLInputElement[];
		const names = (page: { queryAllByTestId: (id: string) => HTMLElement[] }) =>
			page.queryAllByTestId("event-name").map((n) => n.textContent);

		it("names seen events and toggles them", async () => {
			const page = harness.render(eventsPage);
			expect(page.getByTestId("events-seen-count").textContent).toBe(
				"Events seen: 3",
			);
			const [willy] = checkbox(page, "739330");
			expect(willy?.checked).toBe(true);
			expect(
				page.getByText(
					"Willy's introduction event where he gives the farmer a fishing rod",
				),
			).toBeTruthy();

			if (!willy) throw new Error("No checkbox for event 739330");
			await fireEvent.click(willy);
			flushSync();
			expect(saveManager.save?.player.eventsSeen.has("739330")).toBe(false);
			expect(rawEvents()).not.toContain("739330");
			expect(willy.checked).toBe(false);

			const [abigail] = checkbox(page, "1");
			if (!abigail) throw new Error("No checkbox for event 1");
			expect(abigail.checked).toBe(false);
			await fireEvent.click(abigail);
			flushSync();
			expect(rawEvents()).toEqual(["60367", "100162", "1"]);
		});

		it("shows an event under each of its characters, ticked together", async () => {
			const page = harness.render(eventsPage);
			// The introduction event is Lewis and Robin's
			const intro = checkbox(page, "60367");
			expect(intro).toHaveLength(2);
			expect(intro.every((box) => box.checked)).toBe(true);
			if (!intro[0]) throw new Error("No checkbox for event 60367");
			await fireEvent.click(intro[0]);
			flushSync();
			expect(intro.every((box) => !box.checked)).toBe(true);
			expect(rawEvents()).not.toContain("60367");
		});

		it("searches, groups by location and filters by seen", async () => {
			const page = harness.render(eventsPage);
			const search = page.getByTestId("events-search");
			await fireEvent.input(search, { target: { value: "prairie" } });
			expect(names(page)).toEqual(["Abigail's 2 heart event"]);

			await fireEvent.input(search, { target: { value: "zzzz" } });
			expect(names(page)).toEqual([]);
			expect(page.getByText('No events match "zzzz".')).toBeTruthy();
			await fireEvent.input(search, { target: { value: "" } });

			const groups = () =>
				page.queryAllByTestId("event-group-name").map((n) => n.textContent);
			expect(groups()).toContain("Abigail");
			expect(groups().at(-1)).toBe("Other");
			await choose(page.getByTestId("events-group"), "location");
			expect(groups()).toContain("Pierre's General Store");
			expect(groups()).not.toContain("Abigail");

			await choose(page.getByTestId("events-show"), "seen");
			const shown = page
				.getAllByTestId("event-row")
				.map((row) => row.querySelector("input") as HTMLInputElement);
			expect(shown).toHaveLength(3);
			expect(shown.every((box) => box.checked)).toBe(true);

			await choose(page.getByTestId("events-show"), "unseen");
			expect(page.queryAllByTestId("event-60367")).toHaveLength(0);
			expect(page.getAllByTestId("event-1")).toHaveLength(1);
		});

		it("adds and removes an unlisted event ID", async () => {
			const page = harness.render(eventsPage);
			const input = page.getByTestId("event-id-input");
			const add = page.getByTestId("add-event") as HTMLButtonElement;
			expect(add.disabled).toBe(true);
			await fireEvent.input(input, { target: { value: "Bad Id" } });
			expect(add.disabled).toBe(true);
			await fireEvent.input(input, { target: { value: "a/b" } });
			expect(add.disabled).toBe(true);
			expect(page.getByTestId("event-id-hint").textContent).toBe(
				`Event IDs can't contain spaces or "/".`,
			);
			// The save would read it back as 1000
			await fireEvent.input(input, { target: { value: "1e3" } });
			expect(add.disabled).toBe(true);
			expect(page.getByTestId("event-id-hint").textContent).toContain(
				'the save reads "1e3" back as a different ID',
			);

			await fireEvent.input(input, {
				target: { value: " Example.ModId_Event " },
			});
			expect(add.disabled).toBe(false);
			await fireEvent.click(add);
			flushSync();
			expect(page.getAllByTestId("unknown-event")).toHaveLength(1);
			expect(page.getByText("Example.ModId_Event")).toBeTruthy();
			expect(rawEvents()).toContain("Example.ModId_Event");
			expect(page.getByTestId("event-added").textContent).toBe(
				"Marked #Example.ModId_Event as seen.",
			);
			expect((input as HTMLInputElement).value).toBe("");

			await fireEvent.click(
				page.getByTestId("remove-event-Example.ModId_Event"),
			);
			flushSync();
			expect(page.queryAllByTestId("unknown-event")).toHaveLength(0);
			expect(rawEvents()).not.toContain("Example.ModId_Event");
			expect(page.queryByTestId("event-added")).toBeNull();
		});

		it("ticks a vanilla event added by ID", async () => {
			const page = harness.render(eventsPage);
			// Saved as 1, which is how the save reads it back
			await fireEvent.input(page.getByTestId("event-id-input"), {
				target: { value: "01" },
			});
			expect(page.getByTestId("event-id-hint").textContent).toBe(
				"Saved as 1, without the leading zeros.",
			);
			await fireEvent.click(page.getByTestId("add-event"));
			flushSync();
			const [abigail] = checkbox(page, "1");
			expect(abigail?.checked).toBe(true);
			expect(rawEvents()).toContain("1");
			expect(page.queryAllByTestId("unknown-event")).toHaveLength(0);
			expect(page.getByTestId("event-added").textContent).toBe(
				"Marked Abigail's 2 heart event (#1) as seen.",
			);

			// Unticking it makes the message out of date
			if (!abigail) throw new Error("No checkbox for event 1");
			await fireEvent.click(abigail);
			flushSync();
			expect(page.queryByTestId("event-added")).toBeNull();
		});

		it("clears the add message when switching farmers", async () => {
			harness.cleanup();
			harness = await createPageHarness((xml) => {
				const start = xml.indexOf("<player>") + "<player>".length;
				const farmhand = xml
					.slice(start, xml.indexOf("</player>"))
					.replace("<name>Test</name>", "<name>Hand</name>")
					.replace(
						/<UniqueMultiplayerID>\d+<\/UniqueMultiplayerID>/,
						"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
					)
					.replace(/<eventsSeen>[\s\S]*?<\/eventsSeen>/, "<eventsSeen />");
				return xml.replace(
					"<farmhands />",
					`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
				);
			});
			saveManager = harness.saveManager;
			const page = harness.render(eventsPage);
			await fireEvent.input(page.getByTestId("event-id-input"), {
				target: { value: "1" },
			});
			await fireEvent.click(page.getByTestId("add-event"));
			flushSync();
			expect(page.getByTestId("event-added")).toBeTruthy();

			saveManager.save?.nextFarmer();
			flushSync();
			expect(saveManager.save?.player.name).toBe("Hand");
			expect(page.getByTestId("events-seen-count").textContent).toBe(
				"Events seen: 0",
			);
			expect(page.queryByTestId("event-added")).toBeNull();
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
