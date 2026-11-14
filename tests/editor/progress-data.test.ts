import { expect, it } from "vitest";
import catalog from "../../generated/progress.json";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { recipeDefinitions } from "../../src/lib/editor/recipe-data.ts";
import { readProgress } from "../../src/lib/editor/progress-data.ts";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";

/** Every category is explicitly empty rather than absent. This distinguishes a
 * known zero from the uncertainty required for incomplete imported records. */
function emptyProgress() {
	const document = tinyEditorFixture();
	document.SaveGame.farmhands = [];
	Object.assign(document.SaveGame, {
		goldenWalnutsFound: 0,
		goldenWalnuts: 999,
		perfectionWaivers: 0,
	});
	Object.assign(document.SaveGame.player, {
		basicShipped: [],
		fishCaught: [],
		friendshipData: [],
		cookingRecipes: [],
		recipesCooked: [],
		craftingRecipes: [],
		farmingLevel: 0,
		fishingLevel: 0,
		foragingLevel: 0,
		miningLevel: 0,
		combatLevel: 0,
		luckLevel: 0,
		stats: { Values: [], specificMonstersKilled: [] },
		mailReceived: [],
		mailForTomorrow: [],
		mailbox: [],
		chestConsumedLevels: [],
		achievements: [],
		totalMoneyEarned: 0,
		houseUpgradeLevel: 0,
	});
	return document;
}
const category = (document: SaveDocument, id: string) =>
	readProgress(document).farmers[0]!.categories.find((row) => row.id === id)!;

it("calculates known zero and applies found walnuts and waivers without spending balances", () => {
	const document = emptyProgress();
	expect(readProgress(document)).toMatchObject({ lower: 0, upper: 0 });
	document.SaveGame.goldenWalnutsFound = 65;
	document.SaveGame.perfectionWaivers = 3;
	expect(readProgress(document)).toMatchObject({ lower: 5.5, upper: 5.5 });
	document.SaveGame.perfectionWaivers = 100;
	expect(readProgress(document)).toMatchObject({ lower: 100, upper: 100 });
});

it("counts collection keys at zero, ignores excluded IDs and rejects duplicate evidence", () => {
	const document = emptyProgress();
	const host = document.SaveGame.player;
	host.basicShipped = [
		{ key: catalog.shipping[0]!.id, value: 0 },
		{ key: "ModItem", value: 42 },
	];
	host.fishCaught = [
		{ key: `(O)${catalog.fish[0]!.id}`, value: [0, 10] },
		{ key: "(O)Trash", value: [99, 0] },
	];
	expect(category(document, "shipping").completed).toBe(1);
	expect(category(document, "fishing").completed).toBe(1);
	host.basicShipped.push({ ...host.basicShipped[0]! });
	expect(category(document, "shipping")).toMatchObject({
		completed: 0,
		unknown: 1,
	});
	delete host.fishCaught;
	expect(category(document, "fishing").unknown).toBe(catalog.fish.length);
});

it("uses fixed friendship thresholds for Perfection but includes children in achievements", () => {
	const document = emptyProgress();
	document.SaveGame.player.friendshipData = [
		{ key: "Abigail", value: { Points: 2000, Status: "Married" } },
		{ key: "Lewis", value: { Points: 2499 } },
		{ key: "Baby", value: { Points: 2500 } },
	];
	expect(category(document, "friends").completed).toBe(1);
	const awards = readProgress(document).farmers[0]!.achievements;
	expect(awards.find((row) => row.id === 7)).toMatchObject({
		value: 1,
		status: "Requirements satisfied",
		recorded: false,
	});
});

it("matches the game's integer farmer level and binary monster and Stardrop contributions", () => {
	const document = emptyProgress();
	const host = document.SaveGame.player;
	Object.assign(host, { farmingLevel: 10, fishingLevel: 9 });
	expect(category(document, "skills").lower).toBe(9 / 25);
	host.stats!.specificMonstersKilled = catalog.monsters.flatMap((goal) =>
		goal.targets.map((target, index) => ({
			key: target,
			value: index === 0 ? goal.count : 0,
		})),
	);
	expect(category(document, "monsters").lower).toBe(1);
	host.stats!.specificMonstersKilled[0]!.value--;
	expect(category(document, "monsters").lower).toBe(0);
	host.mailReceived = [
		"CF_Fair",
		"CF_Fish",
		"CF_Sewer",
		"museumComplete",
		"CF_Spouse",
	];
	host.mailForTomorrow = ["CF_Statue%&NL&%"];
	host.chestConsumedLevels = [{ key: 100, value: true }];
	expect(category(document, "stardrops")).toMatchObject({
		completed: 7,
		lower: 1,
	});
	host.mailForTomorrow = [];
	expect(category(document, "stardrops")).toMatchObject({
		completed: 6,
		lower: 0,
	});
	host.mailReceived.push("gotMaxStamina");
	expect(category(document, "stardrops").lower).toBe(1);
});

it("counts distinct constructed building types worldwide, excluding unfinished construction", () => {
	const document = emptyProgress();
	const farm = document.SaveGame.locations![0]!;
	if (farm.$type === "$unknown") throw new Error("Expected a known farm");
	farm.buildings = [
		{
			$type: "StardewValley.Buildings.Building",
			buildingType: "Earth Obelisk",
			daysOfConstructionLeft: 0,
		},
		{
			$type: "StardewValley.Buildings.Building",
			buildingType: "Earth Obelisk",
			daysOfConstructionLeft: 0,
		},
		{
			$type: "StardewValley.Buildings.Building",
			buildingType: "Gold Clock",
			daysOfConstructionLeft: 1,
		},
	];
	expect(
		readProgress(document).shared.find((row) => row.id === "obelisks")
			?.completed,
	).toBe(1);
	expect(
		readProgress(document).shared.find((row) => row.id === "clock")?.completed,
	).toBe(0);
	farm.buildings[2] = {
		$type: "StardewValley.Buildings.Building",
		buildingType: "Gold Clock",
		daysOfConstructionLeft: 0,
	};
	expect(readProgress(document).lower).toBe(11);
});

it("chooses whole player category leaders and excludes uncustomized cabins", () => {
	const document = emptyProgress();
	const host = document.SaveGame.player;
	const guest = structuredClone(host);
	guest.UniqueMultiplayerID = 2n;
	guest.name = "Guest";
	guest.isCustomized = true;
	const names = recipeDefinitions("crafting").filter(
		(row) => row.name !== "Wedding Ring",
	);
	host.craftingRecipes = names
		.slice(0, 20)
		.map((row) => ({ key: row.name, value: 1 }));
	guest.craftingRecipes = names
		.slice(20, 50)
		.map((row) => ({ key: row.name, value: 1 }));
	document.SaveGame.farmhands = [guest];
	const leader = readProgress(document).leaders.find(
		(row) => row.category.id === "crafting",
	)!;
	expect(leader.farmer).toBe("Guest");
	expect(leader.category.completed).toBe(30);
	guest.isCustomized = false;
	expect(
		readProgress(document).leaders.find((row) => row.category.id === "crafting")
			?.category.completed,
	).toBe(20);
	delete guest.isCustomized;
	expect(readProgress(document).upper).toBeGreaterThan(
		readProgress(document).lower,
	);
});

it("keeps earned awards separate from current requirements and preserves the source", () => {
	const document = emptyProgress();
	document.SaveGame.player.achievements = [0, 999];
	const before = structuredClone(document);
	const award = readProgress(document).farmers[0]!.achievements.find(
		(row) => row.id === 0,
	);
	expect(award).toMatchObject({
		recorded: true,
		status: "In progress",
		value: 0,
	});
	expect(document).toEqual(before);
});

it("reaches exactly 100% when every vanilla requirement is satisfied", () => {
	const document = emptyProgress();
	const host = document.SaveGame.player;
	Object.assign(host, {
		basicShipped: catalog.shipping.map((row) => ({ key: row.id, value: 1 })),
		fishCaught: catalog.fish.map((row) => ({
			key: `(O)${row.id}`,
			value: [1, 1],
		})),
		friendshipData: catalog.friends.map((row) => ({
			key: row.name,
			value: { Points: row.points },
		})),
		cookingRecipes: recipeDefinitions("cooking").map((row) => ({
			key: row.name,
			value: 0,
		})),
		recipesCooked: recipeDefinitions("cooking").map((row) => ({
			key: row.outputId!,
			value: 0,
		})),
		craftingRecipes: recipeDefinitions("crafting").map((row) => ({
			key: row.name,
			value: 1,
		})),
		farmingLevel: 10,
		fishingLevel: 10,
		miningLevel: 10,
		foragingLevel: 10,
		combatLevel: 10,
		mailReceived: ["gotMaxStamina"],
	});
	host.stats!.specificMonstersKilled = catalog.monsters.flatMap((goal) =>
		goal.targets.map((target, index) => ({
			key: target,
			value: index === 0 ? goal.count : 0,
		})),
	);
	document.SaveGame.goldenWalnutsFound = 130;
	const farm = document.SaveGame.locations![0]!;
	if (farm.$type === "$unknown") throw new Error("Expected a known farm");
	farm.buildings = [
		"Earth Obelisk",
		"Water Obelisk",
		"Desert Obelisk",
		"Island Obelisk",
		"Gold Clock",
	].map((buildingType) => ({
		$type: "StardewValley.Buildings.Building",
		buildingType,
		daysOfConstructionLeft: 0,
	}));
	expect(readProgress(document)).toMatchObject({ lower: 100, upper: 100 });
});

it("marks unreadable learned recipe requirements and malformed mail as uncertain", () => {
	const document = emptyProgress();
	const host = document.SaveGame.player;
	const learned = recipeDefinitions("cooking").slice(0, 10);
	host.cookingRecipes = learned.map((row) => ({ key: row.name, value: 0 }));
	host.recipesCooked = learned
		.slice(0, 9)
		.map((row) => ({ key: row.outputId!, value: 0 }));
	// Ambiguous evidence for the tenth recipe could put Cook on either side of
	// its threshold, so the UI must not describe it as definitely incomplete.
	host.recipesCooked.push(
		{ key: learned[9]!.outputId!, value: 0 },
		{ key: learned[9]!.outputId!, value: 0 },
	);
	expect(
		readProgress(document).farmers[0]!.achievements.find((row) => row.id === 15)
			?.status,
	).toBe("Unable to determine");
	Object.assign(host, { mailReceived: { unsupported: true } });
	expect(category(document, "stardrops").unknown).toBe(7);
	// Historical cooking credit remains saved, but forgotten knowledge no longer
	// satisfies either the Perfection or achievement requirement.
	host.cookingRecipes = [];
	expect(category(document, "cooking").completed).toBe(0);
});
