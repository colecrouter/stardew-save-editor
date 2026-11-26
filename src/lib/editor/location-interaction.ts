/** A whole-tile position in the save coordinate system. */
export interface MapTile {
	readonly x: number;
	readonly y: number;
}

/** A point in CSS pixels relative to the map viewport. */
export interface ViewportPoint {
	readonly x: number;
	readonly y: number;
}

export interface MapCamera {
	/** Viewport position of the top-left corner of tile (0, 0). */
	readonly origin: ViewportPoint;
	/** Positive scale in CSS pixels per tile. */
	readonly pixelsPerTile: number;
}

/**
 * The existing inspection path and object index identify records within one
 * projection. Revalidate the saved identity before carrying them across projections.
 */
export type MapSelection =
	| {
			readonly kind: "tile";
			readonly locationId: string;
			readonly tile: MapTile;
	  }
	| {
			readonly kind: "object";
			readonly locationId: string;
			readonly objectIndex: number;
	  }
	| {
			readonly kind: "building";
			readonly locationId: string;
			readonly buildingIndex: number;
	  };

/**
 * Contents can replace the inspector on phones while the camera and map
 * selection remain available for the return trip.
 */
export type LocationPanel =
	| { readonly kind: "inspector" }
	| {
			readonly kind: "contents";
			readonly container: Extract<MapSelection, { kind: "object" }>;
	  };

/**
 * Keep a proposed placement apart from the saved object. Drag and tap can
 * supply the same candidate, and a missing tile means picking is in progress.
 */
export interface PlacementDraft {
	readonly source: Exclude<MapSelection, { kind: "tile" }>;
	readonly candidate: MapTile | null;
}

export interface LocationInteraction {
	readonly selection: MapSelection | null;
	readonly panel: LocationPanel;
	readonly placement: PlacementDraft | null;
}

/** Returns the viewport position of the tile’s top-left corner. */
export function tileToViewport(
	camera: MapCamera,
	tile: MapTile,
): ViewportPoint {
	return {
		x: camera.origin.x + tile.x * camera.pixelsPerTile,
		y: camera.origin.y + tile.y * camera.pixelsPerTile,
	};
}

/** Returns the tile containing the point. The caller checks map bounds. */
export function viewportToTile(
	camera: MapCamera,
	point: ViewportPoint,
): MapTile {
	// Floor the fractional coordinates so points before the map origin stay
	// outside the first tile.
	return {
		x: Math.floor((point.x - camera.origin.x) / camera.pixelsPerTile),
		y: Math.floor((point.y - camera.origin.y) / camera.pixelsPerTile),
	};
}

/**
 * Changes scale while keeping the map point beneath the anchor fixed.
 * The caller supplies an already constrained positive scale.
 */
export function zoomAt(
	camera: MapCamera,
	anchor: ViewportPoint,
	pixelsPerTile: number,
): MapCamera {
	// Scale the origin’s offset from the anchor to keep the same tile under
	// the mouse cursor or pinch midpoint.
	const ratio = pixelsPerTile / camera.pixelsPerTile;
	return {
		origin: {
			x: anchor.x - (anchor.x - camera.origin.x) * ratio,
			y: anchor.y - (anchor.y - camera.origin.y) * ratio,
		},
		pixelsPerTile,
	};
}
