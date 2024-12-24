import type { FurnitureType } from "./items";

export interface Save {
    player: Player;
    farmhands: { Farmer: Player[] } | "";
    locations: Locations;
    currentSeason: Season;
    samBandName?: string;
    elliottBookName?: string;
    broadcastedMail: BroadcastedMail;
    worldStateIDs: BroadcastedMail;
    lostBooksFound: number;
    goldenWalnuts?: number;
    goldenWalnutsFound?: number;
    miniShippingBinsObtained?: number;
    mineShrineActivated?: boolean;
    skullShrineActivated?: boolean;
    goldenCoconutCracked?: boolean;
    parrotPlatformsUnlocked?: boolean;
    farmPerfect?: boolean;
    foundBuriedNuts?: string;
    checkedGarbage?: string;
    visitsUntilY1Guarantee: number;
    shuffleMineChests: string;
    dayOfMonth: number;
    year: number;
    countdownToWedding: string;
    dailyLuck: number;
    uniqueIDForThisGame: number;
    weddingToday: boolean;
    isRaining: boolean;
    isDebrisWeather: boolean;
    isLightning: boolean;
    isSnowing: boolean;
    shouldSpawnMonsters: boolean;
    hasApplied1_3_UpdateChanges: boolean;
    hasApplied1_4_UpdateChanges: boolean;
    musicVolume: number;
    soundVolume: number;
    dishOfTheDay: Item;
    highestPlayerLimit: number;
    moveBuildingPermissionMode: number;
    useLegacyRandom: boolean;
    locationWeather: LocationWeather;
    builders: string;
    bannedUsers: string;
    bundleData: BundleData;
    limitedNutDrops: ItemArray;
    latestID: number;
    options: Options;
    splitscreenOptions: string;
    CustomData: string;
    mine_permanentMineChanges: MinePermanentMineChanges;
    mine_lowestLevelReached: number;
    weatherForTomorrow: WeatherForTomorrow;
    whichFarm: number;
    mine_lowestLevelReachedForOrder: number;
    skullCavesDifficulty: number;
    minesDifficulty: number;
    currentGemBirdIndex: number;
    junimoKartLeaderboards: JunimoKartLeaderboards;
    specialOrders: SpecialOrders;
    availableSpecialOrders: AvailableSpecialOrders;
    completedSpecialOrders: BroadcastedMail;
    acceptedSpecialOrderTypes: StringContainer;
    returnedDonations: string;
    globalInventories: string;
    collectedNutTracker: StringContainer;
    farmerFriendships: string;
    cellarAssignments: CellarAssignments;
    timesFedRaccoons: number;
    treasureTotemsUsed: number;
    perfectionWaivers: number;
    seasonOfCurrentRaccoonBundle: number;
    raccoonBundles: BoolArrayContainer;
    activatedGoldenParrot: boolean;
    daysPlayedWhenLastRaccoonBundleWasFinished: number;
    lastAppliedSaveFix: number;
    gameVersion: string;
}

export interface KV<K, V> {
    key: K;
    value: V;
}

export interface StringContainer {
    string: string;
}

export interface AvailableSpecialOrders {
    SpecialOrder: AvailableSpecialOrdersSpecialOrder[];
}

export interface AvailableSpecialOrdersSpecialOrder {
    preSelectedItems: string;
    selectedRandomElements: KVContainer | string;
    objectives: PurpleObjective[] | ObjectivesElement;
    generationSeed: number;
    seenParticipantsIDs: string;
    participantsIDs: string;
    unclaimedRewardsIDs: string;
    appliedSpecialRules: boolean;
    rewards: RewardsReward[] | RewardsClass;
    questKey: string;
    questName: string;
    questDescription: string;
    requester: string;
    orderType: string;
    specialRule: string;
    readyForRemoval: boolean;
    itemToRemoveOnEnd: number;
    dueDate: number;
    duration: string;
    questState: string;
}

export interface PurpleObjective {
    currentCount: number;
    maxCount: number;
    description: string;
    failOnCompletion: boolean;
    acceptableContextTagSets: string;
    dropBox?: string;
    dropBoxGameLocation?: string;
    dropBoxTileLocation?: TileLocation;
    minimumCapacity?: number;
    confirmed?: boolean;
}

export interface TileLocation {
    X: number;
    Y: number;
}

export interface ObjectivesElement {
    currentCount: number;
    maxCount: number;
    description: string;
    failOnCompletion: boolean;
    acceptableContextTagSets?: string;
    useShipmentValue?: boolean;
}

export interface RewardsReward {
    amount?: IntContainer | number;
    multiplier?: FloatContainer;
    noLetter?: BoolContainer;
    grantedMails?: StringContainer;
    host?: BoolContainer;
    targetName?: string;
}

export interface IntContainer {
    int: number;
}

export interface BoolContainer {
    boolean: boolean;
}

export interface FloatContainer {
    float: number;
}

export interface RewardsClass {
    amount: IntContainer;
}

export interface KVContainer {
    item: KV<StringContainer, IntContainer>[];
}

export interface BroadcastedMail {
    string: string[];
}

export interface BundleData {
    item: BundleDataItem[];
}

export interface BundleDataItem {
    key: StringContainer;
    value: StringContainer;
}

export interface CellarAssignments {
    item: CellarAssignmentsItem;
}

export interface CellarAssignmentsItem {
    key: IntContainer;
    value: LongContainer;
}

export interface LongContainer {
    long: number;
}

export enum Season {
    Fall = "fall",
    Spring = "spring",
    Summer = "summer",
    Winter = "winter",
}

export interface ItemContainer {
    Item: Item[];
}

export interface BoundingBox extends TileLocation {
    X: number;
    Y: number;
    Width: number;
    Height: number;
    Location: TileLocation;
    Size: TileLocation;
}

export interface Color {
    B: number;
    G: number;
    R: number;
    A: number;
    PackedValue: number;
}

export interface SeparateWalletItems {
    SerializableDictionaryOfInt64Inventory: string;
}

export enum SpecialChestType {
    MiniShippingBin = "MiniShippingBin",
    None = "None",
}

export enum TypeEnum {
    Arch = "Arch",
    Asdf = "asdf",
    Basic = "Basic",
    Cooking = "Cooking",
    Crafting = "Crafting",
    Fish = "Fish",
    Interactive = "interactive",
    Litter = "Litter",
    Minerals = "Minerals",
    Seeds = "Seeds",
}

export interface JunimoKartLeaderboards {
    entries: Entries;
    maxEntries: IntContainer;
}

export interface Entries {
    NetLeaderboardsEntry: NetLeaderboardsEntry[];
}

export interface NetLeaderboardsEntry {
    name: StringContainer;
    score: IntContainer;
}

export interface ItemArray {
    item: KV<StringContainer, IntContainer>[];
}

export interface LocationWeather {
    item: LocationWeatherItem[];
}

export interface LocationWeatherItem {
    key: StringContainer;
    value: PurpleValue;
}

export interface PurpleValue {
    LocationWeather: LocationWeatherClass;
}

export interface LocationWeatherClass {
    weatherForTomorrow: StringContainer;
    weather: StringContainer;
    isRaining: BoolContainer;
    isSnowing: BoolContainer;
    isLightning: BoolContainer;
    isDebrisWeather: BoolContainer;
    isGreenRain: BoolContainer;
    monthlyNonRainyDayCount: IntContainer;
    WeatherForTomorrow: WeatherForTomorrow;
    IsRaining: boolean;
    IsSnowing: boolean;
    IsLightning: boolean;
    IsDebrisWeather: boolean;
    IsGreenRain: boolean;
    Weather?: string;
}

export enum WeatherForTomorrow {
    Bus = "bus",
    Spring = "spring",
    Sun = "Sun",
    Winter = "winter",
    WinterSun = "winter_Sun",
}

export interface Locations {
    GameLocation: GameLocation[];
}

export interface GameLocation {
    buildings: BuildingsClass | undefined;
    animals: AnimalsArray | null;
    piecesOfHay: number;
    characters: NPCContainer | undefined;
    objects: ObjectsObjects | undefined;
    resourceClumps: ResourceClumpsClass | undefined;
    largeTerrainFeatures: LargeTerrainFeaturesClass | undefined;
    terrainFeatures: TerrainFeaturesClass | undefined;
    name: string;
    waterColor: Color;
    isFarm: boolean;
    isOutdoors: boolean;
    isStructure: boolean;
    ignoreDebrisWeather: boolean;
    ignoreOutdoorLighting: boolean;
    ignoreLights: boolean;
    treatAsOutdoors: boolean;
    numberOfSpawnedObjectsOnMap: number;
    miniJukeboxCount: number;
    miniJukeboxTrack: string;
    furniture: FurnitureClass | string;
    Animals: GameLocationAnimals;
    IsGreenhouse: boolean;
    housePaintColor?: HousePaintColor;
    grandpaScore?: number;
    farmCaveReady?: boolean;
    hasSeenGrandpaNote?: boolean;
    greenhouseUnlocked?: boolean;
    greenhouseMoved?: boolean;
    spousePatioSpot?: TileLocation;
    wallPaper?: string;
    appliedWallpaper?: GameLocationAppliedFloor;
    floor?: string;
    appliedFloor?: GameLocationAppliedFloor;
    fridge?: Fridge;
    fridgePosition?: TileLocation;
    cribStyle?: number;
    daysUntilCommunityUpgrade?: number;
    itemsFromPlayerToSell?: string;
    itemsToStartSellingTomorrow?: string;
    bridgeFixed?: boolean;
    stumpFixed?: boolean;
    hasSpawnedBugsToday?: boolean;
    drivingOff?: boolean;
    drivingBack?: boolean;
    leaving?: boolean;
    museumPieces?: MuseumPieces;
    Gil?: Gil;
    talkedToGil?: boolean;
    hasUnlockedStatue?: boolean;
    witchStatueGone?: boolean;
    areasComplete?: BoolArrayContainer;
    numberOfStarsOnPlaque?: number;
    bundles?: Bundles;
    bundleRewards?: ChestConsumedLevels;
    submerged?: boolean;
    ascending?: boolean;
    dayFirstEntered?: number;
    gateRect?: BoundingBox;
    _plankPosition?: number;
    _plankDirection?: number;
    animationState?: string;
    TicketPrice?: number;
    shouldToggleResort?: boolean;
    resortOpenToday?: boolean;
    resortRestored?: boolean;
    westernTurtleMoved?: boolean;
    mermaidPuzzleFinished?: boolean;
    fishedWalnut?: boolean;
    drinksClaimed?: string;
    bananaShrineComplete?: BoolContainer;
    bananaShrineNutAwarded?: BoolContainer;
    sandDuggy?: SandDuggy;
    farmhouseRestored?: boolean;
    farmhouseMailbox?: boolean;
    farmObelisk?: boolean;
    shippingBinPosition?: TileLocation;
    traderActivated?: boolean;
    caveOpened?: boolean;
    treeNutShot?: boolean;
    treeNutObtained?: BoolContainer;
    firstParrotDone?: boolean;
    completed?: boolean;
    piecesDonated?: boolean[];
    centerSkeletonRestored?: boolean;
    snakeRestored?: boolean;
    batRestored?: boolean;
    frogRestored?: boolean;
    plantsRestoredLeft?: boolean;
    plantsRestoredRight?: boolean;
    hasFailedSurveyToday?: BoolContainer;
    visited?: boolean | BoolContainer;
    puzzleFinished?: boolean;
    gourmandRequestsFulfilled?: number;
    raceTrack?: RaceTrack;
    uniqueName?: string;
}

export interface GameLocationAnimals {
    SerializableDictionaryOfInt64FarmAnimal: AnimalsArray | null;
}

export interface Gil {
    name: string;
    forceOneTileWide: boolean;
    isEmoting: boolean;
    isCharging: boolean;
    isGlowing: boolean;
    coloredBorder: boolean;
    flip: boolean;
    drawOnTop: boolean;
    faceTowardFarmer: boolean;
    ignoreMovementAnimation: boolean;
    faceAwayFromFarmer: boolean;
    scale: FloatContainer;
    glowingTransparency: number;
    glowRate: number;
    Gender: Gender;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    lastCrossroad: BoundingBox;
    daysAfterLastBirth: number;
    birthday_Day: number;
    age: number;
    manners: number;
    socialAnxiety: number;
    optimism: number;
    gender: Gender;
    sleptInBed: boolean;
    isInvisible: boolean;
    lastSeenMovieWeek: number;
    datingFarmer: string;
    divorcedFromFarmer: string;
    datable: boolean;
    defaultMap: string;
    id: number;
    daysUntilNotInvisible: number;
    followSchedule: boolean;
    moveTowardPlayerThreshold: number;
    hasBeenKissedToday: BoolContainer;
    shouldPlayRobinHammerAnimation: BoolContainer;
    shouldPlaySpousePatioAnimation: BoolContainer;
    shouldWearIslandAttire: BoolContainer;
    isMovingOnPathFindPath: BoolContainer;
    endOfRouteBehaviorName: StringContainer;
    previousEndPoint: TileLocation;
    squareMovementFacingPreference: number;
    DefaultFacingDirection: number;
    DefaultPosition: TileLocation;
    IsWalkingInSquare: boolean;
    IsWalkingTowardPlayer: boolean;
}

export enum Gender {
    Female = "Female",
    Male = "Male",
    Undefined = "Undefined",
}

export interface GameLocationAppliedFloor {
    SerializableDictionaryOfStringString: SerializableDictionaryOfStringString;
}

export interface SerializableDictionaryOfStringString {
    item: SerializableDictionaryOfStringStringItem[];
}

export interface SerializableDictionaryOfStringStringItem {
    key: StringContainer;
    value: ValueClass;
}

export interface ValueClass {
    string: number;
}

export interface BoolArrayContainer {
    boolean: boolean[];
}

export interface BuildingsClass {
    Building: Building[];
}

export interface Building {
    id: string;
    skinId: StringContainer;
    nonInstancedIndoorsName: StringContainer;
    tileX: number;
    tileY: number;
    tilesWide: number;
    tilesHigh: number;
    maxOccupants: number;
    currentOccupants: number;
    daysOfConstructionLeft: number;
    daysUntilUpgrade: number;
    buildingType: string;
    buildingPaintColor: BuildingPaintColor;
    hayCapacity: number;
    buildingChests: string;
    humanDoor: TileLocation;
    animalDoor: TileLocation;
    animalDoorOpen: boolean;
    animalDoorOpenAmount: number;
    magical: boolean;
    fadeWhenPlayerIsBehind: boolean;
    owner: number;
    isMoving: boolean;
    indoors?: GameLocation;
    watered?: boolean;
    petGuid?: string;
}

export interface BuildingPaintColor {
    ColorName: StringContainer;
    Color1Default: BoolContainer;
    Color1Hue: IntContainer;
    Color1Saturation: IntContainer;
    Color1Lightness: IntContainer;
    Color2Default: BoolContainer;
    Color2Hue: IntContainer;
    Color2Saturation: IntContainer;
    Color2Lightness: IntContainer;
    Color3Default: BoolContainer;
    Color3Hue: IntContainer;
    Color3Saturation: IntContainer;
    Color3Lightness: IntContainer;
}

export interface IndoorsAnimals {
    SerializableDictionaryOfInt64FarmAnimal: AnimalsArray | string;
}

export interface AnimalsArray {
    item: AnimalsKV[];
}

export interface AnimalsKV {
    key: LongContainer;
    value: AnimalValue;
}

export interface AnimalValue {
    FarmAnimal: FarmAnimal;
}

export interface FarmAnimal {
    name: string;
    forceOneTileWide: boolean;
    isEmoting: boolean;
    isCharging: boolean;
    isGlowing: boolean;
    coloredBorder: boolean;
    flip: boolean;
    drawOnTop: boolean;
    faceTowardFarmer: boolean;
    ignoreMovementAnimation: boolean;
    faceAwayFromFarmer: boolean;
    scale: FloatContainer;
    glowingTransparency: number;
    glowRate: number;
    Gender: Gender;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    isSwimming: BoolContainer;
    currentProduce?: number;
    friendshipTowardFarmer: number;
    age: number;
    daysOwned: number;
    health: number;
    produceQuality: number;
    daysSinceLastLay: number;
    happiness: number;
    fullness: number;
    wasAutoPet: boolean;
    wasPet: boolean;
    allowReproduction: boolean;
    type: string;
    buildingTypeILiveIn: string;
    myID: number;
    ownerID: number;
    parentId: number;
    hasEatenAnimalCracker: boolean;
    moodMessage: number;
    isEating: boolean;
    displayName: string;
}

export interface AnimalsThatLiveHere {
    long: number[];
}

export interface IndoorsAppliedFloor {
    SerializableDictionaryOfStringString: PreSelectedItems;
}

export interface PreSelectedItems {
    item: SerializableDictionaryOfStringStringItem;
}

export interface IndoorsObjects {
    item: ObjectsItemClass[];
}

export interface ObjectsItemClass {
    key: TileLocationContainer;
    value: AttachmentsClass;
}

export interface TileLocationContainer {
    Vector2: TileLocation;
}

export interface AttachmentsClass {
    Object: Item;
}

export interface ChestConsumedLevels {
    item: KV<IntContainer, BoolContainer>[];
}

export interface Bundles {
    item: BundlesItem[];
}

export interface BundlesItem {
    key: IntContainer;
    value: BoolArrayContainerContainer;
}

export interface BoolArrayContainerContainer {
    ArrayOfBoolean: BoolArrayContainer;
}

export interface NPCContainer {
    NPC: NPC[];
}
export interface NPC {
    name: string;
    forceOneTileWide: boolean;
    isEmoting: boolean;
    isCharging: boolean;
    isGlowing: boolean;
    coloredBorder: boolean;
    flip: boolean;
    drawOnTop: boolean;
    faceTowardFarmer: boolean;
    ignoreMovementAnimation: boolean;
    faceAwayFromFarmer: boolean;
    scale: FloatContainer;
    glowingTransparency: number;
    glowRate: number;
    Gender: Gender;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    lastCrossroad: BoundingBox;
    daysAfterLastBirth: number;
    birthday_Day: number;
    age: number;
    manners: number;
    socialAnxiety: number;
    optimism: number;
    gender: Gender;
    sleptInBed: boolean;
    isInvisible: boolean;
    lastSeenMovieWeek: number;
    datingFarmer: boolean | string;
    divorcedFromFarmer: boolean | string;
    datable: boolean;
    id: number;
    daysUntilNotInvisible: number;
    followSchedule: boolean;
    moveTowardPlayerThreshold: number;
    hasBeenKissedToday: BoolContainer;
    shouldPlayRobinHammerAnimation: BoolContainer;
    shouldPlaySpousePatioAnimation: BoolContainer;
    shouldWearIslandAttire: BoolContainer;
    isMovingOnPathFindPath: BoolContainer;
    endOfRouteBehaviorName: StringContainer;
    previousEndPoint: TileLocation;
    squareMovementFacingPreference: number;
    DefaultFacingDirection: number;
    DefaultPosition: TileLocation;
    IsWalkingInSquare: boolean;
    IsWalkingTowardPlayer: boolean;
    guid?: string;
    petType?: string;
    whichBreed?: number;
    homeLocationName?: string;
    lastPetDay?: LastPetDay;
    grantedFriendshipForPet?: boolean;
    friendshipTowardFarmer?: number;
    timesPet?: number;
    isSleepingOnFarmerBed?: BoolContainer;
    CurrentBehavior?: string;
    birthday_Season?: Season;
    defaultMap?: string;
    loveInterest?: string;
    dayScheduleName?: WeatherForTomorrow;
}

export interface LastPetDay {
    item: KV<LongContainer, IntContainer>;
}

export interface Fridge {
    isLostItem: boolean;
    category: number;
    hasBeenInInventory: boolean;
    name: string;
    parentSheetIndex: number;
    specialItem: boolean;
    isRecipe: boolean;
    quality: number;
    stack: number;
    SpecialVariable: number;
    tileLocation: TileLocation;
    owner: number;
    type: TypeEnum;
    canBeSetDown: boolean;
    canBeGrabbed: boolean;
    isSpawnedObject: boolean;
    questItem: boolean;
    questId: number;
    isOn: boolean;
    fragility: number;
    price: number;
    edibility: number;
    bigCraftable: boolean;
    setOutdoors: boolean;
    setIndoors: boolean;
    readyForHarvest: boolean;
    showNextIndex: boolean;
    flipped: boolean;
    isLamp: boolean;
    minutesUntilReady: number;
    boundingBox: BoundingBox;
    scale: TileLocation;
    uses: number;
    preservedParentSheetIndex: number;
    destroyOvernight: boolean;
    currentLidFrame: number;
    lidFrameCount: IntContainer;
    frameCounter: number;
    items: FridgeItems;
    separateWalletItems: SeparateWalletItems;
    tint: Color;
    playerChoiceColor: Color;
    playerChest: boolean;
    fridge: boolean;
    giftbox: boolean;
    giftboxIndex: number;
    giftboxIsStarterGift: BoolContainer;
    spriteIndexOverride: number;
    dropContents: boolean;
    synchronized: boolean;
    specialChestType: SpecialChestType;
    globalInventoryId: StringContainer;
}

export interface FridgeItems {
    Item: string[];
}

export interface FurnitureClass {
    Furniture: Item[];
}

export interface HousePaintColor {
    BuildingPaintColor: string;
}

export interface LargeTerrainFeaturesClass {
    LargeTerrainFeature:
        | LargeTerrainFeatureElement[]
        | LargeTerrainFeatureElement;
}

export interface LargeTerrainFeatureElement {
    tilePosition: TileLocation;
    isDestroyedByNPCTrample: boolean;
    size: number;
    datePlanted: number;
    tileSheetOffset: number;
    health: number;
    flipped: boolean;
    townBush: boolean;
    inPot: BoolContainer;
    drawShadow: boolean;
}

export interface MuseumPieces {
    item: MuseumPiecesItem[];
}

export interface MuseumPiecesItem {
    key: TileLocationContainer;
    value: ValueClass;
}

export interface ObjectsObjects {
    item: PurpleItem[];
}

export interface PurpleItem {
    key: TileLocationContainer;
    value: StickyValue;
}

export interface StickyValue {
    Object: ObjectClass;
}

export interface ObjectClass {
    isLostItem: boolean;
    category: number;
    hasBeenInInventory: boolean;
    name: string;
    parentSheetIndex: number;
    itemId: number;
    specialItem: boolean;
    isRecipe: boolean;
    quality: number;
    stack: number;
    SpecialVariable: number;
    tileLocation: TileLocation;
    owner: number;
    type: TypeEnum;
    canBeSetDown: boolean;
    canBeGrabbed: boolean;
    isSpawnedObject: boolean;
    questItem: boolean;
    questId?: number;
    isOn: boolean;
    fragility: number;
    price: number;
    edibility: number;
    bigCraftable: boolean;
    setOutdoors: boolean;
    setIndoors: boolean;
    readyForHarvest: boolean;
    showNextIndex: boolean;
    flipped: boolean;
    isLamp: boolean;
    minutesUntilReady: number;
    boundingBox: BoundingBox;
    scale: TileLocation;
    uses: number;
    destroyOvernight: boolean;
    health?: number;
    maxHealth?: number;
    whichType?: string;
    gatePosition?: number;
    gateMotion?: number;
    isGate?: boolean;
    currentLidFrame?: number;
    lidFrameCount?: IntContainer;
    frameCounter?: number;
    items?: ItemContainer | string;
    separateWalletItems?: SeparateWalletItems;
    tint?: Color;
    playerChoiceColor?: Color;
    playerChest?: boolean;
    fridge?: boolean;
    giftbox?: boolean;
    giftboxIndex?: number;
    giftboxIsStarterGift?: BoolContainer;
    spriteIndexOverride?: number;
    dropContents?: boolean;
    synchronized?: boolean;
    specialChestType?: SpecialChestType;
    globalInventoryId?: StringContainer;
    heldObject?: Item;
    lastOutputRuleId?: string;
    lastInputItem?: Item;
    agingRate?: number;
    daysToMature?: number;
    requiredItem?: Item;
    successColor?: Color;
    lockOnSuccess?: boolean;
    locked?: boolean;
    match?: boolean;
    isIslandShrinePedestal?: boolean;
}

export interface ItemContainer {
    Item: Item[];
}

export interface RaceTrack {
    ArrayOfVector3: ArrayOfVector3[];
}

export interface ArrayOfVector3 {
    Vector3: Vector3[];
}

export interface Vector3 {
    X: number;
    Y: number;
    Z: number;
}

export interface ResourceClumpsClass {
    ResourceClump: ResourceClumpElement[] | ResourceClumpElement;
}

export interface ResourceClumpElement {
    width: number;
    height: number;
    parentSheetIndex: number;
    health: number;
    tile: TileLocation;
}

export interface SandDuggy {
    whacked: boolean;
}

export interface TerrainFeaturesClass {
    item: TerrainFeaturesItem[];
}

export interface TerrainFeaturesItem {
    key: TileLocationContainer;
    value: IndigoValue;
}

export interface IndigoValue {
    TerrainFeature: TerrainFeature;
}

export interface TerrainFeature {
    growthStage?: number;
    treeType?: number;
    health?: number;
    flipped?: boolean;
    stump?: boolean;
    tapped?: boolean;
    hasSeed?: boolean;
    hasMoss?: boolean;
    isTemporaryGreenRainTree?: boolean;
    fertilized?: boolean;
    whichFloor?: number;
    whichView?: number;
    treeId?: number;
    daysUntilMature?: number;
    fruitsOnTree?: string;
    struckByLightningCountdown?: number;
    greenHouseTileTree?: boolean;
    growthRate?: number;
    state?: number;
    fertilizer?: number;
    crop?: Crop;
}

export interface Crop {
    phaseDays: Achievements | string;
    rowInSpriteSheet: number;
    phaseToShow: number;
    currentPhase: number;
    indexOfHarvest?: number;
    dayOfCurrentPhase: number;
    whichForageCrop: number;
    tintColor: Color;
    flip: boolean;
    fullGrown: boolean;
    raisedSeeds: boolean;
    programColored: boolean;
    dead: boolean;
    forageCrop: boolean;
    seedIndex?: number;
}

export interface Achievements {
    int: number[];
}

export interface MinePermanentMineChanges {
    item: MinePermanentMineChangesItem[];
}

export interface MinePermanentMineChangesItem {
    key: IntContainer;
    value: IndecentValue;
}

export interface IndecentValue {
    MineInfo: MineInfo;
}

export interface MineInfo {
    platformContainersLeft: number;
    chestsLeft: number;
    coalCartsLeft: number;
    elevator: number;
}

export interface Options {
    autoRun: boolean;
    dialogueTyping: boolean;
    showPortraits: boolean;
    showMerchantPortraits: boolean;
    showMenuBackground: boolean;
    playFootstepSounds: boolean;
    alwaysShowToolHitLocation: boolean;
    hideToolHitLocationWhenInMotion: boolean;
    pauseWhenOutOfFocus: boolean;
    pinToolbarToggle: boolean;
    mouseControls: boolean;
    gamepadControls: boolean;
    rumble: boolean;
    ambientOnlyToggle: boolean;
    zoomButtons: boolean;
    invertScrollDirection: boolean;
    screenFlash: boolean;
    showPlacementTileForGamepad: boolean;
    snappyMenus: boolean;
    showAdvancedCraftingInformation: boolean;
    showMPEndOfNightReadyStatus: boolean;
    muteAnimalSounds: boolean;
    vsyncEnabled: boolean;
    fullscreen: boolean;
    windowedBorderlessFullscreen: boolean;
    showClearBackgrounds: boolean;
    ipConnectionsEnabled: boolean;
    enableServer: boolean;
    enableFarmhandCreation: boolean;
    stowingMode: string;
    gamepadMode: string;
    useLegacySlingshotFiring: boolean;
    musicVolumeLevel: number;
    soundVolumeLevel: number;
    footstepVolumeLevel: number;
    ambientVolumeLevel: number;
    snowTransparency: number;
    zoomLevel: number;
    localCoopBaseZoomLevel: number;
    uiScale: number;
    localCoopDesiredUIScale: number;
    preferredResolutionX: number;
    preferredResolutionY: number;
    serverPrivacy: string;
    actionButton: Button;
    cancelButton: CancelButton;
    useToolButton: Button;
    moveUpButton: CancelButton;
    moveRightButton: CancelButton;
    moveDownButton: CancelButton;
    moveLeftButton: CancelButton;
    menuButton: Button;
    runButton: CancelButton;
    tmpKeyToReplace: CancelButton;
    chatButton: Button;
    mapButton: CancelButton;
    journalButton: CancelButton;
    inventorySlot1: CancelButton;
    inventorySlot2: CancelButton;
    inventorySlot3: CancelButton;
    inventorySlot4: CancelButton;
    inventorySlot5: CancelButton;
    inventorySlot6: CancelButton;
    inventorySlot7: CancelButton;
    inventorySlot8: CancelButton;
    inventorySlot9: CancelButton;
    inventorySlot10: CancelButton;
    inventorySlot11: CancelButton;
    inventorySlot12: CancelButton;
    toolbarSwap: CancelButton;
    emoteButton: CancelButton;
    hardwareCursor: boolean;
}

export interface Button {
    InputButton: InputButton[];
}

export interface InputButton {
    key: string;
    mouseLeft: boolean;
    mouseRight: boolean;
}

export interface CancelButton {
    InputButton: InputButton;
}

export interface Player {
    name: string;
    forceOneTileWide: boolean;
    isEmoting: boolean;
    isCharging: boolean;
    isGlowing: boolean;
    coloredBorder: boolean;
    flip: boolean;
    drawOnTop: boolean;
    faceTowardFarmer: boolean;
    ignoreMovementAnimation: boolean;
    faceAwayFromFarmer: boolean;
    scale: FloatContainer;
    glowingTransparency: number;
    glowRate: number;
    Gender: Gender;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    questLog: QuestLog;
    professions: Achievements;
    newLevels: string;
    experiencePoints: Achievements;
    items: Inventory;
    dialogueQuestionsAnswered: Achievements;
    cookingRecipes: ItemArray;
    craftingRecipes: ItemArray;
    activeDialogueEvents: KVContainer;
    previousActiveDialogueEvents: string;
    triggerActionsRun: BroadcastedMail;
    eventsSeen: Achievements;
    secretNotesSeen: Achievements;
    songsHeard: BroadcastedMail;
    achievements: Achievements;
    specialItems: Achievements;
    specialBigCraftables: Achievements;
    mailReceived: BroadcastedMail;
    mailForTomorrow: string;
    mailbox: BroadcastedMail;
    locationsVisited: BroadcastedMail;
    timeWentToBed: IntContainer;
    sleptInTemporaryBed: BoolContainer;
    stats: Stats;
    biteChime: number;
    itemsLostLastDeath: ItemContainer;
    movementDirections: string;
    farmName: string;
    favoriteThing: string;
    slotCanHost: boolean;
    userID: string;
    catPerson: string;
    canUnderstandDwarves?: string;
    hasClubCard?: string;
    hasDarkTalisman?: string;
    hasMagicInk?: string;
    hasMagnifyingGlass?: string;
    hasRustyKey?: string;
    hasSkullKey?: string;
    hasSpecialCharm?: string;
    HasTownKey?: string;
    hasUnlockedSkullDoor?: string;
    daysMarried: string;
    whichPetType: string;
    whichPetBreed: number;
    acceptedDailyQuest: boolean;
    mostRecentBed: TileLocation;
    shirt: number;
    hair: number;
    skin: number;
    shoes: number;
    accessory: number;
    facialHair: number;
    pants: number;
    hairstyleColor: Color;
    pantsColor: Color;
    newEyeColor: Color;
    hat?: Item;
    boots?: Item;
    leftRing?: Item;
    rightRing?: Item;
    shirtItem?: Item;
    pantsItem?: Item;
    divorceTonight: boolean;
    changeWalletTypeTonight: boolean;
    gameVersion: string;
    bibberstyke: number;
    usingRandomizedBobber: boolean;
    caveChoice: number;
    farmingLevel: number;
    miningLevel: number;
    combatLevel: number;
    foragingLevel: number;
    fishingLevel: number;
    luckLevel: number;
    maxStamina: number;
    maxItems: number;
    lastSeenMovieWeek: number;
    clubCoins: number;
    trashCanLevel: number;
    daysLeftForToolUpgrade: number;
    houseUpgradeLevel: number;
    daysUntilHouseUpgrade: number;
    showChestColorPicker: boolean;
    hasWateringCanEnchantment: boolean;
    temporaryInvincibilityTimer: number;
    currentTemporaryInvincibilityDuration: number;
    health: number;
    maxHealth: number;
    difficultyModifier: number;
    gender: Gender;
    basicShipped: BasicShipped;
    mineralsFound: BasicShipped;
    recipesCooked: BasicShipped;
    fishCaught: FishCaught;
    archaeologyFound: ArchaeologyFound;
    callsReceived: string;
    giftedItems: GiftedItems;
    tailoredItems: string;
    friendshipData: FriendshipData;
    dayOfMonthForSaveGame: number;
    seasonForSaveGame: number;
    yearForSaveGame: number;
    qiGems: number;
    chestConsumedLevels: ChestConsumedLevels;
    saveTime: number;
    isCustomized: boolean;
    homeLocation: string;
    lastSleepLocation: string;
    lastSleepPoint: TileLocation;
    disconnectDay: number;
    disconnectPosition: TileLocation;
    movementMultiplier: number;
    deepestMineLevel: number;
    stamina: number;
    totalMoneyEarned: number;
    millisecondsPlayed: number;
    useSeparateWallets: boolean;
    theaterBuildDate: number;
    timesReachedMineBottom: number;
    spouse: string;
    UniqueMultiplayerID: number;
    money: number;
}

export interface ArchaeologyFound {
    item: ArchaeologyFoundItem[];
}

export interface ArchaeologyFoundItem {
    key: ValueClass;
    value: HilariousValue;
}

export interface HilariousValue {
    ArrayOfInt: Achievements;
}

export interface BasicShipped {
    item: BasicShippedItem[];
}

export interface BasicShippedItem {
    key: ValueClass;
    value: IntContainer;
}

export interface FishCaught {
    item: FishCaughtItem[];
}

export interface FishCaughtItem {
    key: StringContainer;
    value: HilariousValue;
}

export interface FriendshipData {
    item: FriendshipDataItem[];
}

export interface FriendshipDataItem {
    key: StringContainer;
    value: AmbitiousValue;
}

export interface AmbitiousValue {
    Friendship: Friendship;
}

export interface Friendship {
    Points: number;
    GiftsThisWeek: number;
    GiftsToday: number;
    LastGiftDate?: LastGiftDateClass;
    TalkedToToday: boolean;
    ProposalRejected: boolean;
    Status: Status;
    Proposer: number;
    RoommateMarriage: boolean;
    WeddingDate?: LastGiftDateClass;
}

export interface LastGiftDateClass {
    Year: number;
    DayOfMonth: number;
    Season: Season;
}

export enum Status {
    Dating = "Dating",
    Friendly = "Friendly",
    Married = "Married",
}

export interface GiftedItems {
    item: GiftedItemsItem[];
}

export interface GiftedItemsItem {
    key: StringContainer;
    value: CunningValue;
}

export interface CunningValue {
    dictionary: Dictionary;
}

export interface Dictionary {
    item: BasicShippedItem[] | BasicShippedItem;
}

export interface Inventory {
    Item: (undefined | Item)[];
}

export interface Item {
    isLostItem: boolean;
    category?: number;
    hasBeenInInventory: boolean;
    name: string;
    itemId: string | number;
    specialItem: boolean;
    isRecipe: boolean;
    quality: number;
    stack: number;
    price: number;
    SpecialVariable: number;
    initialParentTileIndex?: number;
    currentParentTileIndex?: number;
    indexOfMenuItemView?: number;
    instantUse?: boolean;
    isEfficient?: boolean;
    animationSpeedModifier?: number;
    swingTicker?: number;
    upgradeLevel?: number;
    numAttachmentSlots?: number;
    attachments?: AttachmentsAttachments | string;
    InitialParentTileIndex?: number;
    IndexOfMenuItemView?: number;
    InstantUse?: boolean;
    IsEfficient?: boolean;
    AnimationSpeedModifier?: number;
    type?: TypeEnum | number;
    minDamage?: number;
    maxDamage?: number;
    speed?: number;
    addedPrecision?: number;
    addedDefense?: number;
    addedAreaOfEffect?: number;
    knockback?: number;
    critChance?: number;
    critMultiplier?: number;
    isOnSpecial?: boolean;
    additionalPower?: IntContainer;
    isBottomless?: boolean;
    WaterLeft?: number;
    IsBottomless?: boolean;
    parentSheetIndex?: number;
    tileLocation?: TileLocation;
    owner?: number;
    canBeSetDown?: boolean;
    canBeGrabbed?: boolean;
    isSpawnedObject?: boolean;
    questItem?: boolean;
    questId?: number;
    isOn?: boolean;
    fragility?: number;
    edibility?: number;
    bigCraftable?: boolean;
    setOutdoors?: boolean;
    setIndoors?: boolean;
    readyForHarvest?: boolean;
    showNextIndex?: boolean;
    flipped?: boolean;
    isLamp?: boolean;
    minutesUntilReady?: number;
    boundingBox?: BoundingBox;
    scale?: TileLocation;
    uses?: number;
    destroyOvernight?: boolean;
    CastDirection?: number;
    indexInTileSheet?: number;
    indexInTileSheetFemale?: number;
    clothesType?: ClothesType;
    dyeable?: boolean;
    clothesColor?: Color;
    isPrismatic?: boolean;
    uniqueID?: number;
    currentLidFrame?: number;
    lidFrameCount?: IntContainer;
    frameCounter?: number;
    items?: ItemContainer;
    separateWalletItems?: SeparateWalletItems;
    tint?: Color;
    playerChoiceColor?: Color;
    playerChest?: boolean;
    fridge?: boolean;
    giftbox?: boolean;
    giftboxIndex?: number;
    giftboxIsStarterGift?: BoolContainer;
    spriteIndexOverride?: number;
    dropContents?: boolean;
    synchronized?: boolean;
    specialChestType?: SpecialChestType;
    globalInventoryId?: StringContainer;
    preserve?: string;
    preservedParentSheetIndex?: number;
    color?: Color;
    colorSameIndexAsParentSheetIndex?: boolean;
    defenseBonus?: number;
    immunityBonus?: number;
    indexInColorSheet?: number;
    which?: null;
    furniture_type?: FurnitureType;
    rotations?: number;
    currentRotation?: number;
    sourceRect?: BoundingBox;
    defaultSourceRect?: BoundingBox;
    defaultBoundingBox?: BoundingBox;
    drawHeldObjectLow?: boolean;
    heldObject?: Item;
    lastOutputRuleId?: string;
    lastInputItem?: Item;
    bedType?: string;
    signText?: string;
    skipHairDraw?: boolean;
    ignoreHairstyleOffset?: boolean;
    hairDrawType?: number;
}

export interface AttachmentsAttachments {
    Object: Array<Item | string>;
}

export enum ClothesType {
    Shirt = "SHIRT",
    Pants = "PANTS",
}

export interface QuestLog {
    Quest: Quest[];
}

export interface Quest {
    _currentObjective: string;
    _questDescription: string;
    _questTitle: string;
    rewardDescription: number;
    accepted: boolean;
    completed: boolean;
    dailyQuest: boolean;
    showNew: boolean;
    canBeCancelled: boolean;
    destroy: boolean;
    id: number;
    moneyReward: number;
    questType: number;
    daysLeft: number;
    dayQuestAccepted: number;
    nextQuests: IntContainer;
    questTitle: string;
    targetMessage: string;
    target: string;
    item: string;
    number: number;
    parts: string;
    dialogueparts: string;
}

export interface Stats {
    specificMonstersKilled: ItemArray;
    Values: Values;
    averageBedtime: string;
    beveragesMade: string;
    caveCarrotsFound: string;
    cheeseMade: string;
    chickenEggsLayed: string;
    copperFound: string;
    cowMilkProduced: string;
    cropsShipped: string;
    daysPlayed: string;
    diamondsFound: string;
    dirtHoed: string;
    duckEggsLayed: string;
    fishCaught: string;
    geodesCracked: string;
    giftsGiven: string;
    goatCheeseMade: string;
    goatMilkProduced: string;
    goldFound: string;
    goodFriends: string;
    individualMoneyEarned: string;
    iridiumFound: string;
    ironFound: string;
    itemsCooked: string;
    itemsCrafted: string;
    itemsForaged: string;
    itemsShipped: string;
    monstersKilled: string;
    mysticStonesCrushed: string;
    notesFound: string;
    otherPreciousGemsFound: string;
    piecesOfTrashRecycled: string;
    preservesMade: string;
    prismaticShardsFound: string;
    questsCompleted: string;
    rabbitWoolProduced: string;
    rocksCrushed: string;
    sheepWoolProduced: string;
    slimesKilled: string;
    stepsTaken: string;
    stoneGathered: string;
    stumpsChopped: string;
    timesFished: string;
    timesUnconscious: string;
    totalMoneyGifted: string;
    trufflesFound: string;
    weedsEliminated: string;
    seedsSown: string;
}

export interface Values {
    item: ValuesItem[];
}

export interface ValuesItem {
    key: StringContainer;
    value: MagentaValue;
}

export interface MagentaValue {
    unsignedInt: number;
}

export interface SpecialOrders {
    SpecialOrder: SpecialOrdersSpecialOrder[];
}

export interface SpecialOrdersSpecialOrder {
    preSelectedItems: PreSelectedItems | string;
    selectedRandomElements: KVContainer;
    objectives: ObjectivesElement[] | ObjectivesElement;
    generationSeed: number;
    seenParticipantsIDs: ParticipantsIDs;
    participantsIDs: ParticipantsIDs;
    unclaimedRewardsIDs: string;
    appliedSpecialRules: boolean;
    rewards: SpecialOrderReward[];
    questKey: string;
    questName: string;
    questDescription: string;
    requester: string;
    orderType: string;
    specialRule: string;
    readyForRemoval: boolean;
    dueDate: number;
    duration: string;
    questState: string;
}

export interface ParticipantsIDs {
    item: ParticipantsIDsItem;
}

export interface ParticipantsIDsItem {
    key: LongContainer;
    value: BoolContainer;
}

export interface SpecialOrderReward {
    amount?: IntContainer;
    multiplier?: FloatContainer;
    noLetter?: BoolContainer;
    grantedMails?: StringContainer;
    host?: BoolContainer;
}
