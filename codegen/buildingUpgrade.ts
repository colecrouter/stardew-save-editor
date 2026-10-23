export interface Point {
	X: number;
	Y: number;
}

/** An item the game places in a building's interior when it's built or upgraded */
export interface IndoorItem {
	id: string;
	/** Qualified item ID, like `(BC)101` */
	itemId: string;
	tile: Point;
	indestructible?: boolean;
}

/** Something the game moves inside a building's interior when it's upgraded */
export interface IndoorItemMove {
	source: Point;
	destination: Point;
	/** Area to move, when bigger than one tile */
	size?: Point;
	/** Leave the item alone if it's this qualified item ID */
	unlessItemId?: string;
}

export interface BuildingUpgradeData {
	buildingToUpgrade?: string;
	validOccupantTypes?: string[];
	/** Left out when the building has no door */
	humanDoor?: Point;
	/** Left out when the building has no animal door */
	animalDoor?: Point;
	indoorItems?: IndoorItem[];
	indoorItemMoves?: IndoorItemMove[];
	addMailOnBuild?: string[];
}

/** The fields of a Data/Buildings.json entry used for upgrades */
export interface BuildingUpgradeSource {
	BuildingToUpgrade?: string | null;
	ValidOccupantTypes?: string[] | null;
	HumanDoor?: Point | null;
	AnimalDoor?: Point | null;
	IndoorItems?:
		| {
				Id?: string;
				ItemId?: string;
				Tile?: Point;
				Indestructible?: boolean;
		  }[]
		| null;
	IndoorItemMoves?:
		| {
				Source?: Point;
				Destination?: Point;
				Size?: Point;
				UnlessItemId?: string | null;
		  }[]
		| null;
	AddMailOnBuild?: string[] | null;
}

const point = ({ X, Y }: Point): Point => ({ X, Y });

/** Buildings without a door have one at -1, -1 */
const door = (value: Point | null | undefined) =>
	value && value.X >= 0 && value.Y >= 0 ? point(value) : undefined;

/**
    Map the upgrade fields of a building in Data/Buildings.json (see
    `Building.LoadFromBuildingData` and `Building.InitializeIndoor`).
    Empty lists are left out so buildings without them stay unchanged.
*/
export function getBuildingUpgradeData(
	data: BuildingUpgradeSource,
): BuildingUpgradeData {
	const indoorItems = (data.IndoorItems ?? []).flatMap((item) =>
		item.ItemId && item.Tile
			? [
					{
						id: item.Id ?? item.ItemId,
						itemId: item.ItemId,
						tile: point(item.Tile),
						indestructible: item.Indestructible || undefined,
					},
				]
			: [],
	);
	const indoorItemMoves = (data.IndoorItemMoves ?? []).flatMap((move) =>
		move.Source && move.Destination
			? [
					{
						source: point(move.Source),
						destination: point(move.Destination),
						size:
							move.Size && (move.Size.X !== 1 || move.Size.Y !== 1)
								? point(move.Size)
								: undefined,
						unlessItemId: move.UnlessItemId || undefined,
					},
				]
			: [],
	);

	return {
		buildingToUpgrade: data.BuildingToUpgrade || undefined,
		validOccupantTypes: data.ValidOccupantTypes?.length
			? data.ValidOccupantTypes
			: undefined,
		humanDoor: door(data.HumanDoor),
		// The data has a rectangle; the save only keeps where it starts
		animalDoor: door(data.AnimalDoor),
		indoorItems: indoorItems.length ? indoorItems : undefined,
		indoorItemMoves: indoorItemMoves.length ? indoorItemMoves : undefined,
		addMailOnBuild: data.AddMailOnBuild?.length
			? data.AddMailOnBuild
			: undefined,
	};
}
