import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import type { Building, Player, Save } from "../codegen/save";
import { SaveProxy } from "../src/lib/proxies/SaveFile.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { XMLManager } from "../src/lib/workers/xml";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown) => value as Record<string, unknown>;
const prop = (value: unknown, key: string) => asRecord(value)[key];
const hasArrayProp = (value: unknown, key: string) =>
	Array.isArray(prop(value, key));

describe("SaveProxy", () => {
	mockIDB();

	it("parses a single cellar assignment item as an array", () => {
		const raw = new XMLManager().parse<SaveFile>(`
			<SaveGame>
				<cellarAssignments>
					<item>
						<key><int>1</int></key>
						<value><long>123</long></value>
					</item>
				</cellarAssignments>
			</SaveGame>
		`);

		expect(Array.isArray(raw.SaveGame.cellarAssignments.item)).toBe(true);
		expect(raw.SaveGame.cellarAssignments.item).toHaveLength(1);
		expect(raw.SaveGame.cellarAssignments.item[0]?.value.long).toBe(123);
	});

	it("parses issue #113 singleton collections as arrays", () => {
		const raw = new XMLManager().parse<SaveFile>(`
			<SaveGame>
				<broadcastedMail>
					<string>%&amp;SM&amp;%landslideDone</string>
				</broadcastedMail>
				<locations>
					<GameLocation>
						<name>Farm</name>
						<buildings>
							<Building>
								<buildingType>Coop</buildingType>
							</Building>
						</buildings>
					</GameLocation>
					<GameLocation>
						<name>Town</name>
						<buildings />
					</GameLocation>
				</locations>
			</SaveGame>
		`);

		const farm = raw.SaveGame.locations.GameLocation[0];

		expect(Array.isArray(raw.SaveGame.broadcastedMail.string)).toBe(true);
		expect(raw.SaveGame.broadcastedMail.string).toEqual([
			"%&SM&%landslideDone",
		]);
		expect(Array.isArray(farm?.buildings?.Building)).toBe(true);
		expect(farm?.buildings?.Building).toHaveLength(1);
		expect(farm?.buildings?.Building?.[0]?.buildingType).toBe("Coop");
	});

	it("parses singleton save collections from decompiled save types as arrays", () => {
		const raw = new XMLManager().parse<{ SaveGame: Record<string, unknown> }>(`
			<SaveGame>
				<constructedBuildings><string>Coop</string></constructedBuildings>
				<worldStateIDs><string>world-ready</string></worldStateIDs>
				<foundBuriedNuts><string>Island_North_1</string></foundBuriedNuts>
				<checkedGarbage><string>Town_42</string></checkedGarbage>
				<completedSpecialOrders><string>Order.Id</string></completedSpecialOrders>
				<acceptedSpecialOrderTypes><string>Qi</string></acceptedSpecialOrderTypes>
				<collectedNutTracker><string>1</string></collectedNutTracker>
				<raccoonBundles><boolean>false</boolean></raccoonBundles>
				<player>
					<questLog><Quest><id>1</id></Quest></questLog>
					<professions><int>0</int></professions>
					<dialogueQuestionsAnswered><int>123</int></dialogueQuestionsAnswered>
					<specialItems><int>1</int></specialItems>
					<specialBigCraftables><int>2</int></specialBigCraftables>
					<newLevels><Point><X>1</X><Y>2</Y></Point></newLevels>
					<items>
						<Item><name>Parsnip</name></Item>
					</items>
					<itemsLostLastDeath>
						<Item><name>Stone</name></Item>
					</itemsLostLastDeath>
					<leftRing>
						<combinedRings>
							<Ring><name>Ruby Ring</name></Ring>
						</combinedRings>
						<enchantments>Swift</enchantments>
						<previousEnchantments>Efficient</previousEnchantments>
					</leftRing>
				</player>
				<locations>
					<GameLocation>
						<name>Farm</name>
						<characters><NPC><name>Robin</name></NPC></characters>
						<resourceClumps><ResourceClump><width>2</width></ResourceClump></resourceClumps>
						<largeTerrainFeatures>
							<LargeTerrainFeature><size>3</size></LargeTerrainFeature>
						</largeTerrainFeatures>
						<furniture><Furniture><name>Chair</name></Furniture></furniture>
						<objects>
							<item>
								<key><Vector2><X>0</X><Y>0</Y></Vector2></key>
								<value>
									<Object>
										<attachments><Object xsi:nil="true" /></attachments>
									</Object>
								</value>
							</item>
						</objects>
						<buildings>
							<Building>
								<buildingChests>
									<Chest><name>Chest</name></Chest>
								</buildingChests>
							</Building>
						</buildings>
					</GameLocation>
				</locations>
				<specialOrders>
					<SpecialOrder>
						<preSelectedItems><item><key><string>A</string></key><value><string>B</string></value></item></preSelectedItems>
						<selectedRandomElements><item><key><string>A</string></key><value><int>1</int></value></item></selectedRandomElements>
						<objectives><currentCount>0</currentCount></objectives>
						<participantsIDs><item><key><long>1</long></key><value><boolean>true</boolean></value></item></participantsIDs>
						<rewards><amount><int>1</int></amount></rewards>
						<donatedItems><Item><name>Wood</name></Item></donatedItems>
					</SpecialOrder>
				</specialOrders>
				<availableSpecialOrders>
					<SpecialOrder>
						<objectives><currentCount>0</currentCount></objectives>
						<rewards><amount><int>1</int></amount></rewards>
					</SpecialOrder>
				</availableSpecialOrders>
			</SaveGame>
		`);

		const save = raw.SaveGame;
		const player = prop(save, "player");
		const location = (
			prop(prop(save, "locations"), "GameLocation") as unknown[]
		)[0];
		const order = (
			prop(prop(save, "specialOrders"), "SpecialOrder") as unknown[]
		)[0];
		const leftRing = prop(player, "leftRing");
		const object = prop(
			(prop(prop(location, "objects"), "item") as unknown[])[0],
			"value",
		);
		const building = (
			prop(prop(location, "buildings"), "Building") as unknown[]
		)[0];

		expect(hasArrayProp(prop(save, "constructedBuildings"), "string")).toBe(
			true,
		);
		expect(hasArrayProp(prop(save, "worldStateIDs"), "string")).toBe(true);
		expect(hasArrayProp(prop(save, "foundBuriedNuts"), "string")).toBe(true);
		expect(hasArrayProp(prop(save, "checkedGarbage"), "string")).toBe(true);
		expect(hasArrayProp(prop(save, "completedSpecialOrders"), "string")).toBe(
			true,
		);
		expect(
			hasArrayProp(prop(save, "acceptedSpecialOrderTypes"), "string"),
		).toBe(true);
		expect(hasArrayProp(prop(save, "collectedNutTracker"), "string")).toBe(
			true,
		);
		expect(hasArrayProp(prop(save, "raccoonBundles"), "boolean")).toBe(true);
		expect(hasArrayProp(prop(player, "questLog"), "Quest")).toBe(true);
		expect(hasArrayProp(prop(player, "professions"), "int")).toBe(true);
		expect(hasArrayProp(prop(player, "dialogueQuestionsAnswered"), "int")).toBe(
			true,
		);
		expect(hasArrayProp(prop(player, "specialItems"), "int")).toBe(true);
		expect(hasArrayProp(prop(player, "specialBigCraftables"), "int")).toBe(
			true,
		);
		expect(hasArrayProp(prop(player, "newLevels"), "Point")).toBe(true);
		expect(hasArrayProp(prop(player, "items"), "Item")).toBe(true);
		expect(hasArrayProp(prop(player, "itemsLostLastDeath"), "Item")).toBe(true);
		expect(hasArrayProp(prop(leftRing, "combinedRings"), "Ring")).toBe(true);
		expect(Array.isArray(prop(leftRing, "enchantments"))).toBe(true);
		expect(Array.isArray(prop(leftRing, "previousEnchantments"))).toBe(true);
		expect(hasArrayProp(prop(location, "characters"), "NPC")).toBe(true);
		expect(
			hasArrayProp(prop(location, "resourceClumps"), "ResourceClump"),
		).toBe(true);
		expect(
			hasArrayProp(
				prop(location, "largeTerrainFeatures"),
				"LargeTerrainFeature",
			),
		).toBe(true);
		expect(hasArrayProp(prop(location, "furniture"), "Furniture")).toBe(true);
		expect(hasArrayProp(prop(location, "objects"), "item")).toBe(true);
		expect(
			hasArrayProp(prop(prop(object, "Object"), "attachments"), "Object"),
		).toBe(true);
		expect(hasArrayProp(prop(building, "buildingChests"), "Chest")).toBe(true);
		expect(hasArrayProp(prop(save, "specialOrders"), "SpecialOrder")).toBe(
			true,
		);
		expect(
			hasArrayProp(prop(save, "availableSpecialOrders"), "SpecialOrder"),
		).toBe(true);
		expect(hasArrayProp(prop(order, "preSelectedItems"), "item")).toBe(true);
		expect(hasArrayProp(prop(order, "selectedRandomElements"), "item")).toBe(
			true,
		);
		expect(Array.isArray(prop(order, "objectives"))).toBe(true);
		expect(hasArrayProp(prop(order, "participantsIDs"), "item")).toBe(true);
		expect(Array.isArray(prop(order, "rewards"))).toBe(true);
		expect(hasArrayProp(prop(order, "donatedItems"), "Item")).toBe(true);
	});

	it("keeps cellar assignments aligned when promoting a farmhand to host", async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		let importTask: Promise<void> = Promise.resolve();
		let saveManager!: SaveManager;
		const managerCleanup = $effect.root(() => {
			saveManager = new SaveManager();
			importTask = saveManager.import(
				new File([xml], "TestSave", { type: "text/xml" }),
			);
		});
		await importTask;
		flushSync();

		const raw = saveManager.save?.raw;
		if (!raw) throw new Error("Expected imported save");

		const host = raw.SaveGame.player;
		const farmhand = clone(host);
		const hostId = host.UniqueMultiplayerID;
		const farmhandId = 123456789;

		farmhand.name = "Farmhand";
		farmhand.UniqueMultiplayerID = farmhandId;
		farmhand.homeLocation = "CabinFarmhand";
		raw.SaveGame.farmhands = { Farmer: [farmhand as Player] };
		raw.SaveGame.cellarAssignments = {
			item: [
				{ key: { int: 1 }, value: { long: hostId } },
				{ key: { int: 2 }, value: { long: farmhandId } },
			],
		} as Save["cellarAssignments"];
		const farm = raw.SaveGame.locations.GameLocation.find(
			(location) => location.name === "Farm",
		);
		if (!farm?.buildings) throw new Error("Expected farm buildings");
		farm.buildings.Building = [
			...(farm.buildings.Building ?? []),
			{
				buildingType: "Cabin",
				owner: hostId,
				indoors: {
					"@_xsi:type": "Cabin",
					name: "Cabin",
					uniqueName: "CabinFarmhand",
					farmhandReference: farmhandId,
				},
			} as Building,
		];

		let save!: SaveProxy;
		const cleanup = $effect.root(() => {
			save = new SaveProxy(raw);
		});
		flushSync();

		const promotedFarmhand = save.players[1];
		const demotedHost = save.players[0];
		if (!promotedFarmhand || !demotedHost) {
			throw new Error("Expected host and farmhand");
		}
		save.players = [promotedFarmhand, demotedHost];
		flushSync();
		cleanup();
		managerCleanup();

		expect(raw.SaveGame.player.UniqueMultiplayerID).toBe(farmhandId);
		expect(raw.SaveGame.player.homeLocation).toBe("FarmHouse");
		expect(raw.SaveGame.farmhands.Farmer[0]?.UniqueMultiplayerID).toBe(hostId);
		expect(raw.SaveGame.farmhands.Farmer[0]?.homeLocation).toBe(
			"CabinFarmhand",
		);

		const assignments = new Map(
			raw.SaveGame.cellarAssignments.item.map((item) => [
				item.key.int,
				item.value.long,
			]),
		);
		expect(assignments.get(1)).toBe(farmhandId);
		expect(assignments.get(2)).toBe(hostId);

		const reassignedCabin = farm.buildings.Building?.find(
			(building) => building.indoors?.uniqueName === "CabinFarmhand",
		);
		expect(reassignedCabin?.indoors?.farmhandReference).toBe(hostId);
	});
});
