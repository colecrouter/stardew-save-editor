import type { FarmMap } from "./location-inspection.ts";

/** A local map raster and its dimensions in saved tiles. */
export interface LocationMap {
	readonly canvas: HTMLCanvasElement;
	readonly width: number;
	readonly height: number;
	readonly tileSize: number;
	/** Tiles cleared by the base map. Saved records are checked separately. */
	readonly placement: ReadonlySet<number>;
}

/** Load a supported farm and its tilesheets from the dev server's workspace export. */
export async function loadFarmMap(
	name: FarmMap,
	signal: AbortSignal,
): Promise<LocationMap> {
	// Vite serves workspace files in development. Resolve them on the server
	// running the editor so guests don't need a local copy of the export.
	async function readAsset(filename: string) {
		const response = await fetch(
			`/content/Maps/${encodeURIComponent(filename)}`,
			{ signal },
		);
		if (!response.ok) throw new Error(`Map asset unavailable: ${filename}.`);
		return response;
	}

	const mapFile = await readAsset(`${name}.tmx`);
	const document = new DOMParser().parseFromString(
		await mapFile.text(),
		"text/xml",
	);
	const map = document.documentElement;
	// The vanilla exports have different dimensions. Read their tile bounds
	// directly and cap the raster at the largest supported vanilla farm.
	const width = Number(map.getAttribute("width"));
	const height = Number(map.getAttribute("height"));
	const tileSize = 16;
	if (
		map.tagName !== "map" ||
		map.getAttribute("orientation") !== "orthogonal" ||
		![width, height].every(
			(size) => Number.isInteger(size) && size > 0 && size <= 110,
		) ||
		Number(map.getAttribute("tilewidth")) !== tileSize ||
		Number(map.getAttribute("tileheight")) !== tileSize
	)
		throw new Error("The workspace export does not match this farm preview.");

	const canvas = window.document.createElement("canvas");
	canvas.width = width * tileSize;
	canvas.height = height * tileSize;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Map drawing is unavailable.");

	// Start from visible, non-water ground and exclude every overlay cell.
	// Paths marks game-side features, so it can block placement without drawing.
	const layers = [...map.querySelectorAll(":scope > layer")];
	const ground = new Set<number>();
	const overlays = new Set<number>();
	const sheets = [...map.querySelectorAll(":scope > tileset")];
	const images: ImageBitmap[] = [];
	try {
		const tilesets = [];
		for (const sheet of sheets) {
			const source = sheet.querySelector("image")?.getAttribute("source");
			const first = Number(sheet.getAttribute("firstgid"));
			const count = Number(sheet.getAttribute("tilecount"));
			const columns = Number(sheet.getAttribute("columns"));
			if (
				source == null ||
				!/^[a-z0-9_]+(?:\.png)?$/i.test(source) ||
				![first, count, columns].every(
					(value) => Number.isInteger(value) && value > 0,
				)
			)
				throw new Error(
					`Missing or unsupported tilesheet: ${source ?? "unknown"}.`,
				);
			// Tilesheet names are confined to the exported Maps directory.
			const sheetFile = await readAsset(
				source.endsWith(".png") ? source : `${source}.png`,
			);
			const image = await createImageBitmap(await sheetFile.blob());
			images.push(image);
			const restricted = new Set(
				[...sheet.querySelectorAll("tile")]
					.filter(
						(tile) =>
							tile.querySelector(
								'property[name="Water"], property[name="NoFurniture"], property[name="Passable"]',
							) !== null,
					)
					.map((tile) => Number(tile.getAttribute("id"))),
			);
			tilesets.push({ first, count, columns, image, restricted });
		}
		if (layers.length === 0) throw new Error("The map has no scenery layers.");
		for (const layer of layers) {
			const layerName = layer.getAttribute("name");
			const data = layer.querySelector("data");
			const gids = data?.textContent?.trim().split(",").map(Number);
			if (
				data?.getAttribute("encoding") !== "csv" ||
				gids?.length !== width * height
			)
				throw new Error("This export uses an unsupported tile layer.");
			for (const [index, gid] of gids.entries()) {
				if (gid === 0) continue;
				const set = tilesets.find(
					({ first, count }) => gid >= first && gid < first + count,
				);
				// Flagged or unknown tiles cannot be drawn faithfully by this preview.
				if (!set || !Number.isInteger(gid))
					throw new Error("The map contains an unsupported tile.");
				const tile = gid - set.first;
				if (layerName === "Back" && !set.restricted.has(tile))
					ground.add(index);
				if (layerName !== "Back") overlays.add(index);
				if (layerName === "Paths") continue;
				context.drawImage(
					set.image,
					(tile % set.columns) * tileSize,
					Math.floor(tile / set.columns) * tileSize,
					tileSize,
					tileSize,
					(index % width) * tileSize,
					Math.floor(index / width) * tileSize,
					tileSize,
					tileSize,
				);
			}
		}
	} finally {
		// The raster retains the pixels after the temporary decoded sheets close.
		for (const image of images) image.close();
	}
	// Warp destinations and scenery reserve their cells even if visually empty.
	const warp =
		map
			.querySelector(':scope > properties > property[name="Warp"]')
			?.getAttribute("value")
			?.trim()
			.split(/\s+/) ?? [];
	for (let index = 0; index + 4 < warp.length; index += 5) {
		const x = Number(warp[index]);
		const y = Number(warp[index + 1]);
		if (x >= 0 && x < width && y >= 0 && y < height)
			overlays.add(y * width + x);
	}
	for (const index of overlays) ground.delete(index);
	return { canvas, width, height, tileSize, placement: ground };
}
