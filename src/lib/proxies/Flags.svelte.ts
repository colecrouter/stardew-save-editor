import type { Player } from "$types/save";

const nil = { "@_xsi:nil": "true" } as const;

/**
 * Flags represents the unique flags for the player that **aren't** part of the mail system.
 */
export class Flags {
	raw: Player;

	public canUnderstandDwarves: boolean;
	public hasRustyKey: boolean;
	public hasClubCard: boolean;
	public hasSpecialCharm: boolean;
	public hasSkullKey: boolean;
	public hasMagnifyingGlass: boolean;
	public hasDarkTalisman: boolean;
	public hasMagicInk: boolean;
	public HasTownKey: boolean;

	constructor(player: Player) {
		this.raw = player;

		// Initialize $state properties from raw markers
		this.canUnderstandDwarves = $state(this.raw?.canUnderstandDwarves === "");
		$effect(() =>
			this.setFlag("canUnderstandDwarves", this.canUnderstandDwarves),
		);

		this.hasRustyKey = $state(this.raw?.hasRustyKey === "");
		$effect(() => this.setFlag("hasRustyKey", this.hasRustyKey));

		this.hasClubCard = $state(this.raw?.hasClubCard === "");
		$effect(() => this.setFlag("hasClubCard", this.hasClubCard));

		this.hasSpecialCharm = $state(this.raw?.hasSpecialCharm === "");
		$effect(() => this.setFlag("hasSpecialCharm", this.hasSpecialCharm));

		this.hasSkullKey = $state(this.raw?.hasSkullKey === "");
		$effect(() => this.setFlag("hasSkullKey", this.hasSkullKey));

		this.hasMagnifyingGlass = $state(this.raw?.hasMagnifyingGlass === "");
		$effect(() => this.setFlag("hasMagnifyingGlass", this.hasMagnifyingGlass));

		this.hasDarkTalisman = $state(this.raw?.hasDarkTalisman === "");
		$effect(() => this.setFlag("hasDarkTalisman", this.hasDarkTalisman));

		this.hasMagicInk = $state(this.raw?.hasMagicInk === "");
		$effect(() => this.setFlag("hasMagicInk", this.hasMagicInk));

		this.HasTownKey = $state(this.raw?.HasTownKey === "");
		$effect(() => this.setFlag("HasTownKey", this.HasTownKey));
	}

	// Central helper to write a boolean flag to the raw player (empty string vs xsi:nil)
	private setFlag(
		field:
			| "canUnderstandDwarves"
			| "hasRustyKey"
			| "hasClubCard"
			| "hasSpecialCharm"
			| "hasSkullKey"
			| "hasMagnifyingGlass"
			| "hasDarkTalisman"
			| "hasMagicInk"
			| "HasTownKey",
		value: boolean,
	) {
		// @ts-expect-error dynamic assignment matches original shape (string or nil object)
		this.raw[field] = value ? "" : nil;
	}
}
