import type { Player } from "$types/save/1.6";

export type ParentIndex =
    | number
    | keyof Pick<
          Player,
          "shirtItem" | "pantsItem" | "hat" | "leftRing" | "rightRing" | "boots"
      >;
