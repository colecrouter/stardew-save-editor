import type { Achievements, Player } from "$types/save";
import { SvelteSet } from "svelte/reactivity";
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

export enum Skill {
	Farming = "farming",
	Fishing = "fishing",
	Foraging = "foraging",
	Mining = "mining",
	Combat = "combat",
}

const indices = new Map<Skill, number>([
	[Skill.Farming, 0],
	[Skill.Fishing, 1],
	[Skill.Foraging, 2],
	[Skill.Mining, 3],
	[Skill.Combat, 4],
]);

/**
 * Player skills, indexed by their in-game names.
 *
 *
 * {@link https://stardewvalleywiki.com/Skills}
 */
export class Skills implements DataProxy<Player> {
	public [Raw]: Player;

	/** Experience points are represented by total in-game XP values (from 0 to 15000+) */
	public experience: Record<Skill, number>;
	/** Levels are a read-only representation of the player's skill levels (from 0 to 10) */
	public levels: Readonly<Record<Skill, number>>;

	constructor(player: Player) {
		this[Raw] = player;

		// @ts-ignore
		this.experience = $state({});

		// Initialize reactive states for each skill and sync back
		for (const [, skill] of Object.entries(Skill)) {
			this.experience[skill] =
				this[Raw].experiencePoints.int?.[indices.get(skill) ?? 0] ?? 0;
			$effect(() => {
				if (!this[Raw].experiencePoints.int)
					this[Raw].experiencePoints.int = [];

				// Update experience points
				this[Raw].experiencePoints.int[indices.get(skill) ?? 0] =
					this.experience[skill];

				// Update levels
				this[Raw][`${skill}Level`] = xpToLevel(this.experience[skill]);
			});
		}

		// I thought about doing two-way reactivity, with it's too much work for now
		this.levels = $derived(
			Object.fromEntries(
				Object.entries(this.experience).map(([skill, xp]) => [
					skill,
					xpToLevel(xp),
				]),
			) as Record<Skill, number>,
		);
	}
}

/**
 * Internal IDs for all "professions" as described in game.
 *
 * {@link https://stardewvalleywiki.com/Skills}
 *
 * These correspond to the various "professions" you are able to choose from in-game, after leveling up & sleeping.
 *
 * @see [Skills](./Skills.svelte.ts)
 */
export enum Profession {
	Rancher = 0,
	Tiller = 1,
	Coopmaster = 2,
	Shepherd = 3,
	Artisan = 4,
	Agriculturist = 5,
	Fisher = 6,
	Trapper = 7,
	Angler = 8,
	Pirate = 9,
	Mariner = 10,
	Luremaster = 11,
	Forester = 12,
	Gatherer = 13,
	Lumberjack = 14,
	Tapper = 15,
	Botanist = 16,
	Tracker = 17,
	Miner = 18,
	Geologist = 19,
	Blacksmith = 20,
	Prospector = 21,
	Excavator = 22,
	Gemologist = 23,
	Fighter = 24,
	Scout = 25,
	Brute = 26,
	Defender = 27,
	Acrobat = 28,
	Desperado = 29,
}

interface SkillGroup {
	skill: Skill;
	primary: Profession[];
	secondary: Partial<Record<Profession, Profession[]>>;
}

/**
 * In game, {@link Profession|Professions} follow a tree structure. After picking a "primary" profession for a given skill, players can choose a "secondary" profession that branches off from it.
 * This represents that tree.
 *
 * In practice, there's nothing stopping us from allowing the player to choose any profession, but allowing them to choose a secondary profession without also choosing the primary profession could introduce undefined behavior in the game.
 */
export const skillGroups: SkillGroup[] = [
	{
		skill: Skill.Farming,
		primary: [Profession.Rancher, Profession.Tiller],
		secondary: {
			[Profession.Rancher]: [Profession.Coopmaster, Profession.Shepherd],
			[Profession.Tiller]: [Profession.Artisan, Profession.Agriculturist],
		},
	},
	{
		skill: Skill.Fishing,
		primary: [Profession.Fisher, Profession.Trapper],
		secondary: {
			[Profession.Fisher]: [Profession.Angler, Profession.Pirate],
			[Profession.Trapper]: [Profession.Mariner, Profession.Luremaster],
		},
	},
	{
		skill: Skill.Foraging,
		primary: [Profession.Forester, Profession.Gatherer],
		secondary: {
			[Profession.Forester]: [Profession.Lumberjack, Profession.Tapper],
			[Profession.Gatherer]: [Profession.Botanist, Profession.Tracker],
		},
	},
	{
		skill: Skill.Mining,
		primary: [Profession.Miner, Profession.Geologist],
		secondary: {
			[Profession.Miner]: [Profession.Blacksmith, Profession.Prospector],
			[Profession.Geologist]: [Profession.Excavator, Profession.Gemologist],
		},
	},
	{
		skill: Skill.Combat,
		primary: [Profession.Fighter, Profession.Scout],
		secondary: {
			[Profession.Fighter]: [Profession.Brute, Profession.Defender],
			[Profession.Scout]: [Profession.Acrobat, Profession.Desperado],
		},
	},
];

/**
 * A collection of professions.
 *
 * Represents a player's current profession choices, given their EXP levels.
 *
 * @see {@link Skills}
 */
export class Professions
	extends SvelteSet<Profession>
	implements DataProxy<Achievements>
{
	public [Raw]: Achievements;

	constructor(raw: Achievements) {
		// Initialize with existing profession ints (cast to enum)
		super(raw.int?.map((p) => p as Profession) ?? []);
		this[Raw] = raw;
		$effect(() => {
			this[Raw].int = Array.from(this);
		});
	}

	private isPrimary(p: Profession) {
		return skillGroups.some((g) => g.primary.includes(p));
	}

	private secondariesFor(p: Profession): Profession[] {
		for (const g of skillGroups) {
			const secs = g.secondary[p];
			if (secs?.length) return secs;
		}
		return [];
	}

	/** Find the primary (parent) profession for a given secondary, if any. */
	private parentFor(p: Profession): Profession | undefined {
		for (const g of skillGroups) {
			for (const primary of g.primary) {
				const secs = g.secondary[primary] ?? [];
				if (secs.includes(p)) return primary;
			}
		}
		return undefined;
	}

	/**
	 * Standard Set add semantics with parent enforcement: if adding a secondary
	 * profession whose primary is not present, the primary is added first.
	 */
	add(p: Profession): this {
		const parent = this.parentFor(p);
		if (parent !== undefined && !this.has(parent)) {
			super.add(parent);
		}
		if (!this.has(p)) super.add(p);
		return this;
	}

	/** Delete a profession; if it's a primary also delete its secondaries. */
	delete(p: Profession): boolean {
		const wasPrimary = this.isPrimary(p);
		const existed = super.delete(p);
		if (existed && wasPrimary) {
			for (const sec of this.secondariesFor(p)) super.delete(sec);
		}
		return existed;
	}
}
