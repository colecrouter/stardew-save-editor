import type { Farmer, SaveDocument } from "./domain.ts";

// Saved farmer and slot lenses have no runtime dependency on mutation dispatch.
// Inventory adapters can share them without importing the domain dispatcher.
export const farmers = (document: SaveDocument) =>
	[document.SaveGame.player, ...document.SaveGame.farmhands].filter(
		(farmer): farmer is Farmer => farmer !== null,
	);

export const emptySlot = (item: unknown) => item === null || item === undefined;
