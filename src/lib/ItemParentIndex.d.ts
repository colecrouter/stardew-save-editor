import type { Player } from "$types/save/1.6";

export type ParentIndex =
    | number
    | keyof Pick<
          Player,
          "shirt" | "pants" | "hat" | "leftRing" | "rightRing" | "boots"
      >;
