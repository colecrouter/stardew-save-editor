import { asset } from "$app/paths";
import buildings from "$generated/buildings.json";

import { dynamicAsset } from "./dynamicAsset.ts";

interface SourceRect {
	X: number;
	Y: number;
	Width: number;
	Height: number;
}
interface BuildingSpriteData {
	name: string;
	texture?: string;
	textureSize?: { X: number; Y: number };
	sourceRect?: SourceRect;
}
const catalog: readonly BuildingSpriteData[] = buildings;
// Game menu crops select one recognizable frame from a larger sheet.
// Other buildings use the generated pixel rectangle rather than tile footprints.
const menuRects = new Map<string, SourceRect>(
	Object.entries({
		"Fish Pond": { X: 0, Y: 0, Width: 80, Height: 80 },
		"Junimo Hut": { X: 0, Y: 0, Width: 48, Height: 64 },
		// The first frame already combines the wooden platform and bowl. The
		// catalog's X32 bowl-only draw layer floats without its separate platform.
		"Pet Bowl": { X: 0, Y: 0, Width: 32, Height: 32 },
	}),
);

/** Find a shipped crop shared by building thumbnails and the farm viewport. */
export function readBuildingSprite(
	name: string | undefined,
	repaired?: boolean,
) {
	const data = catalog.find((row) => row.name === name);
	const rect =
		(name === undefined ? undefined : menuRects.get(name)) ?? data?.sourceRect;
	const width = rect?.Width ?? data?.textureSize?.X;
	const height = rect?.Height ?? data?.textureSize?.Y;
	const texture = data?.texture;
	// Kit's app manifest omits assets in dev. Resolve the trusted catalog
	// filename against the dev asset base so local previews match builds.
	const url =
		texture === undefined
			? undefined
			: import.meta.env.DEV
				? asset("assets/daybg.png").replace(
						/daybg\.png$/,
						`buildings/${encodeURIComponent(texture)}`,
					)
				: dynamicAsset(`assets/buildings/${texture}`);
	// Keep the footprint available for unsupported buildings or missing assets.
	if (
		url === undefined ||
		width === undefined ||
		height === undefined ||
		width <= 0 ||
		height <= 0
	)
		return undefined;
	const y = rect?.Y ?? 0;
	// The greenhouse ruins are the frame directly above the repaired greenhouse.
	return {
		url,
		width,
		height,
		x: rect?.X ?? 0,
		y: name === "Greenhouse" && repaired === false ? y - height : y,
	};
}
