// [farming, mining, foraging, fishing, combat]

import type { Player } from "$types/save";
import { type DataProxy, Raw } from ".";

const xpForLevel = [
	0, 100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000,
] as const;

const xpToLevel = (xp: number) => {
	let level = 0;
	for (let i = 0; i < xpForLevel.length; i++) {
		const xpRequired = xpForLevel[i] ?? 0;
		if (xp < xpRequired) break;
		level = i;
	}
	return level;
};

export class Skills implements DataProxy<number[]> {
	public [Raw]: number[];
	private player: Player;

	public farming: number; // index 0
	public fishing: number; // index 1
	public foraging: number; // index 2
	public mining: number; // index 3
	public combat: number; // index 4

	get raw() {
		return this[Raw];
	}

	constructor(skills: number[], player: Player) {
		this[Raw] = skills;
		this.player = player;

		// Initialize reactive states for each skill and sync back with effects
		this.farming = $state(this[Raw][0] ?? 0);
		$effect(() => {
			this[Raw][0] = this.farming;
			this.player.farmingLevel = xpToLevel(this.farming);
		});

		this.fishing = $state(this[Raw][1] ?? 0);
		$effect(() => {
			this[Raw][1] = this.fishing;
			this.player.fishingLevel = xpToLevel(this.fishing);
		});

		this.foraging = $state(this[Raw][2] ?? 0);
		$effect(() => {
			this[Raw][2] = this.foraging;
			this.player.foragingLevel = xpToLevel(this.foraging);
		});

		this.mining = $state(this[Raw][3] ?? 0);
		$effect(() => {
			this[Raw][3] = this.mining;
			this.player.miningLevel = xpToLevel(this.mining);
		});

		this.combat = $state(this[Raw][4] ?? 0);
		$effect(() => {
			this[Raw][4] = this.combat;
			this.player.combatLevel = xpToLevel(this.combat);
		});
	}
}
