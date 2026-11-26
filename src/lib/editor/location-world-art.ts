/** One atlas frame and its offset in map tiles from a saved anchor. */
export interface WorldFrame {
	readonly url: string;
	readonly sourceX: number;
	readonly sourceY: number;
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	readonly flipped?: boolean;
	/** Mature crowns can overlap other records and draw in the canopy layer. */
	readonly canopy?: boolean;
	/** Tall saplings share draw order with objects near their roots. */
	readonly tallSapling?: boolean;
}

// The farm preview already depends on workspace exports. Use known vanilla
// filenames only, with a representative spring frame for seasonal species.
const wildSheets = new Map([
	["1", "tree1_spring"],
	["2", "tree2_spring"],
	["3", "tree3_spring"],
	["6", "tree_palm"],
	["7", "mushroom_tree"],
	["8", "tree8_spring"],
	["9", "tree_palm2"],
	["10", "tree1_greenRain"],
	["11", "tree2_greenRain"],
	["12", "tree3_greenRain"],
	["13", "mystic_tree"],
]);
// Legacy saves store the atlas row itself. Current saves use sapling IDs.
const legacyFruitRows = new Map(
	["0", "1", "2", "3", "4", "5", "7", "8"].map((row) => [row, Number(row)]),
);
const fruitRows = new Map([
	["628", 0],
	["629", 1],
	["630", 2],
	["631", 3],
	["632", 4],
	["633", 5],
	["69", 7],
	["835", 8],
]);

export function wildTreeFrames(
	type: string | undefined,
	stage: number | undefined,
	stump: boolean,
	flipped: boolean,
): readonly WorldFrame[] {
	const sheet = type === undefined ? undefined : wildSheets.get(type);
	if (sheet === undefined || stage === undefined || stage < 0) return [];
	const url = `/content/TerrainFeatures/${sheet}.png`;
	// Young trees have individual frames. Mature trees have a separate trunk
	// and canopy, both anchored to the same single saved tile.
	const growthFrames = [
		[32, 128, 16],
		[0, 128, 16],
		[16, 128, 16],
		[0, 96, 32],
		[0, 96, 32],
	] as const;
	const young = growthFrames[stage];
	if (young) {
		const [sourceX, sourceY, height] = young;
		return [
			{
				url,
				sourceX,
				sourceY,
				width: 16,
				height,
				offsetX: 0,
				offsetY: 1 - height / 16,
				flipped,
				tallSapling: height === 32,
			},
		];
	}
	const trunk = {
		url,
		sourceX: 32,
		sourceY: 96,
		width: 16,
		height: 32,
		offsetX: 0,
		offsetY: -1,
		flipped,
	};
	return stump
		? [trunk]
		: [
				trunk,
				{
					url,
					sourceX: 0,
					sourceY: 0,
					width: 48,
					height: 96,
					offsetX: -1,
					offsetY: -5,
					flipped,
					canopy: true,
				},
			];
}

export function fruitTreeFrames(
	type: string | undefined,
	legacyType: string | undefined,
	stage: number | undefined,
	stump: boolean,
	flipped: boolean,
): readonly WorldFrame[] {
	const row =
		type !== undefined
			? fruitRows.get(type)
			: legacyType === undefined
				? undefined
				: (legacyFruitRows.get(legacyType) ?? fruitRows.get(legacyType));
	if (row === undefined || stage === undefined || stage < 0) return [];
	const url = "/content/TileSheets/fruitTrees.png";
	// The spring crown occupies the first seasonal column after the saplings.
	const sourceY = row * 80;
	if (stage < 4)
		return [
			{
				url,
				sourceX: stage * 48,
				sourceY,
				width: 48,
				height: 80,
				offsetX: -1,
				offsetY: -4,
				flipped,
			},
		];
	const trunk = {
		url,
		sourceX: 384,
		sourceY: sourceY + 48,
		width: 48,
		height: 32,
		offsetX: -1,
		offsetY: -1,
		flipped,
	};
	return stump
		? [trunk]
		: [
				trunk,
				{
					url,
					sourceX: 192,
					sourceY,
					width: 48,
					height: 64,
					offsetX: -1,
					offsetY: -4,
					flipped,
					canopy: true,
				},
			];
}

export function bushFrames(size: number | undefined): readonly WorldFrame[] {
	const url = "/content/TileSheets/bushes.png";
	// Use spring frames for the three common hedge sizes. Special bushes keep
	// their footprint markers until their individual frames are supported.
	if (size === undefined) return [];
	switch (size) {
		case 0:
			return [
				{
					url,
					sourceX: 0,
					sourceY: 224,
					width: 16,
					height: 32,
					offsetX: 0,
					offsetY: -1,
				},
			];
		case 1:
			return [
				{
					url,
					sourceX: 0,
					sourceY: 0,
					width: 32,
					height: 48,
					offsetX: 0,
					offsetY: -2,
				},
			];
		case 2:
			return [
				{
					url,
					sourceX: 0,
					sourceY: 128,
					width: 48,
					height: 48,
					offsetX: 0,
					offsetY: -2,
				},
			];
		default:
			return [];
	}
}

export const springGrassFrames: readonly WorldFrame[] = [
	{
		url: "/content/TerrainFeatures/grass.png",
		sourceX: 0,
		sourceY: 0,
		width: 15,
		height: 20,
		offsetX: 0,
		offsetY: -0.25,
	},
];

const fenceSheets = new Map([
	["322", 1],
	["323", 2],
	["324", 3],
	["298", 5],
	["325", 1],
]);

const legacyFences = new Map([
	[1, "322"],
	[2, "323"],
	[3, "324"],
	[4, "325"],
	[5, "298"],
]);

/** Choose an isolated post or closed gate until connected frames are drawn. */
export function fenceFrame(
	itemId: string | undefined,
	legacyType: number | null | undefined,
	isGate: boolean,
): WorldFrame | undefined {
	const id =
		itemId ?? (legacyType == null ? undefined : legacyFences.get(legacyType));
	const sheet = id === undefined ? undefined : fenceSheets.get(id);
	if (sheet === undefined) return undefined;
	const url = `/content/LooseSprites/Fence${sheet}.png`;
	return isGate || id === "325"
		? {
				url,
				sourceX: 0,
				sourceY: 128,
				width: 24,
				height: 32,
				offsetX: -0.25,
				offsetY: -1,
			}
		: {
				url,
				sourceX: 32,
				sourceY: 32,
				width: 16,
				height: 32,
				offsetX: 0,
				offsetY: -1,
			};
}
