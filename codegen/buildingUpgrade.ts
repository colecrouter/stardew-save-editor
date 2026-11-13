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
