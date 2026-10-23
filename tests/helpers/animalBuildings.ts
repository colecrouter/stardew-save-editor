/**
    The test save has no coops, barns, sheds or farm animals, so these add
    some, in the shape the game (1.6) saves them: a Coop and a Barn on the
    farm, each a `<Building>` with an `AnimalHouse` interior, and optionally
    a Shed.
*/

export const PLAYER_ID = "6932267015257027425";
export const COOP_ID = "0c000000-0000-4000-8000-00000000c00b";
export const BARN_ID = "0b000000-0000-4000-8000-00000000ba7a";

/** Coop residents: three inside, and Wanderer, who's out on the farm */
export const COOP_ANIMALS = {
	clucky: "1584145784548083459",
	nugget: "1584145784548083460",
	sunny: "1584145784548083461",
	wanderer: "1584145784548083462",
};
export const BARN_ANIMALS = {
	daisy: "1584145784548083463",
	bessie: "1584145784548083464",
};

interface AnimalXml {
	id: string;
	name: string;
	type: string;
	house: "Coop" | "Barn";
	age?: number;
	daysOwned?: number;
}

const tile = (x: number, y: number) => `<X>${x}</X><Y>${y}</Y>`;

const farmAnimal = ({
	id,
	name,
	type,
	house,
	age = 10,
	daysOwned,
}: AnimalXml) =>
	`<item><key><long>${id}</long></key><value><FarmAnimal>` +
	`<name>${name}</name><forceOneTileWide>false</forceOneTileWide><isEmoting>false</isEmoting>` +
	`<isCharging>false</isCharging><isGlowing>false</isGlowing><coloredBorder>false</coloredBorder>` +
	`<flip>false</flip><drawOnTop>false</drawOnTop><faceTowardFarmer>false</faceTowardFarmer>` +
	`<ignoreMovementAnimation>false</ignoreMovementAnimation><faceAwayFromFarmer>false</faceAwayFromFarmer>` +
	`<scale><float>1</float></scale><glowingTransparency>0</glowingTransparency><glowRate>0</glowRate>` +
	`<Gender>Undefined</Gender><willDestroyObjectsUnderfoot>true</willDestroyObjectsUnderfoot>` +
	`<Position>${tile(320, 384)}</Position><Speed>2</Speed><FacingDirection>2</FacingDirection>` +
	`<IsEmoting>false</IsEmoting><CurrentEmote>0</CurrentEmote><Scale>1</Scale>` +
	`<isSwimming><boolean>false</boolean></isSwimming><friendshipTowardFarmer>150</friendshipTowardFarmer>` +
	`<age>${age}</age><daysOwned>${daysOwned ?? age}</daysOwned><health>3</health><produceQuality>0</produceQuality>` +
	`<daysSinceLastLay>0</daysSinceLastLay><happiness>200</happiness><fullness>255</fullness>` +
	`<wasAutoPet>false</wasAutoPet><wasPet>false</wasPet><allowReproduction>true</allowReproduction>` +
	`<type>${type}</type><buildingTypeILiveIn>${house}</buildingTypeILiveIn><myID>${id}</myID>` +
	`<ownerID>${PLAYER_ID}</ownerID><parentId>-1</parentId><hasEatenAnimalCracker>false</hasEatenAnimalCracker>` +
	`<moodMessage>0</moodMessage><isEating>false</isEating><displayName>${name}</displayName>` +
	"</FarmAnimal></value></item>";

const rect = (x: number, y: number, width: number, height: number) =>
	`<X>${x}</X><Y>${y}</Y><Width>${width}</Width><Height>${height}</Height>` +
	`<Location><X>${x}</X><Y>${y}</Y></Location><Size><X>${width}</X><Y>${height}</Y></Size>`;

const box = (x: number, y: number) =>
	`<boundingBox>${rect(x * 64, y * 64, 64, 64)}</boundingBox>`;

/** A placed object, as in the farm's objects in the test save */
export const objectXml = (
	x: number,
	y: number,
	{
		name,
		itemId,
		bigCraftable = false,
		fragility = 0,
		heldObject = "",
	}: {
		name: string;
		itemId: string;
		bigCraftable?: boolean;
		fragility?: number;
		heldObject?: string;
	},
) =>
	`<item><key><Vector2>${tile(x, y)}</Vector2></key><value><Object>` +
	`<isLostItem>false</isLostItem><category>${bigCraftable ? -9 : 0}</category>` +
	`<hasBeenInInventory>${bigCraftable ? "false" : "true"}</hasBeenInInventory><name>${name}</name>` +
	`<parentSheetIndex>${itemId}</parentSheetIndex><itemId>${itemId}</itemId><specialItem>false</specialItem>` +
	`<isRecipe>false</isRecipe><quality>0</quality><stack>1</stack><SpecialVariable>0</SpecialVariable>` +
	`<tileLocation>${tile(x, y)}</tileLocation><owner>0</owner><type>${bigCraftable ? "Crafting" : "Basic"}</type>` +
	"<canBeSetDown>true</canBeSetDown><canBeGrabbed>true</canBeGrabbed><isSpawnedObject>false</isSpawnedObject>" +
	`<questItem>false</questItem><isOn>true</isOn><fragility>${fragility}</fragility><price>0</price>` +
	`<edibility>-300</edibility><bigCraftable>${bigCraftable}</bigCraftable><setOutdoors>true</setOutdoors>` +
	"<setIndoors>true</setIndoors><readyForHarvest>false</readyForHarvest><showNextIndex>false</showNextIndex>" +
	`<flipped>false</flipped><isLamp>false</isLamp>${heldObject}<minutesUntilReady>0</minutesUntilReady>` +
	`${box(x, y)}<scale><X>0</X><Y>0</Y></scale><uses>0</uses><destroyOvernight>false</destroyOvernight>` +
	"</Object></value></item>";

export const hay = (x: number, y: number) =>
	objectXml(x, y, { name: "Hay", itemId: "178" });
export const feedHopper = (x: number, y: number) =>
	objectXml(x, y, {
		name: "Feed Hopper",
		itemId: "99",
		bigCraftable: true,
		fragility: 2,
	});
export const stoneJunimo = (x: number, y: number) =>
	objectXml(x, y, { name: "Stone Junimo", itemId: "55", bigCraftable: true });
export const incubator = (x: number, y: number) =>
	objectXml(x, y, {
		name: "Incubator",
		itemId: "101",
		bigCraftable: true,
		fragility: 2,
	});

/** A piece of furniture, as in the farmhouse's furniture in the test save */
const furnitureXml = (
	x: number,
	y: number,
	{
		name,
		itemId,
		price,
		size,
		type,
		rotations,
		source,
	}: {
		name: string;
		itemId: string;
		price: number;
		/** In tiles */
		size: { X: number; Y: number };
		type: number;
		rotations: number;
		source: [x: number, y: number, width: number, height: number];
	},
) => {
	const box = rect(x * 64, y * 64, size.X * 64, size.Y * 64);
	const sourceRect = rect(...source);
	return (
		`<Furniture><isLostItem>false</isLostItem><category>0</category><hasBeenInInventory>false</hasBeenInInventory>` +
		`<name>${name}</name><parentSheetIndex>${itemId}</parentSheetIndex><itemId>${itemId}</itemId>` +
		`<specialItem>false</specialItem><isRecipe>false</isRecipe><quality>0</quality><stack>1</stack>` +
		`<SpecialVariable>0</SpecialVariable><tileLocation>${tile(x, y)}</tileLocation><owner>0</owner>` +
		"<canBeSetDown>false</canBeSetDown><canBeGrabbed>true</canBeGrabbed><isSpawnedObject>false</isSpawnedObject>" +
		`<questItem>false</questItem><isOn>false</isOn><fragility>0</fragility><price>${price}</price>` +
		"<edibility>-300</edibility><bigCraftable>false</bigCraftable><setOutdoors>false</setOutdoors>" +
		"<setIndoors>false</setIndoors><readyForHarvest>false</readyForHarvest><showNextIndex>false</showNextIndex>" +
		"<flipped>false</flipped><isLamp>false</isLamp><minutesUntilReady>0</minutesUntilReady>" +
		`<boundingBox>${box}</boundingBox><scale><X>0</X><Y>0</Y></scale><uses>0</uses>` +
		`<destroyOvernight>false</destroyOvernight><furniture_type>${type}</furniture_type>` +
		`<rotations>${rotations}</rotations><currentRotation>0</currentRotation>` +
		`<sourceRect>${sourceRect}</sourceRect><defaultSourceRect>${sourceRect}</defaultSourceRect>` +
		`<defaultBoundingBox>${box}</defaultBoundingBox><drawHeldObjectLow>false</drawHeldObjectLow></Furniture>`
	);
};

/** A rug two tiles wide */
export const bambooMat = (x: number, y: number) =>
	furnitureXml(x, y, {
		name: "Bamboo Mat",
		itemId: "1755",
		price: 250,
		size: { X: 2, Y: 1 },
		type: 12,
		rotations: 2,
		source: [432, 864, 32, 16],
	});
export const candleLamp = (x: number, y: number) =>
	furnitureXml(x, y, {
		name: "Candle Lamp",
		itemId: "1751",
		price: 1000,
		size: { X: 1, Y: 1 },
		type: 7,
		rotations: 1,
		source: [368, 864, 16, 48],
	});

const paintColor =
	'<buildingPaintColor><ColorName><string xsi:nil="true" /></ColorName>' +
	[1, 2, 3]
		.map(
			(n) =>
				`<Color${n}Default><boolean>true</boolean></Color${n}Default><Color${n}Hue><int>0</int></Color${n}Hue>` +
				`<Color${n}Saturation><int>0</int></Color${n}Saturation><Color${n}Lightness><int>0</int></Color${n}Lightness>`,
		)
		.join("") +
	"</buildingPaintColor>";

const waterColor =
	"<waterColor><B>127</B><G>100</G><R>60</R><A>127</A><PackedValue>2139055164</PackedValue></waterColor>";

const dictionary = (items: string) =>
	items ? `<animals>${items}</animals>` : "<animals />";

const list = (tag: string, items: readonly string[] = []) =>
	items.length ? `<${tag}>${items.join("")}</${tag}>` : `<${tag} />`;

/** A `<Building>` around its interior */
const buildingXml = (b: {
	id: string;
	type: string;
	indoors: string;
	x: number;
	y: number;
	size: { X: number; Y: number };
	limit: number;
	occupants: number;
	humanDoor: { X: number; Y: number };
	animalDoor: { X: number; Y: number };
	daysOfConstructionLeft?: number;
}) =>
	`<Building><id>${b.id}</id><skinId><string xsi:nil="true" /></skinId>${b.indoors}` +
	`<nonInstancedIndoorsName><string xsi:nil="true" /></nonInstancedIndoorsName>` +
	`<tileX>${b.x}</tileX><tileY>${b.y}</tileY><tilesWide>${b.size.X}</tilesWide><tilesHigh>${b.size.Y}</tilesHigh>` +
	`<maxOccupants>${b.limit}</maxOccupants><currentOccupants>${b.occupants}</currentOccupants>` +
	`<daysOfConstructionLeft>${b.daysOfConstructionLeft ?? 0}</daysOfConstructionLeft><daysUntilUpgrade>0</daysUntilUpgrade>` +
	`<buildingType>${b.type}</buildingType>${paintColor}<hayCapacity>0</hayCapacity><buildingChests />` +
	`<humanDoor>${tile(b.humanDoor.X, b.humanDoor.Y)}</humanDoor><animalDoor>${tile(b.animalDoor.X, b.animalDoor.Y)}</animalDoor>` +
	"<animalDoorOpen>true</animalDoorOpen><animalDoorOpenAmount>0</animalDoorOpenAmount><magical>false</magical>" +
	"<fadeWhenPlayerIsBehind>true</fadeWhenPlayerIsBehind><owner>0</owner><isMoving>false</isMoving></Building>";

interface AnimalHouseXml {
	id: string;
	type: string;
	map: string;
	x: number;
	y: number;
	size: { X: number; Y: number };
	limit: number;
	humanDoor: { X: number; Y: number };
	animalDoor: { X: number; Y: number };
	inside: AnimalXml[];
	residents: string[];
	objects: string[];
	furniture?: string[];
	daysOfConstructionLeft?: number;
}

/** A coop or barn `<Building>`, with its `AnimalHouse` interior */
export const animalHouseXml = (b: AnimalHouseXml) => {
	const animals = b.inside.map(farmAnimal).join("");
	const residents = b.residents.length
		? `<animalsThatLiveHere>${b.residents.map((id) => `<long>${id}</long>`).join("")}</animalsThatLiveHere>`
		: "<animalsThatLiveHere />";
	const indoors =
		`<indoors xsi:type="AnimalHouse"><buildings />${dictionary(animals)}<piecesOfHay>0</piecesOfHay>` +
		`<characters />${list("objects", b.objects)}<resourceClumps /><largeTerrainFeatures /><terrainFeatures />` +
		`<uniqueName>${b.map}${b.id}</uniqueName><name>${b.type}</name>${waterColor}` +
		"<isFarm>true</isFarm><isOutdoors>false</isOutdoors><isStructure>true</isStructure>" +
		"<ignoreDebrisWeather>false</ignoreDebrisWeather><ignoreOutdoorLighting>false</ignoreOutdoorLighting>" +
		"<ignoreLights>false</ignoreLights><treatAsOutdoors>false</treatAsOutdoors>" +
		"<numberOfSpawnedObjectsOnMap>0</numberOfSpawnedObjectsOnMap><miniJukeboxCount>0</miniJukeboxCount>" +
		`<miniJukeboxTrack />${list("furniture", b.furniture)}` +
		`<Animals>${animals ? `<SerializableDictionaryOfInt64FarmAnimal>${animals}</SerializableDictionaryOfInt64FarmAnimal>` : "<SerializableDictionaryOfInt64FarmAnimal />"}</Animals>` +
		`<IsGreenhouse>false</IsGreenhouse><animalLimit>${b.limit}</animalLimit>${residents}</indoors>`;
	return buildingXml({ ...b, indoors, occupants: b.inside.length });
};

export const SHED_ID = "05000000-0000-4000-8000-0000000005ed";

/** A Shed: a `<Building>` with a decoratable `Shed` interior */
export const shedXml = ({
	objects = [] as string[],
	furniture = [] as string[],
} = {}) =>
	buildingXml({
		id: SHED_ID,
		type: "Shed",
		indoors:
			`<indoors xsi:type="Shed"><buildings /><animals /><piecesOfHay>0</piecesOfHay>` +
			`<characters />${list("objects", objects)}<resourceClumps /><largeTerrainFeatures /><terrainFeatures />` +
			`<uniqueName>Shed${SHED_ID}</uniqueName><name>Shed</name>${waterColor}` +
			"<isFarm>true</isFarm><isOutdoors>false</isOutdoors><isStructure>true</isStructure>" +
			"<ignoreDebrisWeather>false</ignoreDebrisWeather><ignoreOutdoorLighting>false</ignoreOutdoorLighting>" +
			"<ignoreLights>false</ignoreLights><treatAsOutdoors>false</treatAsOutdoors>" +
			"<numberOfSpawnedObjectsOnMap>0</numberOfSpawnedObjectsOnMap><miniJukeboxCount>0</miniJukeboxCount>" +
			`<miniJukeboxTrack />${list("furniture", furniture)}` +
			"<Animals><SerializableDictionaryOfInt64FarmAnimal /></Animals><IsGreenhouse>false</IsGreenhouse>" +
			"<wallPaper /><appliedWallpaper><SerializableDictionaryOfStringString /></appliedWallpaper>" +
			"<floor /><appliedFloor><SerializableDictionaryOfStringString /></appliedFloor></indoors>",
		x: 60,
		y: 20,
		size: { X: 7, Y: 3 },
		limit: 20,
		occupants: 0,
		humanDoor: { X: 3, Y: 2 },
		// No animal door
		animalDoor: { X: -1, Y: -1 },
	});

export const coopXml = (options: Partial<AnimalHouseXml> = {}) =>
	animalHouseXml({
		id: COOP_ID,
		type: "Coop",
		map: "Coop",
		x: 40,
		y: 20,
		size: { X: 6, Y: 3 },
		limit: 4,
		humanDoor: { X: 1, Y: 2 },
		animalDoor: { X: 2, Y: 2 },
		inside: [
			// Bought before daysOwned was saved: -1, so the game goes by age
			{
				id: COOP_ANIMALS.clucky,
				name: "Clucky",
				type: "White Chicken",
				house: "Coop",
				age: 12,
				daysOwned: -1,
			},
			{
				id: COOP_ANIMALS.nugget,
				name: "Nugget",
				type: "Brown Chicken",
				house: "Coop",
				age: 30,
				daysOwned: 7,
			},
			{
				id: COOP_ANIMALS.sunny,
				name: "Sunny",
				type: "Golden Chicken",
				house: "Coop",
			},
		],
		residents: Object.values(COOP_ANIMALS),
		objects: [feedHopper(3, 3), stoneJunimo(2, 3), hay(1, 3), hay(10, 4)],
		...options,
	});

export const barnXml = (options: Partial<AnimalHouseXml> = {}) =>
	animalHouseXml({
		id: BARN_ID,
		type: "Barn",
		map: "Barn",
		x: 50,
		y: 20,
		size: { X: 7, Y: 4 },
		limit: 4,
		humanDoor: { X: 1, Y: 3 },
		animalDoor: { X: 3, Y: 3 },
		inside: [
			{
				id: BARN_ANIMALS.daisy,
				name: "Daisy",
				type: "White Cow",
				house: "Barn",
			},
			{
				id: BARN_ANIMALS.bessie,
				name: "Bessie",
				type: "Brown Cow",
				house: "Barn",
			},
		],
		residents: Object.values(BARN_ANIMALS),
		objects: [feedHopper(6, 3), hay(16, 4), hay(16, 12)],
		...options,
	});

/** Wanderer, a Coop resident who's out on the farm */
const outside = farmAnimal({
	id: COOP_ANIMALS.wanderer,
	name: "Wanderer",
	type: "White Chicken",
	house: "Coop",
});

/**
    Add the coop and barn to the test save's farm, with Wanderer outside.
    `buildings` replaces the coop and barn with other buildings.
*/
export function withAnimalBuildings(
	xml: string,
	buildings = [coopXml(), barnXml()],
) {
	const farm = xml.indexOf('<GameLocation xsi:type="Farm">');
	if (farm === -1) throw new Error("The save has no farm");
	const insert = (text: string, find: string, replace: string) => {
		const at = text.indexOf(find, farm);
		if (at === -1) throw new Error(`No ${find} on the farm`);
		return text.slice(0, at) + replace + text.slice(at + find.length);
	};
	// The farm's own (empty) animal lists come first, before the buildings go in
	let result = insert(xml, "<animals />", `<animals>${outside}</animals>`);
	result = insert(
		result,
		"<SerializableDictionaryOfInt64FarmAnimal />",
		`<SerializableDictionaryOfInt64FarmAnimal>${outside}</SerializableDictionaryOfInt64FarmAnimal>`,
	);
	return insert(result, "<buildings>", `<buildings>${buildings.join("")}`);
}
