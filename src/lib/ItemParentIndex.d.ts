import type { Player } from "$types/save/1.5";

export type ParentIndex = number | keyof Pick<Player, 'shirtItem' | 'pantsItem' | 'hat' | 'leftRing' | 'rightRing' | 'boots'>;