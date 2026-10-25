import { getContext, setContext } from "svelte";

export interface Atlas {
	url: string;
	width: number;
	height: number;
}
export interface SpriteRect {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface UiAssets {
	menu: Atlas;
	cursors: Atlas;
}
export const uiAtlases = {
	menu: { path: "/assets/MenuTiles.png", width: 256, height: 1152 },
	cursors: { path: "/assets/Cursors.png", width: 704, height: 2256 },
} as const;
export type UiAtlasName = keyof typeof uiAtlases;
export function resolveUiAssets(
	resolve: (name: UiAtlasName, path: string) => string,
): UiAssets {
	const atlas = (name: UiAtlasName): Atlas => {
		const { path, width, height } = uiAtlases[name];
		return { url: resolve(name, path), width, height };
	};
	return { menu: atlas("menu"), cursors: atlas("cursors") };
}
const key = Symbol("uiAssets");

// The app resolves its deployment base; the isolated lab supplies bundled URLs.
// Definitions carry no editable save state or resource-owning item instances.
export const setUiAssets = (assets: UiAssets) => setContext(key, assets);
export function getUiAssets(): UiAssets {
	const assets = getContext<UiAssets | undefined>(key);
	if (!assets) throw new Error("UI sprite assets have not been provided");
	return assets;
}

// GameMenu.draw uses these 16px tabs from Cursors at y=368. Names describe
// the editor purpose; the map tab is the current farm-navigation candidate.
export const uiIcons = {
	inventory: { x: 0, y: 368, width: 16, height: 16 },
	relationships: { x: 32, y: 368, width: 16, height: 16 },
	farm: { x: 48, y: 368, width: 16, height: 16 },
	crafting: { x: 64, y: 368, width: 16, height: 16 },
	collections: { x: 80, y: 368, width: 16, height: 16 },
	settings: { x: 96, y: 368, width: 16, height: 16 },
	exit: { x: 112, y: 368, width: 16, height: 16 },
} satisfies Record<string, SpriteRect>;
export type UiIconName = keyof typeof uiIcons;

// Game1.drawDialogueBox assembles 64px tiles rather than slicing one rectangle.
// Its center is painted behind the corners/edges to fill their transparent areas.
export const dialogueFrame = [
	{ part: "center", x: 64, y: 128 },
	{ part: "top-left", x: 0, y: 0 },
	{ part: "top", x: 128, y: 0 },
	{ part: "top-right", x: 192, y: 0 },
	{ part: "left", x: 0, y: 128 },
	{ part: "right", x: 192, y: 128 },
	{ part: "bottom-left", x: 0, y: 192 },
	{ part: "bottom", x: 128, y: 192 },
	{ part: "bottom-right", x: 192, y: 192 },
].map((tile) => ({ ...tile, width: 64, height: 64 }));
