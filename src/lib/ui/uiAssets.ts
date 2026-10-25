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
	objects: Atlas;
	craftables: Atlas;
	barn: Atlas;
	shirts: Atlas;
}
export const uiAtlases = {
	menu: { path: "/assets/MenuTiles.png", width: 256, height: 1152 },
	cursors: { path: "/assets/Cursors.png", width: 704, height: 2256 },
	objects: { path: "/assets/springobjects.png", width: 384, height: 624 },
	craftables: { path: "/assets/Craftables.png", width: 128, height: 1472 },
	barn: { path: "/assets/buildings/Barn.png", width: 112, height: 128 },
	shirts: { path: "/assets/shirts.png", width: 256, height: 608 },
} as const;
export type UiAtlasName = keyof typeof uiAtlases;
export function resolveUiAssets(
	resolve: (name: UiAtlasName, path: string) => string,
): UiAssets {
	const atlas = (name: UiAtlasName): Atlas => {
		const { path, width, height } = uiAtlases[name];
		return { url: resolve(name, path), width, height };
	};
	return {
		menu: atlas("menu"),
		cursors: atlas("cursors"),
		objects: atlas("objects"),
		craftables: atlas("craftables"),
		barn: atlas("barn"),
		shirts: atlas("shirts"),
	};
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
// the editor purpose. Other definitions use the existing building/item atlases.
export const uiIcons = {
	inventory: { x: 0, y: 368, width: 16, height: 16 },
	relationships: { x: 32, y: 368, width: 16, height: 16 },
	farm: { x: 0, y: 0, width: 112, height: 128 },
	chests: { x: 32, y: 512, width: 16, height: 32 },
	appearance: { x: 8, y: 0, width: 8, height: 8 },
	cooking: { x: 32, y: 128, width: 16, height: 16 },
	events: { x: 112, y: 48, width: 16, height: 16 },
	quests: { x: 32, y: 560, width: 16, height: 16 },
	community: { x: 32, y: 288, width: 16, height: 16 },
	qi: { x: 288, y: 560, width: 16, height: 16 },
	crafting: { x: 64, y: 368, width: 16, height: 16 },
	collections: { x: 80, y: 368, width: 16, height: 16 },
	settings: { x: 96, y: 368, width: 16, height: 16 },
	exit: { x: 112, y: 368, width: 16, height: 16 },
} satisfies Record<string, SpriteRect>;
export type UiIconName = keyof typeof uiIcons;

export const uiIconAtlases: Record<UiIconName, UiAtlasName> = {
	inventory: "cursors",
	relationships: "cursors",
	farm: "barn",
	chests: "craftables",
	appearance: "shirts",
	cooking: "objects",
	events: "objects",
	quests: "objects",
	community: "objects",
	qi: "objects",
	crafting: "cursors",
	collections: "cursors",
	settings: "cursors",
	exit: "cursors",
};

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
