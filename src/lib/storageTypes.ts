/** Player-placed chest conversions mirror the game's swappable_chest data. */
export const storageTypes = [
	{
		itemId: "130",
		name: "Chest",
		spriteIndex: 130,
		capacity: 36,
		special: "None",
	},
	{
		itemId: "232",
		name: "Stone Chest",
		spriteIndex: 232,
		capacity: 36,
		special: "None",
	},
	{
		itemId: "BigChest",
		name: "Big Chest",
		spriteIndex: 304,
		capacity: 70,
		special: "BigChest",
	},
	{
		itemId: "BigStoneChest",
		name: "Big Stone Chest",
		spriteIndex: 328,
		capacity: 70,
		special: "BigChest",
	},
] as const;
