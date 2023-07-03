export interface Save {
    player: Player;
    locations: Locations;
    currentSeason: Season;
    samBandName?: string;
    elliottBookName?: string;
    broadcastedMail: BroadcastedMail;
    worldStateIDs: string;
    lostBooksFound?: number;
    goldenWalnuts?: number;
    goldenWalnutsFound?: number;
    miniShippingBinsObtained?: number;
    mineShrineActivated?: boolean;
    goldenCoconutCracked?: boolean;
    parrotPlatformsUnlocked?: boolean;
    farmPerfect?: boolean;
    foundBuriedNuts?: string;
    visitsUntilY1Guarantee: number;
    shuffleMineChests: string;
    dayOfMonth: number;
    year: number;
    farmerWallpaper: number;
    FarmerFloor: number;
    currentWallpaper: number;
    currentFloor: number;
    currentSongIndex: number;
    countdownToWedding: string;
    incubatingEgg: TileLocation;
    chanceToRainTomorrow: number;
    dailyLuck: number;
    uniqueIDForThisGame: number;
    weddingToday: boolean;
    isRaining: boolean;
    isDebrisWeather: boolean;
    shippingTax: boolean;
    isLightning: boolean;
    isSnowing: boolean;
    shouldSpawnMonsters: boolean;
    hasApplied1_3_UpdateChanges: boolean;
    hasApplied1_4_UpdateChanges: boolean;
    musicVolume: number;
    soundVolume: number;
    cropsOfTheWeek: CropsOfTheWeek;
    Item: Item;
    highestPlayerLimit: number;
    moveBuildingPermissionMode: number;
    locationWeather: LocationWeather;
    bannedUsers: string;
    bundleData: BundleData;
    limitedNutDrops: string;
    latestID: number;
    options: Options;
    splitscreenOptions: string;
    CustomData: string;
    mine_permanentMineChanges: MinePermanentMineChanges;
    mine_lowestLevelReached: number;
    minecartHighScore: number;
    weatherForTomorrow: number;
    whichFarm: number;
    mine_lowestLevelReachedForOrder: number;
    skullCavesDifficulty: number;
    minesDifficulty: number;
    currentGemBirdIndex: number;
    junimoKartLeaderboards: JunimoKartLeaderboards;
    specialOrders: SpecialOrders;
    availableSpecialOrders: AvailableSpecialOrders;
    completedSpecialOrders: BroadcastedMail;
    acceptedSpecialOrderTypes: String;
    returnedDonations: string;
    junimoChest: string;
    collectedNutTracker: string;
    farmerFriendships: string;
    cellarAssignments: CellarAssignments;
    lastAppliedSaveFix: number;
    gameVersion: '1.5.6';
    gameVersionLabel: string;
}

export interface String {
    string: string;
}

export interface AvailableSpecialOrders {
    SpecialOrder: SpecialOrderElement[];
}

export interface SpecialOrderElement {
    preSelectedItems: string;
    selectedRandomElements: string;
    objectives: ObjectivesObjective[] | ObjectivesClass;
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
    mailToRemoveOnEnd?: string;
}

export interface ObjectivesObjective {
    currentCount: number;
    maxCount: number;
    description: string;
    failOnCompletion: boolean;
    acceptableContextTagSets?: string;
    dropBox?: string;
    dropBoxGameLocation?: string;
    dropBoxTileLocation?: TileLocation;
    minimumCapacity?: number;
    confirmed?: boolean;
    targetNames?: string;
    targetName?: string;
    message?: string;
}

export interface TileLocation {
    X: number;
    Y: number;
}

export interface ObjectivesClass {
    currentCount: number;
    maxCount: number;
    description: string;
    failOnCompletion: boolean;
    skullCave: SleptInTemporaryBed;
}

export interface SleptInTemporaryBed {
    boolean: boolean;
}

export interface RewardsReward {
    amount?: Number | number;
    multiplier?: Scale;
    noLetter?: SleptInTemporaryBed;
    grantedMails?: String;
    host?: SleptInTemporaryBed;
    targetName?: string;
}

export interface Number {
    int: number;
}

export interface Scale {
    float: number;
}

export interface RewardsClass {
    amount: Number;
}

export interface BroadcastedMail {
    string: string[];
}

export interface BundleData {
    item: BundleDataItem[];
}

export interface BundleDataItem {
    key: String;
    value: String;
}

export interface CellarAssignments {
    item: CellarAssignmentsItem;
}

export interface CellarAssignmentsItem {
    key: Number;
    value: OwnerUIDClass;
}

export interface OwnerUIDClass {
    long: number;
}

export interface CropsOfTheWeek {
    int: number[];
}

export type Season = "fall" | "winter" | "summer" | "spring";

export interface BoundingBox {
    X: number;
    Y: number;
    Width: number;
    Height: number;
    Location: TileLocation;
}

export type TypeEnum = "Cooking" | "Crafting" | "Basic" | "Minerals" | "asdf" | "Fish" | "Arch" | "Seeds" | "Ring" | "Quest";

export interface JunimoKartLeaderboards {
    entries: string;
    maxEntries: Number;
}

export interface LocationWeather {
    item: LocationWeatherItem[];
}

export interface LocationWeatherItem {
    key: PurpleKey;
    value: PurpleValue;
}

export interface PurpleKey {
    LocationContext: string;
}

export interface PurpleValue {
    LocationWeather: LocationWeatherClass;
}

export interface LocationWeatherClass {
    weatherForTomorrow: Number;
    isRaining: SleptInTemporaryBed;
    isSnowing: SleptInTemporaryBed;
    isLightning: SleptInTemporaryBed;
    isDebrisWeather: SleptInTemporaryBed;
}

export interface Locations {
    GameLocation: GameLocation[];
}

export interface GameLocation {
    characters: CharactersClass | string;
    objects: ObjectsObjects | string;
    resourceClumps: Umps | string;
    largeTerrainFeatures: LargeTerrainFeaturesClass | string;
    terrainFeatures: TerrainFeaturesClass | string;
    name: string;
    waterColor: HairstyleColor;
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
    IsGreenhouse: boolean;
    buildings?: Buildings;
    frameHouseColor?: string;
    housePaintColor?: HousePaintColor;
    animals?: string;
    piecesOfHay?: number;
    grandpaScore?: number;
    farmCaveReady?: boolean;
    hasSeenGrandpaNote?: boolean;
    houseSource?: BoundingBox;
    greenhouseUnlocked?: boolean;
    greenhouseMoved?: boolean;
    petBowlWatered?: SleptInTemporaryBed;
    spousePatioSpot?: TileLocation;
    Animals?: GameLocationAnimals;
    wallPaper?: string;
    appliedWallpaper?: GameLocationAppliedFloor;
    floor?: string;
    appliedFloor?: GameLocationAppliedFloor;
    farmerNumberOfOwner?: number;
    fireplaceOn?: boolean;
    fridge?: Fridge;
    fridgePosition?: TileLocation;
    cribStyle?: number;
    daysUntilCommunityUpgrade?: number;
    itemsFromPlayerToSell?: string;
    itemsToStartSellingTomorrow?: string;
    bridgeFixed?: boolean;
    drivingOff?: boolean;
    drivingBack?: boolean;
    leaving?: boolean;
    hasSpawnedBugsToday?: boolean;
    museumPieces?: MuseumPieces;
    stumps?: Umps;
    hasUnlockedStatue?: boolean;
    witchStatueGone?: boolean;
    areasComplete?: AreasComplete;
    numberOfStarsOnPlaque?: number;
    bundles?: Bundles;
    bundleRewards?: ChestConsumedLevels;
    ownerUID?: OwnerUIDClass;
    submerged?: boolean;
    ascending?: boolean;
    dayFirstEntered?: number;
    nextRepathTime?: number;
    repathTimeInterval?: number;
    gateRect?: BoundingBox;
    _plankPosition?: number;
    _plankDirection?: number;
    animationState?: string;
    shouldToggleResort?: boolean;
    resortOpenToday?: boolean;
    resortRestored?: boolean;
    westernTurtleMoved?: boolean;
    mermaidPuzzleFinished?: boolean;
    fishedWalnut?: boolean;
    drinksClaimed?: string;
    bananaShrineComplete?: SleptInTemporaryBed;
    bananaShrineNutAwarded?: SleptInTemporaryBed;
    sandDuggy?: SandDuggy;
    farmhouseRestored?: boolean;
    farmhouseMailbox?: boolean;
    farmObelisk?: boolean;
    shippingBinPosition?: TileLocation;
    traderActivated?: boolean;
    boulderRemoved?: boolean;
    caveOpened?: boolean;
    treeNutShot?: boolean;
    treeNutObtained?: SleptInTemporaryBed;
    firstParrotDone?: boolean;
    completed?: boolean;
    piecesDonated?: boolean[];
    centerSkeletonRestored?: boolean;
    snakeRestored?: boolean;
    batRestored?: boolean;
    frogRestored?: boolean;
    plantsRestoredLeft?: boolean;
    plantsRestoredRight?: boolean;
    hasFailedSurveyToday?: SleptInTemporaryBed;
    visited?: boolean | SleptInTemporaryBed;
    puzzleFinished?: boolean;
    gourmandRequestsFulfilled?: number;
}

export interface GameLocationAnimals {
    SerializableDictionaryOfInt64FarmAnimal: string;
}

export interface GameLocationAppliedFloor {
    SerializableDictionaryOfStringString: SerializableDictionaryOfStringString;
}

export interface SerializableDictionaryOfStringString {
    item: SerializableDictionaryOfStringStringItem[];
}

export interface SerializableDictionaryOfStringStringItem {
    key: String;
    value: FluffyValue;
}

export interface FluffyValue {
    string: number;
}

export interface AreasComplete {
    boolean: boolean[];
}

export interface Buildings {
    Building: Building[];
}

export interface Building {
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
    humanDoor: TileLocation;
    animalDoor: TileLocation;
    color: HairstyleColor;
    animalDoorOpen: boolean;
    magical: boolean;
    fadeWhenPlayerIsBehind: boolean;
    owner: number;
    isMoving: boolean;
    indoors?: Indoors;
    fridge?: Fridge;
}

export interface BuildingPaintColor {
    ColorName: String;
    Color1Default: SleptInTemporaryBed;
    Color1Hue: Number;
    Color1Saturation: Number;
    Color1Lightness: Number;
    Color2Default: SleptInTemporaryBed;
    Color2Hue: Number;
    Color2Saturation: Number;
    Color2Lightness: Number;
    Color3Default: SleptInTemporaryBed;
    Color3Hue: Number;
    Color3Saturation: Number;
    Color3Lightness: Number;
}

export interface HairstyleColor {
    B: number;
    G: number;
    R: number;
    A: number;
    PackedValue: number;
}

export interface Indoors {
    characters: string;
    objects: IndoorsObjects;
    resourceClumps: string;
    largeTerrainFeatures: string;
    terrainFeatures: string;
    uniqueName: string;
    name: string;
    waterColor: HairstyleColor;
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
    furniture: string;
    IsGreenhouse: boolean;
    animals?: Animals;
    animalLimit?: number;
    animalsThatLiveHere?: AnimalsThatLiveHere;
    incubatingEgg?: TileLocation;
    Animals?: IndoorsAnimals;
    wallPaper?: string;
    appliedWallpaper?: IndoorsAppliedFloor;
    floor?: string;
    appliedFloor?: IndoorsAppliedFloor;
    upgradeLevel?: Number;
    farmhand?: Player;
}

export interface IndoorsAnimals {
    SerializableDictionaryOfInt64FarmAnimal: Animals;
}

export interface Animals {
    item: AnimalsItem[];
}

export interface AnimalsItem {
    key: OwnerUIDClass;
    value: TentacledValue;
}

export interface TentacledValue {
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
    scale: Scale;
    timeBeforeAIMovementAgain: number;
    glowingTransparency: number;
    glowRate: number;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    isSwimming: SleptInTemporaryBed;
    defaultProduceIndex: number;
    deluxeProduceIndex: number;
    currentProduce: number;
    friendshipTowardFarmer: number;
    daysSinceLastFed: number;
    pushAccumulator: number;
    uniqueFrameAccumulator: number;
    age: number;
    daysOwned: number;
    meatIndex: number;
    health: number;
    price: number;
    produceQuality: number;
    daysToLay: number;
    daysSinceLastLay: number;
    ageWhenMature: number;
    harvestType: number;
    happiness: number;
    fullness: number;
    happinessDrain: number;
    fullnessDrain: number;
    wasAutoPet: boolean;
    wasPet: boolean;
    showDifferentTextureWhenReadyForHarvest: boolean;
    allowReproduction: boolean;
    sound: string;
    type: string;
    buildingTypeILiveIn: string;
    toolUsedForHarvest: string;
    frontBackBoundingBox: BoundingBox;
    sidewaysBoundingBox: BoundingBox;
    frontBackSourceRect: BoundingBox;
    sidewaysSourceRect: BoundingBox;
    myID: number;
    ownerID: number;
    parentId: number;
    homeLocation: TileLocation;
    moodMessage: number;
    isEating: boolean;
    displayName: string;
}

export interface AnimalsThatLiveHere {
    long: number[];
}

export interface IndoorsAppliedFloor {
    SerializableDictionaryOfStringString: string;
}

export interface IndoorsObjects {
    item: ObjectsItemClass[];
}

export interface ObjectsItemClass {
    key: FluffyKey;
    value: StickyValue;
}

export interface FluffyKey {
    Vector2: TileLocation;
}

export interface StickyValue {
    Object: Item;
}

export interface ChestConsumedLevels {
    item: ChestConsumedLevelsItem[];
}

export interface ChestConsumedLevelsItem {
    key: Number;
    value: SleptInTemporaryBed;
}

export interface Bundles {
    item: BundlesItem[];
}

export interface BundlesItem {
    key: Number;
    value: IndigoValue;
}

export interface IndigoValue {
    ArrayOfBoolean: AreasComplete;
}

export interface CharactersClass {
    NPC: NPCElement[] | NPCElement;
}

export interface NPCElement {
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
    scale: Scale;
    timeBeforeAIMovementAgain: number;
    glowingTransparency: number;
    glowRate: number;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    lastCrossroad: BoundingBox;
    daysAfterLastBirth: number;
    birthday_Season?: Season;
    birthday_Day: number;
    age: number;
    manners: number;
    socialAnxiety: number;
    optimism: number;
    gender: number;
    sleptInBed: boolean;
    isInvisible: boolean;
    lastSeenMovieWeek: number;
    datingFarmer: boolean;
    divorcedFromFarmer: boolean;
    datable: boolean;
    defaultMap?: string;
    loveInterest?: string;
    id: number;
    homeRegion: number;
    daysUntilNotInvisible: number;
    followSchedule: boolean;
    moveTowardPlayerThreshold: number;
    hasBeenKissedToday: SleptInTemporaryBed;
    shouldPlayRobinHammerAnimation: SleptInTemporaryBed;
    shouldPlaySpousePatioAnimation: SleptInTemporaryBed;
    shouldWearIslandAttire: SleptInTemporaryBed;
    isMovingOnPathFindPath: SleptInTemporaryBed;
    queuedSchedulePaths: string;
    lastAttemptedSchedule: number;
    dayScheduleName?: string;
    endOfRouteBehaviorName: String;
    squareMovementFacingPreference: number;
    DefaultFacingDirection: number;
    DefaultMap?: string;
    DefaultPosition: TileLocation;
    IsWalkingInSquare: boolean;
    IsWalkingTowardPlayer: boolean;
    whichBreed?: number;
    lastPetDay?: string;
    grantedFriendshipForPet?: boolean;
    friendshipTowardFarmer?: number;
    isSleepingOnFarmerBed?: SleptInTemporaryBed;
    CurrentBehavior?: number;
}

export interface Fridge extends Item {
    currentLidFrame: number;
    lidFrameCount: Number;
    frameCounter: number;
    coins: number;
    items: FridgeItems;
    separateWalletItems: SeparateWalletItems;
    chestType: string;
    tint: HairstyleColor;
    playerChoiceColor: HairstyleColor;
    playerChest: boolean;
    fridge: boolean;
    giftbox: boolean;
    giftboxIndex: number;
    spriteIndexOverride: number;
    dropContents: boolean;
    synchronized: boolean;
    specialChestType: string;
}

export interface FridgeItems {
    Item: string[];
}

export interface SeparateWalletItems {
    SerializableDictionaryOfInt64NetObjectListOfItem: string;
}

export interface FurnitureClass {
    Furniture: Item[];
}

export interface HousePaintColor {
    BuildingPaintColor: BuildingPaintColor;
}

export interface LargeTerrainFeaturesClass {
    LargeTerrainFeature: LargeTerrainFeatureElement[] | LargeTerrainFeatureElement;
}

export interface LargeTerrainFeatureElement {
    tilePosition: TileLocation;
    size: number;
    datePlanted: number;
    tileSheetOffset: number;
    overrideSeason: number;
    health: number;
    flipped: boolean;
    townBush: boolean;
    greenhouseBush: boolean;
    drawShadow: boolean;
}

export interface MuseumPieces {
    item: MuseumPiecesItem[];
}

export interface MuseumPiecesItem {
    key: FluffyKey;
    value: Number;
}

export interface ObjectsObjects {
    item: PurpleItem[] | ObjectsItemClass;
}

export interface PurpleItem {
    key: FluffyKey;
    value: IndecentValue;
}

export interface IndecentValue {
    Object: ObjectClass;
}

export interface ObjectClass {
    isLostItem: boolean;
    category: Category;
    hasBeenInInventory: boolean;
    name: string;
    parentSheetIndex: number;
    specialItem: boolean;
    SpecialVariable: number;
    DisplayName: string;
    Name: string;
    Stack: number;
    tileLocation: TileLocation;
    owner: number;
    type?: TypeEnum;
    canBeSetDown: boolean;
    canBeGrabbed: boolean;
    isHoedirt: boolean;
    isSpawnedObject: boolean;
    questItem: boolean;
    questId: number;
    isOn: boolean;
    fragility: number;
    price: number;
    edibility: number;
    stack: number;
    quality: number;
    bigCraftable: boolean;
    setOutdoors: boolean;
    setIndoors: boolean;
    readyForHarvest: boolean;
    showNextIndex: boolean;
    flipped: boolean;
    hasBeenPickedUpByFarmer: boolean;
    isRecipe: boolean;
    isLamp: boolean;
    minutesUntilReady: number;
    boundingBox: BoundingBox;
    scale: TileLocation;
    uses: number;
    preservedParentSheetIndex: number;
    destroyOvernight: boolean;
    heldObject?: Item;
    health?: number;
    maxHealth?: number;
    whichType?: number;
    gatePosition?: number;
    gateMotion?: number;
    isGate?: boolean;
    currentLidFrame?: number;
    lidFrameCount?: Number;
    frameCounter?: number;
    coins?: number;
    items?: ObjectItems;
    separateWalletItems?: SeparateWalletItems;
    chestType?: string;
    tint?: HairstyleColor;
    playerChoiceColor?: HairstyleColor;
    playerChest?: boolean;
    fridge?: boolean;
    giftbox?: boolean;
    giftboxIndex?: number;
    spriteIndexOverride?: number;
    dropContents?: boolean;
    synchronized?: boolean;
    specialChestType?: string;
    agingRate?: number;
    daysToMature?: number;
    pedestalType?: number;
    requiredItem?: Item;
    successColor?: HairstyleColor;
    lockOnSuccess?: boolean;
    locked?: boolean;
    match?: boolean;
}

export interface ObjectItems {
    Item: Item[];
}

export interface Umps {
    ResourceClump: ResourceClump[];
}

export interface ResourceClump {
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
    key: FluffyKey;
    value: HilariousValue;
}

export interface HilariousValue {
    TerrainFeature: TerrainFeature;
}

export interface TerrainFeature {
    texture?: string;
    growthStage?: number;
    treeType?: number;
    health?: number;
    flipped?: boolean;
    stump?: boolean;
    tapped?: boolean;
    hasSeed?: boolean;
    fertilized?: boolean;
    shakeLeft?: boolean;
    treeTopSourceRect?: BoundingBox;
    whichFloor?: number;
    whichView?: number;
    isPathway?: boolean;
    isSteppingStone?: boolean;
    drawContouredShadow?: boolean;
    cornerDecoratedBorders?: boolean;
    state?: number;
    fertilizer?: number;
    isGreenhouseDirt?: boolean;
    crop?: Crop;
    indexOfFruit?: number;
    daysUntilMature?: number;
    fruitsOnTree?: number;
    struckByLightningCountdown?: number;
    greenHouseTree?: boolean;
    greenHouseTileTree?: boolean;
    fruitSeason?: Season;
}

export interface Crop {
    phaseDays: CropsOfTheWeek | string;
    rowInSpriteSheet: number;
    phaseToShow: number;
    currentPhase: number;
    harvestMethod: number;
    indexOfHarvest: number;
    regrowAfterHarvest: number;
    dayOfCurrentPhase: number;
    minHarvest: number;
    maxHarvest: number;
    maxHarvestIncreasePerFarmingLevel: number;
    daysOfUnclutteredGrowth: number;
    whichForageCrop: number;
    seasonsToGrowIn: String | string;
    tintColor: HairstyleColor;
    flip: boolean;
    fullGrown: boolean;
    raisedSeeds: boolean;
    programColored: boolean;
    dead: boolean;
    forageCrop: boolean;
    chanceForExtraCrops: number;
    seedIndex: number;
}

export interface MinePermanentMineChanges {
    item: MinePermanentMineChangesItem[];
}

export interface MinePermanentMineChangesItem {
    key: Number;
    value: AmbitiousValue;
}

export interface AmbitiousValue {
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
    keyboardControls: boolean;
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
    lightingQuality: number;
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
    scale: Scale;
    timeBeforeAIMovementAgain: number;
    glowingTransparency: number;
    glowRate: number;
    willDestroyObjectsUnderfoot: boolean;
    Position: TileLocation;
    Speed: number;
    FacingDirection: number;
    IsEmoting: boolean;
    CurrentEmote: number;
    Scale: number;
    questLog: QuestLog;
    professions: CropsOfTheWeek;
    newLevels: string;
    experiencePoints: CropsOfTheWeek;
    items: PlayerItems;
    dialogueQuestionsAnswered: CropsOfTheWeek;
    furnitureOwned: string;
    cookingRecipes?: Recipes;
    craftingRecipes?: Recipes;
    activeDialogueEvents: ActiveDialogueEvents;
    eventsSeen: CropsOfTheWeek;
    secretNotesSeen: string;
    songsHeard: BroadcastedMail;
    achievements: CropsOfTheWeek;
    specialItems: CropsOfTheWeek;
    specialBigCraftables: CropsOfTheWeek;
    mailReceived: BroadcastedMail;
    mailForTomorrow: string;
    mailbox: String;
    timeWentToBed: Number;
    sleptInTemporaryBed: SleptInTemporaryBed;
    stats: Stats;
    blueprints: string;
    biteChime: number;
    itemsLostLastDeath: string;
    movementDirections: string;
    farmName: string;
    favoriteThing: string;
    slotCanHost: boolean;
    userID: string;
    catPerson: boolean;
    whichPetBreed: number;
    acceptedDailyQuest: boolean;
    mostRecentBed: TileLocation;
    performedEmotes: string;
    shirt: -1;
    hair: number;
    skin: number;
    shoes: number;
    accessory: number;
    facialHair: number;
    pants: -1;
    hairstyleColor: HairstyleColor;
    pantsColor: HairstyleColor;
    newEyeColor: HairstyleColor;
    boots?: Item;
    hat?: Item;
    leftRing?: Item;
    rightRing?: Item;
    shirtItem?: Item;
    pantsItem?: Item;
    divorceTonight: boolean;
    changeWalletTypeTonight: boolean;
    woodPieces: number;
    stonePieces: number;
    copperPieces: number;
    ironPieces: number;
    coalPieces: number;
    goldPieces: number;
    iridiumPieces: number;
    quartzPieces: number;
    gameVersion: string;
    gameVersionLabel: string;
    caveChoice: number;
    feed: number;
    farmingLevel: number;
    miningLevel: number;
    combatLevel: number;
    foragingLevel: number;
    fishingLevel: number;
    luckLevel: number;
    newSkillPointsToSpend: number;
    addedFarmingLevel: number;
    addedMiningLevel: number;
    addedCombatLevel: number;
    addedForagingLevel: number;
    addedFishingLevel: number;
    addedLuckLevel: number;
    maxStamina: number;
    maxItems: number;
    lastSeenMovieWeek: number;
    resilience: number;
    attack: number;
    immunity: number;
    attackIncreaseModifier: number;
    knockbackModifier: number;
    weaponSpeedModifier: number;
    critChanceModifier: number;
    critPowerModifier: number;
    weaponPrecisionModifier: number;
    clubCoins: number;
    trashCanLevel: number;
    toolBeingUpgraded: ToolBeingUpgraded;
    daysLeftForToolUpgrade: number;
    houseUpgradeLevel: number;
    daysUntilHouseUpgrade: number;
    coopUpgradeLevel: number;
    barnUpgradeLevel: number;
    hasGreenhouse: boolean;
    hasUnlockedSkullDoor: boolean;
    hasDarkTalisman: boolean;
    hasMagicInk: boolean;
    showChestColorPicker: boolean;
    hasMagnifyingGlass: boolean;
    hasWateringCanEnchantment: boolean;
    magneticRadius: number;
    temporaryInvincibilityTimer: number;
    currentTemporaryInvincibilityDuration: number;
    health: number;
    maxHealth: number;
    difficultyModifier: number;
    isMale: boolean;
    hasBusTicket: boolean;
    stardewHero: boolean;
    hasClubCard: boolean;
    hasSpecialCharm: boolean;
    basicShipped: BasicShipped;
    mineralsFound: BasicShipped;
    recipesCooked: RecipesCooked;
    fishCaught: ArchaeologyFound;
    archaeologyFound: ArchaeologyFound;
    callsReceived: string;
    giftedItems: GiftedItems;
    tailoredItems: string;
    friendshipData: FriendshipData;
    dayOfMonthForSaveGame: number;
    seasonForSaveGame: number;
    yearForSaveGame: number;
    overallsColor: number;
    shirtColor: number;
    skinColor: number;
    hairColor: number;
    eyeColor: number;
    bobber: string;
    qiGems: number;
    hasUsedDailyRevive: boolean;
    chestConsumedLevels: ChestConsumedLevels;
    saveTime: number;
    isCustomized: boolean;
    homeLocation: string;
    lastSleepLocation: string;
    lastSleepPoint: TileLocation;
    daysMarried: number;
    movementMultiplier: number;
    theaterBuildDate: number;
    deepestMineLevel: number;
    stamina: number;
    totalMoneyEarned: number;
    millisecondsPlayed: number;
    hasRustyKey: boolean;
    hasSkullKey: boolean;
    canUnderstandDwarves: boolean;
    HasTownKey: boolean;
    useSeparateWallets: boolean;
    timesReachedMineBottom: number;
    UniqueMultiplayerID: number;
    money: number;
}

export interface ActiveDialogueEvents {
    item: KV;
}

export interface KV {
    key: String;
    value: Number;
}

export interface ArchaeologyFound {
    item: ArchaeologyFoundItem[];
}

export interface ArchaeologyFoundItem {
    key: Number;
    value: CunningValue;
}

export interface CunningValue {
    ArrayOfInt: CropsOfTheWeek;
}

export interface BasicShipped {
    item: BasicShippedItem[];
}

export interface BasicShippedItem {
    key: Number;
    value: Number;
}

export interface Recipes {
    item: KV[];
}

export interface FriendshipData {
    item: FriendshipDataItem[];
}

export interface FriendshipDataItem {
    key: String;
    value: MagentaValue;
}

export interface MagentaValue {
    Friendship: Friendship;
}

export interface Friendship {
    Points: number;
    GiftsThisWeek: number;
    GiftsToday: number;
    LastGiftDate?: LastGiftDate;
    TalkedToToday: boolean;
    ProposalRejected: boolean;
    Status: Status;
    Proposer: number;
    RoommateMarriage: boolean;
}

export interface LastGiftDate {
    Year: number;
    DayOfMonth: number;
    Season: Season;
    TotalDays: number;
}

export type Status = "Friendly" | "Dating" | "Married";

export interface GiftedItems {
    item: GiftedItemsItem[];
}

export interface GiftedItemsItem {
    key: String;
    value: FriskyValue;
}

export interface FriskyValue {
    dictionary: Dictionary;
}

export interface Dictionary {
    item: BasicShippedItem[] | BasicShippedItem;
}

export interface PlayerItems {
    Item: Array<Item | undefined>;
}

export interface Item {
    isLostItem?: boolean;
    category?: Category;
    hasBeenInInventory: boolean;
    name: string;
    specialItem?: boolean;
    SpecialVariable: number;
    DisplayName: string;
    stack: number;
    initialParentTileIndex?: number;
    currentParentTileIndex?: number;
    indexOfMenuItemView?: number;
    stackable?: boolean;
    instantUse?: boolean;
    isEfficient?: boolean;
    animationSpeedModifier?: number;
    upgradeLevel?: number;
    numAttachmentSlots?: number;
    attachments?: AttachmentsClass | string;
    BaseName?: string;
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
    addedImmunity?: number;
    knockback?: number;
    critChance?: number;
    critMultiplier?: number;
    appearance?: number;
    isOnSpecial?: boolean;
    additionalPower?: Number;
    parentSheetIndex?: number;
    tileLocation?: TileLocation;
    owner?: number;
    canBeSetDown?: boolean;
    canBeGrabbed?: boolean;
    isHoedirt?: boolean;
    isSpawnedObject?: boolean;
    questItem?: boolean;
    questId?: number;
    isOn?: boolean;
    fragility?: number;
    price?: number;
    edibility?: number;
    quality?: number;
    bigCraftable?: boolean;
    setOutdoors?: boolean;
    setIndoors?: boolean;
    readyForHarvest?: boolean;
    showNextIndex?: boolean;
    flipped?: boolean;
    hasBeenPickedUpByFarmer?: boolean;
    isRecipe?: boolean;
    isLamp?: boolean;
    minutesUntilReady?: number;
    boundingBox?: BoundingBox;
    scale?: TileLocation;
    uses?: number;
    preservedParentSheetIndex?: number;
    destroyOvernight?: boolean;
    furniture_type?: number;
    rotations?: number;
    currentRotation?: number;
    sourceRect?: BoundingBox;
    defaultSourceRect?: BoundingBox;
    defaultBoundingBox?: BoundingBox;
    drawHeldObjectLow?: boolean;
    indexInTileSheet?: number;
    indexInTileSheetFemale?: number;
    clothesType?: number;
    dyeable?: boolean;
    clothesColor?: HairstyleColor;
    otherData?: string;
    isPrismatic?: boolean;
    indexInColorSheet: number;
    which?: number;
    skipHairDraw?: boolean;
    ignoreHairstyleOffset?: boolean;
    hairDrawType?: number;
    preserve?: string;
    uniqueID?: number;
    defenseBonus?: number;
    immunityBonus?: number;
    appliedBootSheetIndex?: number;
    heldObject?: Item;
    bedType?: string;
}

export interface AttachmentsClass {
    Object: string[] | Item;
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
    nextQuests: Number;
    questTitle: string;
    targetMessage?: string;
    target?: string;
    item?: number;
    number?: number;
    parts?: string;
    dialogueparts?: string;
}

export interface RecipesCooked {
    item: BasicShippedItem;
}

export interface Stats {
    seedsSown: number;
    itemsShipped: number;
    itemsCooked: number;
    itemsCrafted: number;
    chickenEggsLayed: number;
    duckEggsLayed: number;
    cowMilkProduced: number;
    goatMilkProduced: number;
    rabbitWoolProduced: number;
    sheepWoolProduced: number;
    cheeseMade: number;
    goatCheeseMade: number;
    trufflesFound: number;
    stoneGathered: number;
    rocksCrushed: number;
    dirtHoed: number;
    giftsGiven: number;
    timesUnconscious: number;
    averageBedtime: number;
    timesFished: number;
    fishCaught: number;
    bouldersCracked: number;
    stumpsChopped: number;
    stepsTaken: number;
    monstersKilled: number;
    diamondsFound: number;
    prismaticShardsFound: number;
    otherPreciousGemsFound: number;
    caveCarrotsFound: number;
    copperFound: number;
    ironFound: number;
    coalFound: number;
    coinsFound: number;
    goldFound: number;
    iridiumFound: number;
    barsSmelted: number;
    beveragesMade: number;
    preservesMade: number;
    piecesOfTrashRecycled: number;
    mysticStonesCrushed: number;
    daysPlayed: number;
    weedsEliminated: number;
    sticksChopped: number;
    notesFound: number;
    questsCompleted: number;
    starLevelCropsShipped: number;
    cropsShipped: number;
    itemsForaged: number;
    slimesKilled: number;
    geodesCracked: number;
    goodFriends: number;
    totalMoneyGifted: number;
    individualMoneyEarned: number;
    specificMonstersKilled: Recipes;
    stat_dictionary: string;
    GoodFriends: number;
    CropsShipped: number;
    ItemsForaged: number;
    GeodesCracked: number;
    SlimesKilled: number;
    StarLevelCropsShipped: number;
    StoneGathered: number;
    QuestsCompleted: number;
    FishCaught: number;
    NotesFound: number;
    SticksChopped: number;
    WeedsEliminated: number;
    DaysPlayed: number;
    BouldersCracked: number;
    MysticStonesCrushed: number;
    GoatCheeseMade: number;
    CheeseMade: number;
    PiecesOfTrashRecycled: number;
    PreservesMade: number;
    BeveragesMade: number;
    BarsSmelted: number;
    IridiumFound: number;
    GoldFound: number;
    CoinsFound: number;
    CoalFound: number;
    IronFound: number;
    CopperFound: number;
    CaveCarrotsFound: number;
    OtherPreciousGemsFound: number;
    PrismaticShardsFound: number;
    DiamondsFound: number;
    MonstersKilled: number;
    StepsTaken: number;
    StumpsChopped: number;
    TimesFished: number;
    AverageBedtime: number;
    TimesUnconscious: number;
    GiftsGiven: number;
    DirtHoed: number;
    RocksCrushed: number;
    TrufflesFound: number;
    SheepWoolProduced: number;
    RabbitWoolProduced: number;
    GoatMilkProduced: number;
    CowMilkProduced: number;
    DuckEggsLayed: number;
    ItemsCrafted: number;
    ChickenEggsLayed: number;
    ItemsCooked: number;
    ItemsShipped: number;
    SeedsSown: number;
    IndividualMoneyEarned: number;
}

export interface ToolBeingUpgraded {
    isLostItem: boolean;
    category: Category;
    hasBeenInInventory: boolean;
    name: string;
    specialItem: boolean;
    SpecialVariable: number;
    DisplayName: string;
    Name: string;
    Stack: number;
    initialParentTileIndex: number;
    currentParentTileIndex: number;
    indexOfMenuItemView: number;
    stackable: boolean;
    instantUse: boolean;
    isEfficient: boolean;
    animationSpeedModifier: number;
    upgradeLevel: number;
    numAttachmentSlots: number;
    attachments: string;
    BaseName: string;
    InitialParentTileIndex: number;
    IndexOfMenuItemView: number;
    InstantUse: boolean;
    IsEfficient: boolean;
    AnimationSpeedModifier: number;
    Stackable: boolean;
    isBottomless: boolean;
    waterCanMax: number;
    WaterLeft: number;
    IsBottomless: boolean;
}

export interface SpecialOrders {
    SpecialOrder: SpecialOrdersSpecialOrder;
}

export interface SpecialOrdersSpecialOrder {
    preSelectedItems: string;
    selectedRandomElements: string;
    objectives: SpecialOrderObjective[];
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
    itemToRemoveOnEnd: number;
    mailToRemoveOnEnd: string;
    dueDate: number;
    duration: string;
    questState: string;
}

export interface SpecialOrderObjective {
    currentCount: number;
    maxCount: number;
    description: string;
    failOnCompletion: boolean;
    targetNames?: string;
    acceptableContextTagSets?: string;
    targetName?: string;
    message?: string;
}

export interface ParticipantsIDs {
    item: ParticipantsIDsItem;
}

export interface ParticipantsIDsItem {
    key: OwnerUIDClass;
    value: SleptInTemporaryBed;
}

export interface SpecialOrderReward {
    amount?: Number;
    multiplier?: Scale;
    noLetter?: SleptInTemporaryBed;
    grantedMails?: String;
    host?: SleptInTemporaryBed;
}

export const enum Category {
    Gem = -2,
    Fish = -4,
    Egg = -5,
    Milk = -6,
    Cooking = -7,
    Crafting = -8,
    BigCraftable = -9,
    Mineral = -12,
    Meat = -14,
    MetalResources = -15,
    BuildingResources = -16,
    SellAtPierres = -17,
    SellAtPierresAndMarnies = -18,
    Fertilizer = -19,
    Junk = -20,
    Bait = -21,
    Tackle = -22,
    SellAtFishShop = -23,
    Furniture = -24,
    Ingredients = -25,
    ArtisanGoods = -26,
    Syrup = -27,
    MonsterLoot = -28,
    Equipment = -29,
    Seeds = -74,
    Vegetable = -75,
    Fruit = -79,
    Flower = -80,
    Forage = -81,
    Hat = -95,
    Ring = -96,
    Boots = -97,
    Weapon = -98,
    Tool = -99,
    Clothing = -100,
}