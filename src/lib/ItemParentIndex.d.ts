import type { Player } from "$types/save";

export type ParentIndex =
	| number
	| keyof Pick<
			Player,
			"shirtItem" | "pantsItem" | "hat" | "leftRing" | "rightRing" | "boots"
	  >;
