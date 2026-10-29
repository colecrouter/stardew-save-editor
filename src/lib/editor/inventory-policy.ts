/** Editing policy shared by request validation and inspector presentation.
 * These editor limits deliberately permit oversized stacks; game stacking caps
 * and the retained legacy stack action have their own narrower semantics. */
export const inventoryQuantity = { min: 1, max: 9999, step: 1 } as const;
export const inventoryQualities = [
	{ value: 0, label: "Normal" },
	{ value: 1, label: "Silver" },
	{ value: 2, label: "Gold" },
	{ value: 4, label: "Iridium" },
] as const;
