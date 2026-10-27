import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	animalOptions,
	defaultAnimalName,
	describeUnplaced,
	purchasedAnimalTopic,
	upgradeTiers,
} from "$lib/animalBuildings";
import { Dispose, Raw } from "$lib/proxies";
import type { Building } from "$lib/proxies/Building.svelte";
import { type FarmAnimal, newAnimalId } from "$lib/proxies/FarmAnimal.svelte";
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import { XMLManager } from "$lib/workers/xml";
import type { GameLocation as Location } from "../codegen/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import {
	BARN_ID,
	bambooMat,
	barnXml,
	COOP_ANIMALS,
	COOP_ID,
	candleLamp,
	coopXml,
	feedHopper,
	incubator,
	PLAYER_ID,
	SHED_ID,
	shedXml,
	withAnimalBuildings,
} from "./helpers/animalBuildings";

// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
type Parsed = any;

const tierNames = (type: string) => upgradeTiers(type).map((t) => t.name);

describe("animal IDs", () => {
	it("are made the way the game makes them", () => {
		// Multiplayer.getNewID: time, then 16 bits of the player's ID, then a count
		const now = Date.UTC(2024, 0, 1);
		expect(newAnimalId(PLAYER_ID, { now })).toBe("1140676020277069569");
		// The count carries on from the save's latest ID
		expect(
			newAnimalId(PLAYER_ID, { now, latestId: "1584145784548083458" }),
		).toBe("1140676020277069571");
	});

	it("matches the player part of the test save's latest ID", () => {
		const latest = BigInt("1584145784548083458");
		const id = BigInt(newAnimalId(PLAYER_ID));
		const node = (value: bigint) => (value >> BigInt(8)) & BigInt(0xffff);
		expect(node(id)).toBe(node(latest));
	});

	it("skips IDs that are taken", () => {
		const now = Date.UTC(2024, 0, 1);
		const taken = new Set(["1140676020277069569", "1140676020277069570"]);
		expect(newAnimalId(PLAYER_ID, { now, taken })).toBe("1140676020277069571");
	});

	it("are whole numbers that fit in a long", () => {
		for (const owner of [PLAYER_ID, "-4611686018427387904", 0, 12345]) {
			const id = newAnimalId(owner);
			expect(id).toMatch(/^-?\d+$/);
			const value = BigInt(id);
			expect(value).toBe(BigInt.asIntN(64, value));
		}
	});
});

describe("building tiers", () => {
	it("lists every size of a coop or barn, from any of them", () => {
		for (const type of ["Coop", "Big Coop", "Deluxe Coop"])
			expect(tierNames(type)).toEqual(["Coop", "Big Coop", "Deluxe Coop"]);
		for (const type of ["Barn", "Big Barn", "Deluxe Barn"])
			expect(tierNames(type)).toEqual(["Barn", "Big Barn", "Deluxe Barn"]);
		expect(tierNames("Shed")).toEqual(["Shed", "Big Shed"]);
		expect(tierNames("Silo")).toEqual(["Silo"]);
		expect(tierNames("Not a building")).toEqual([]);
	});

	it("offers no animals for a building it doesn't know", () => {
		expect(animalOptions(upgradeTiers("Fancy Coop"), "Fancy Coop")).toEqual([]);
		expect(animalOptions(upgradeTiers("Shed"), "Shed")).toEqual([]);
	});

	it("names the topic for buying an animal by its display type", () => {
		expect(purchasedAnimalTopic("White Chicken")).toBe(
			"purchasedAnimal_Chicken",
		);
		expect(purchasedAnimalTopic("Brown Chicken")).toBe(
			"purchasedAnimal_Chicken",
		);
		expect(purchasedAnimalTopic("Void Chicken")).toBe(
			"purchasedAnimal_Void Chicken",
		);
		expect(purchasedAnimalTopic("Pig")).toBe("purchasedAnimal_Pig");
	});

	it("offers coop animals by the coop's size", () => {
		const options = animalOptions(upgradeTiers("Coop"), "Coop");
		const allowed = options.filter((o) => o.allowed).map((o) => o.type);
		expect(allowed).toEqual([
			"White Chicken",
			"Brown Chicken",
			"Blue Chicken",
			"Void Chicken",
			"Golden Chicken",
			"Dinosaur",
		]);
		expect(options.find((o) => o.type === "Duck")).toEqual({
			type: "Duck",
			allowed: false,
			reason: "needs a Big Coop",
		});
		expect(options.find((o) => o.type === "Rabbit")?.reason).toBe(
			"needs a Deluxe Coop",
		);
		expect(options.some((o) => o.type === "White Cow")).toBe(false);

		const big = animalOptions(upgradeTiers("Big Coop"), "Big Coop");
		expect(big.find((o) => o.type === "Duck")?.allowed).toBe(true);
		expect(big.find((o) => o.type === "Rabbit")?.allowed).toBe(false);
	});

	it("lets a Deluxe Barn house every barn animal", () => {
		const options = animalOptions(upgradeTiers("Deluxe Barn"), "Deluxe Barn");
		expect(options.map((o) => o.type)).toEqual([
			"White Cow",
			"Brown Cow",
			"Goat",
			"Sheep",
			"Pig",
			"Ostrich",
		]);
		expect(options.every((o) => o.allowed)).toBe(true);
	});

	it("names new animals after their type", () => {
		expect(defaultAnimalName("Duck", new Set())).toBe("Duck");
		expect(defaultAnimalName("Duck", new Set(["Duck", "Duck 2"]))).toBe(
			"Duck 3",
		);
	});
});

describe("coops and barns", () => {
	mockIDB();
	let saveManager: SaveManager;
	let xml: string;
	const xmlManager = new XMLManager();

	/** Load the test save with these buildings on the farm */
	const load = async (buildings?: string[]) => {
		xml = withAnimalBuildings(
			await readFile("tests/TestSave", "utf-8"),
			buildings,
		);
		let promise: Promise<void | boolean> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([xml], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	};

	beforeEach(() => load());

	const save = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save;
	};
	const building = (id: string) => {
		const found = save().farm?.buildings.find((b) => b[Raw].id === id);
		if (!found) throw new Error(`No building ${id}`);
		return found;
	};
	const tier = (b: Building, name: string) => {
		const found = b.tiers.find((t) => t.name === name);
		if (!found) throw new Error(`No ${name}`);
		return found;
	};
	const interior = (b: Building) => b[Raw].indoors as Location;
	const furnitureOf = (b: Building) => {
		const furniture = interior(b).furniture;
		return typeof furniture === "object" ? furniture.Furniture : [];
	};
	const objectAt = (b: Building, x: number, y: number) =>
		interior(b).objects?.item.find(
			(o) => o.key.Vector2.X === x && o.key.Vector2.Y === y,
		)?.value.Object;
	const exported = async () =>
		xmlManager.parse<Parsed>(await (await saveManager.export()).text());
	/** A building as it's written to the downloaded save */
	const exportedBuilding = async (id: string) =>
		(
			await exported()
		).SaveGame.locations.GameLocation[0].buildings.Building.find(
			(b: { id: string }) => b.id === id,
		);
	/** A player's conversation topics, and how many days each has left */
	const topics = (player: Farmer) => {
		const events = player[Raw].activeDialogueEvents;
		return new Map(
			(events ? events.item : []).map((e) => [
				String(e.key.string),
				e.value.int,
			]),
		);
	};
	// For tests that write out and read back the whole save
	const slow = { timeout: 30_000 };

	it("loads who lives where", () => {
		const coop = building(COOP_ID);
		expect(coop.isAnimalHouse).toBe(true);
		expect(coop.capacity).toBe(4);
		expect(coop.residentIds).toEqual(Object.values(COOP_ANIMALS));
		expect(coop.indoorLocation?.animals).toHaveLength(3);
		// Wanderer is out on the farm, but still lives here
		expect(coop.animalsOutside).toBe(1);
		expect(coop.isFull).toBe(true);
		expect(coop.indoorLocation).toBe(coop.indoorLocation);

		const barn = building(BARN_ID);
		expect(barn.residentIds).toHaveLength(2);
		expect(barn.isFull).toBe(false);
		expect(
			save()
				.farmAnimals.map((a) => a.name)
				.sort(),
		).toEqual(["Bessie", "Clucky", "Daisy", "Nugget", "Sunny", "Wanderer"]);
	});

	it("changes nothing just by loading", slow, async () => {
		expect(await exported()).toEqual(xmlManager.parse(xml));

		// An uncounted daysOwned shows the age instead, and the age is kept
		const clucky = building(COOP_ID).indoorLocation?.animals.find(
			(a) => a.name === "Clucky",
		);
		expect(clucky?.daysOwned).toBe(12);
		expect(clucky?.[Raw].value.FarmAnimal.daysOwned).toBe(-1);
		expect(clucky?.[Raw].value.FarmAnimal.age).toBe(12);
	});

	it("adds an animal the way buying one does", slow, async () => {
		const barn = building(BARN_ID);
		const before = String(save()[Raw].SaveGame.latestID);
		const animal = barn.adoptAnimal("Ostrich", " Big Bird ", save().player);
		flushSync();

		const raw = animal[Raw];
		const fields = raw.value.FarmAnimal;
		// In the order the game saves them
		expect(Object.keys(fields)).toEqual([
			"name",
			"forceOneTileWide",
			"isEmoting",
			"isCharging",
			"isGlowing",
			"coloredBorder",
			"flip",
			"drawOnTop",
			"faceTowardFarmer",
			"ignoreMovementAnimation",
			"faceAwayFromFarmer",
			"scale",
			"glowingTransparency",
			"glowRate",
			"Gender",
			"willDestroyObjectsUnderfoot",
			"Position",
			"Speed",
			"FacingDirection",
			"IsEmoting",
			"CurrentEmote",
			"Scale",
			"isSwimming",
			"friendshipTowardFarmer",
			"age",
			"daysOwned",
			"health",
			"produceQuality",
			"daysSinceLastLay",
			"happiness",
			"fullness",
			"wasAutoPet",
			"wasPet",
			"allowReproduction",
			"type",
			"buildingTypeILiveIn",
			"myID",
			"ownerID",
			"parentId",
			"hasEatenAnimalCracker",
			"moodMessage",
			"isEating",
			"displayName",
		]);
		expect(fields).toMatchObject({
			name: "Big Bird",
			displayName: "Big Bird",
			type: "Ostrich",
			buildingTypeILiveIn: "Barn",
			age: 0,
			daysOwned: 0,
			health: 3,
			happiness: 255,
			fullness: 255,
			friendshipTowardFarmer: 0,
			allowReproduction: true,
			parentId: -1,
			ownerID: PLAYER_ID,
			Gender: "Undefined",
			FacingDirection: 2,
		});
		const id = String(fields.myID);
		expect(String(raw.key.long)).toBe(id);
		expect(id).toMatch(/^\d+$/);
		expect(id).not.toBe(before);
		expect(String(save()[Raw].SaveGame.latestID)).toBe(id);

		// Inside the barn, and living there
		const indoors = interior(barn);
		expect(indoors.animals?.item?.at(-1)).toBe(raw);
		expect(
			indoors.Animals.SerializableDictionaryOfInt64FarmAnimal?.item?.at(-1),
		).toBe(raw);
		expect(indoors.animalsThatLiveHere).toEqual({
			long: ["1584145784548083463", "1584145784548083464", id],
		});
		expect(barn[Raw].currentOccupants).toBe(3);
		expect(barn.residentIds).toHaveLength(3);

		// Villagers can talk about it with every player, for four days
		expect(save().players.length).toBeGreaterThan(0);
		for (const player of save().players)
			expect(topics(player).get("purchasedAnimal_Ostrich")).toBe(4);

		// And it's in the downloaded save
		const reloaded = await exported();
		const barnAgain =
			reloaded.SaveGame.locations.GameLocation[0].buildings.Building.find(
				(b: { id: string }) => b.id === BARN_ID,
			);
		expect(
			barnAgain.indoors.animals.item.map(
				(a: Parsed) => a.value.FarmAnimal.name,
			),
		).toEqual(["Daisy", "Bessie", "Big Bird"]);
		expect(barnAgain.indoors.animalsThatLiveHere.long.map(String)).toContain(
			id,
		);
	});

	it("only adds animals that can live there, while there's room", () => {
		const coop = building(COOP_ID);
		const barn = building(BARN_ID);
		const player = save().player;
		// Wanderer is outside, but the coop is still full
		expect(() => coop.adoptAnimal("White Chicken", "Pip", player)).toThrow(
			"The Coop is full (4/4 animals)",
		);
		expect(() => barn.adoptAnimal("Goat", "Billy", player)).toThrow(
			"A Goat needs a Big Barn",
		);
		expect(() => barn.adoptAnimal("Duck", "Quackers", player)).toThrow(
			"A Duck can't live in a Barn",
		);
		expect(() => barn.adoptAnimal("White Cow", "Clucky", player)).toThrow(
			"Another animal is already called Clucky",
		);
		expect(() => barn.adoptAnimal("White Cow", "  ", player)).toThrow(
			"needs a name",
		);
		barn[Raw].daysOfConstructionLeft = 2;
		expect(() => barn.adoptAnimal("White Cow", "Moo", player)).toThrow(
			"still being built",
		);
		expect(barn.residentIds).toHaveLength(2);
	});

	it("starts a conversation topic for each kind of animal once", () => {
		const coop = building(COOP_ID);
		const player = save().player;
		coop.changeType(tier(coop, "Big Coop"));
		coop.adoptAnimal("Brown Chicken", "Pip", player);
		// White and brown chickens are both just chickens (AnimalHouse.adoptAnimal)
		expect(topics(player).get("purchasedAnimal_Chicken")).toBe(4);
		expect(topics(player).has("purchasedAnimal_Brown Chicken")).toBe(false);

		// Not again while it's going on...
		const events = player[Raw].activeDialogueEvents as Parsed;
		const chicken = events.item.find(
			(e: Parsed) => e.key.string === "purchasedAnimal_Chicken",
		);
		chicken.value.int = 1;
		coop.adoptAnimal("White Chicken", "Peep", player);
		expect(topics(player).get("purchasedAnimal_Chicken")).toBe(1);
		// ...or after
		coop.adoptAnimal("Duck", "Daffy", player);
		expect(topics(player).get("purchasedAnimal_Duck")).toBe(4);
		events.item = events.item.filter((e: Parsed) => e !== chicken);
		(player[Raw].previousActiveDialogueEvents as Parsed).item.push({
			key: { string: "purchasedAnimal_Chicken" },
			value: { int: 3 },
		});
		coop.adoptAnimal("Blue Chicken", "Bluey", player);
		expect(topics(player).has("purchasedAnimal_Chicken")).toBe(false);
		expect(topics(player).get("purchasedAnimal_Blue Chicken")).toBe(4);
	});

	it("never adds two animals with the same ID", () => {
		const barn = building(BARN_ID);
		const ids = ["One", "Two"].map(
			(name) =>
				barn.adoptAnimal("White Cow", name, save().player)[Raw].value.FarmAnimal
					.myID,
		);
		expect(new Set(ids).size).toBe(2);
	});

	it("upgrades a Coop to a Big Coop like Robin does", slow, async () => {
		const coop = building(COOP_ID);
		const hopper = objectAt(coop, 3, 3);
		const junimo = objectAt(coop, 2, 3);
		const problems = coop.changeType(tier(coop, "Big Coop"));
		flushSync();

		expect(problems).toEqual([]);
		expect(coop.name).toBe("Big Coop");
		expect(coop.data?.maxOccupants).toBe(8);
		expect(coop[Raw]).toMatchObject({
			buildingType: "Big Coop",
			maxOccupants: 8,
			tilesWide: 6,
			tilesHigh: 3,
		});
		expect(interior(coop)).toMatchObject({ name: "Big Coop", animalLimit: 8 });
		expect(coop.capacity).toBe(8);
		expect(coop.isFull).toBe(false);
		expect(save()[Raw].SaveGame.constructedBuildings).toEqual({
			string: ["Big Coop"],
		});

		// What was in the way moved; the incubator went in
		expect(objectAt(coop, 3, 3)).toBe(hopper);
		expect(objectAt(coop, 14, 8)).toBe(junimo);
		expect(junimo?.tileLocation).toEqual({ X: 14, Y: 8 });
		expect(junimo?.boundingBox).toMatchObject({
			X: 14 * 64,
			Y: 8 * 64,
			Location: { X: 14 * 64, Y: 8 * 64 },
		});
		expect(objectAt(coop, 14, 7)?.name).toBe("Hay");
		expect(objectAt(coop, 14, 4)?.name).toBe("Hay");
		expect(objectAt(coop, 1, 3)).toBeUndefined();
		expect(objectAt(coop, 2, 3)).toMatchObject({
			name: "Incubator",
			itemId: "101",
			bigCraftable: true,
			fragility: 2,
			tileLocation: { X: 2, Y: 3 },
		});

		// Robin's letter about the incubator
		expect(save().player.mailbox.has("incubator" as never)).toBe(true);
		expect(save()[Raw].SaveGame.broadcastedMail.string).toContain(
			"%&SM&%incubator",
		);
		// And villagers can talk about it
		for (const player of save().players)
			expect(topics(player).get("structureBuilt_Big Coop")).toBe(4);

		expect(await exportedBuilding(COOP_ID)).toMatchObject({
			buildingType: "Big Coop",
			maxOccupants: 8,
		});
	});

	it("upgrades straight to a Deluxe Coop through each size", () => {
		const coop = building(COOP_ID);
		const junimo = objectAt(coop, 2, 3);
		expect(coop.changeType(tier(coop, "Deluxe Coop"))).toEqual([]);
		flushSync();

		expect(coop[Raw].buildingType).toBe("Deluxe Coop");
		expect(interior(coop).animalLimit).toBe(12);
		expect(objectAt(coop, 21, 8)).toBe(junimo);
		expect(objectAt(coop, 21, 7)?.name).toBe("Hay");
		expect(objectAt(coop, 20, 4)?.name).toBe("Hay");
		expect(objectAt(coop, 2, 3)?.name).toBe("Incubator");
		const items = interior(coop).objects?.item ?? [];
		expect(
			items.filter((o) => o.value.Object.name === "Incubator"),
		).toHaveLength(1);
		expect(save()[Raw].SaveGame.constructedBuildings).toEqual({
			string: ["Big Coop", "Deluxe Coop"],
		});
		// The letter is only sent once
		expect(
			save()[Raw].SaveGame.broadcastedMail.string.filter(
				(m) => m === "%&SM&%incubator",
			),
		).toHaveLength(1);
		// Both upgrades are something to talk about
		expect(topics(save().player).get("structureBuilt_Big Coop")).toBe(4);
		expect(topics(save().player).get("structureBuilt_Deluxe Coop")).toBe(4);
	});

	it("moves a barn's troughs along when it's upgraded", () => {
		const barn = building(BARN_ID);
		barn.changeType(tier(barn, "Big Barn"));
		flushSync();
		// The animal door moves over one tile
		expect(barn[Raw].animalDoor).toEqual({ X: 4, Y: 3 });
		// Hay in the old trough column (a 1x9 move)
		expect(objectAt(barn, 20, 4)?.name).toBe("Hay");
		expect(objectAt(barn, 20, 12)?.name).toBe("Hay");
		expect(objectAt(barn, 6, 3)?.name).toBe("Feed Hopper");

		barn.changeType(tier(barn, "Deluxe Barn"));
		expect(objectAt(barn, 20, 13)?.name).toBe("Hay");
		expect(objectAt(barn, 22, 13)?.name).toBe("Hay");
		expect(barn.animalOptions.every((o) => o.allowed)).toBe(true);
	});

	it("downgrades back to how it was", () => {
		const coop = building(COOP_ID);
		const before = structuredClone(interior(coop).objects);
		coop.changeType(tier(coop, "Deluxe Coop"));
		expect(coop.changeType(tier(coop, "Coop"))).toEqual([]);
		flushSync();

		expect(interior(coop).objects).toEqual(before);
		expect(coop[Raw]).toMatchObject({ buildingType: "Coop", maxOccupants: 4 });
		expect(interior(coop)).toMatchObject({ name: "Coop", animalLimit: 4 });
		// Still counts as having been built
		expect(save()[Raw].SaveGame.constructedBuildings).toEqual({
			string: ["Big Coop", "Deluxe Coop"],
		});
		// Nothing was built
		expect(topics(save().player).has("structureBuilt_Coop")).toBe(false);
	});

	it("keeps an incubator that has an egg in it", () => {
		const coop = building(COOP_ID);
		coop.changeType(tier(coop, "Big Coop"));
		const incubator = objectAt(coop, 2, 3) as Parsed;
		incubator.heldObject = { name: "Egg", itemId: "176" };

		const problems = coop.changeType(tier(coop, "Coop"));
		expect(problems.map(describeUnplaced)).toEqual([
			"Incubator at 2, 3: it has something in it",
			// So the junimo can't go back
			"Stone Junimo at 14, 8: its old spot is taken",
		]);
		expect(problems.map((p) => p.itemId)).toEqual(["(BC)101", "(BC)55"]);
		expect(objectAt(coop, 2, 3)).toBe(incubator);
		expect(objectAt(coop, 14, 8)?.name).toBe("Stone Junimo");
		expect(objectAt(coop, 1, 3)?.name).toBe("Hay");
	});

	it("moves furniture along when it's upgraded, and back", async () => {
		// A rug over the incubator's spot, two tiles wide
		await load([
			coopXml({ objects: [feedHopper(3, 3)], furniture: [bambooMat(1, 3)] }),
			barnXml(),
		]);
		const coop = building(COOP_ID);
		const before = structuredClone(interior(coop).furniture);
		const rug = () => furnitureOf(coop)[0];

		expect(coop.changeType(tier(coop, "Big Coop"))).toEqual([]);
		// The first move out of the way, (2, 3) to (14, 8), takes it; it's still a tile to the left
		const box = { X: 13 * 64, Y: 8 * 64, Width: 128, Height: 64 };
		expect(rug()).toMatchObject({
			tileLocation: { X: 13, Y: 8 },
			boundingBox: { ...box, Location: { X: box.X, Y: box.Y } },
			defaultBoundingBox: { ...box, Location: { X: box.X, Y: box.Y } },
		});
		// So the incubator fits
		expect(objectAt(coop, 2, 3)?.name).toBe("Incubator");

		expect(coop.changeType(tier(coop, "Coop"))).toEqual([]);
		expect(interior(coop).furniture).toEqual(before);
		expect(objectAt(coop, 2, 3)).toBeUndefined();
	});

	it("won't put the incubator under furniture", async () => {
		// The lamp at 14, 8 was left there by a downgrade
		await load([
			coopXml({
				objects: [feedHopper(3, 3)],
				furniture: [candleLamp(2, 3), candleLamp(14, 8)],
			}),
			barnXml(),
		]);
		const coop = building(COOP_ID);
		const problems = coop.changeType(tier(coop, "Big Coop"));
		expect(problems.map(describeUnplaced)).toEqual([
			"Incubator at 2, 3: something else is in the way",
		]);
		expect(objectAt(coop, 2, 3)).toBeUndefined();
		expect(furnitureOf(coop).map((f) => f.tileLocation)).toEqual([
			{ X: 2, Y: 3 },
			{ X: 14, Y: 8 },
		]);
	});

	it("says what furniture it couldn't move back", async () => {
		await load([
			coopXml({
				type: "Big Coop",
				limit: 8,
				objects: [feedHopper(3, 3), incubator(2, 3)],
				// One in the extra space, and one where it would go back to
				furniture: [candleLamp(14, 7), candleLamp(1, 3)],
			}),
			barnXml(),
		]);
		const coop = building(COOP_ID);
		const problems = coop.changeType(tier(coop, "Coop"));
		expect(problems.map(describeUnplaced)).toEqual([
			"Candle Lamp at 14, 7: its old spot is taken",
		]);
		expect(problems[0]?.itemId).toBe("(F)1751");
		expect(objectAt(coop, 2, 3)).toBeUndefined();
	});

	it("only downgrades when the animals fit", () => {
		const coop = building(COOP_ID);
		const player = save().player;
		coop.changeType(tier(coop, "Big Coop"));
		// Four fit in a Coop
		expect(coop.tierChangeBlocker(tier(coop, "Coop"))).toBeUndefined();
		coop.adoptAnimal("Duck", "Daffy", player);
		coop.adoptAnimal("White Chicken", "Pip", player);

		const reason = "6 animals live here; a Coop holds 4";
		expect(coop.tierChangeBlocker(tier(coop, "Coop"))).toBe(reason);
		expect(() => coop.changeType(tier(coop, "Coop"))).toThrow(reason);
		expect(coop[Raw].buildingType).toBe("Big Coop");
		expect(coop.tierChangeBlocker(tier(coop, "Deluxe Coop"))).toBeUndefined();
	});

	it("upgrades a Shed to a Big Shed, and back", slow, async () => {
		await load([
			coopXml(),
			barnXml(),
			shedXml({ furniture: [candleLamp(3, 3)] }),
		]);
		const shed = building(SHED_ID);
		expect(shed.isAnimalHouse).toBe(false);
		expect(shed.tiers.map((t) => t.name)).toEqual(["Shed", "Big Shed"]);
		expect(shed.animalOptions).toEqual([]);
		const furniture = structuredClone(interior(shed).furniture);

		expect(shed.changeType(tier(shed, "Big Shed"))).toEqual([]);
		flushSync();
		expect(shed[Raw]).toMatchObject({
			buildingType: "Big Shed",
			tilesWide: 7,
			tilesHigh: 3,
			maxOccupants: 20,
			humanDoor: { X: 3, Y: 2 },
			animalDoor: { X: -1, Y: -1 },
		});
		expect(interior(shed).name).toBe("Big Shed");
		// Only animal houses have a limit
		expect(interior(shed)).not.toHaveProperty("animalLimit");
		expect(interior(shed).furniture).toEqual(furniture);
		expect(save()[Raw].SaveGame.constructedBuildings).toEqual({
			string: ["Big Shed"],
		});
		expect(topics(save().player).get("structureBuilt_Big Shed")).toBe(4);
		expect(await exportedBuilding(SHED_ID)).toMatchObject({
			buildingType: "Big Shed",
			tilesWide: 7,
		});

		expect(shed.changeType(tier(shed, "Shed"))).toEqual([]);
		expect(shed[Raw].buildingType).toBe("Shed");
		expect(interior(shed).name).toBe("Shed");
	});

	it("doesn't know what can live in a modded coop", async () => {
		await load([coopXml({ type: "Fancy Coop" }), barnXml()]);
		const coop = building(COOP_ID);
		expect(coop.isAnimalHouse).toBe(true);
		expect(coop.tiers).toEqual([]);
		expect(coop.animalOptions).toEqual([]);
		// Its own animal limit still counts
		expect(coop.capacity).toBe(4);
		expect(() =>
			coop.adoptAnimal("White Chicken", "Pip", save().player),
		).toThrow("A White Chicken can't live in a Fancy Coop");
	});

	it("waits for Robin", () => {
		const coop = building(COOP_ID);
		coop[Raw].daysUntilUpgrade = 2;
		expect(coop.tierChangeBlocker(tier(coop, "Big Coop"))).toBe(
			"Robin is already upgrading the Coop",
		);
		coop[Raw].daysUntilUpgrade = 0;
		coop[Raw].daysOfConstructionLeft = 1;
		expect(() => coop.changeType(tier(coop, "Big Coop"))).toThrow(
			"still being built",
		);
	});

	describe("adopted animals' effects", () => {
		/** Adopt an animal, the way the add form does (outside any effect), watching its Dispose */
		const adopt = (b: Building, type: string, name: string) => {
			const animal = b.adoptAnimal(type, name, save().player);
			const dispose = vi.fn(animal[Dispose]);
			animal[Dispose] = dispose;
			return { animal, dispose };
		};
		/** Whether an animal's edits still reach the save */
		const isLive = (animal: FarmAnimal) => {
			animal.friendshipTowardFarmer += 1;
			flushSync();
			return (
				animal[Raw].value.FarmAnimal.friendshipTowardFarmer ===
				animal.friendshipTowardFarmer
			);
		};

		it("end when the save is closed", () => {
			const { animal, dispose } = adopt(building(BARN_ID), "White Cow", "Moo");
			const clucky = save().farmAnimals.find((a) => a.name === "Clucky");
			if (!clucky) throw new Error("No Clucky");
			expect(isLive(animal)).toBe(true);
			expect(dispose).not.toHaveBeenCalled();

			saveManager.reset();
			expect(dispose).toHaveBeenCalledOnce();
			expect(isLive(animal)).toBe(false);
			// Animals loaded with the save end with it too
			expect(isLive(clucky)).toBe(false);
		});

		it("end when another save is opened", async () => {
			const { animal, dispose } = adopt(building(BARN_ID), "White Cow", "Moo");
			await saveManager.import(new File([xml], "TestSave"));
			expect(dispose).toHaveBeenCalledOnce();
			expect(isLive(animal)).toBe(false);

			// The new save's animals are fine, and closing it doesn't end the old ones again
			const next = adopt(building(BARN_ID), "White Cow", "Moo");
			expect(isLive(next.animal)).toBe(true);
			saveManager.reset();
			expect(next.dispose).toHaveBeenCalledOnce();
			expect(dispose).toHaveBeenCalledOnce();
		});

		it("carry on through upgrades and downgrades", () => {
			const barn = building(BARN_ID);
			const cow = adopt(barn, "White Cow", "Moo");
			barn.changeType(tier(barn, "Big Barn"));
			barn.changeType(tier(barn, "Barn"));
			// A downgrade the animals don't fit into is refused, so none are left behind
			const coop = building(COOP_ID);
			coop.changeType(tier(coop, "Big Coop"));
			const duck = adopt(coop, "Duck", "Daffy");
			expect(() => coop.changeType(tier(coop, "Coop"))).toThrow(
				"5 animals live here",
			);

			for (const [b, { animal, dispose }] of [
				[barn, cow],
				[coop, duck],
			] as const) {
				expect(b.indoorLocation?.animals).toContain(animal);
				expect(isLive(animal)).toBe(true);
				expect(dispose).not.toHaveBeenCalled();
			}
			saveManager.reset();
			expect(cow.dispose).toHaveBeenCalledOnce();
			expect(duck.dispose).toHaveBeenCalledOnce();
		});
	});
});
