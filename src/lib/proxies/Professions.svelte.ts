import type { Achievements } from "$types/save";
import { SvelteSet } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";

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

export interface SkillGroup {
	name: string;
	primary: Profession[];
	secondary: Partial<Record<Profession, Profession[]>>;
}

// Exported so UI can reuse without duplication
export const skillGroups: SkillGroup[] = [
	{
		name: "Farming",
		primary: [Profession.Rancher, Profession.Tiller],
		secondary: {
			[Profession.Rancher]: [Profession.Coopmaster, Profession.Shepherd],
			[Profession.Tiller]: [Profession.Artisan, Profession.Agriculturist],
		},
	},
	{
		name: "Fishing",
		primary: [Profession.Fisher, Profession.Trapper],
		secondary: {
			[Profession.Fisher]: [Profession.Angler, Profession.Pirate],
			[Profession.Trapper]: [Profession.Mariner, Profession.Luremaster],
		},
	},
	{
		name: "Foraging",
		primary: [Profession.Forester, Profession.Gatherer],
		secondary: {
			[Profession.Forester]: [Profession.Lumberjack, Profession.Tapper],
			[Profession.Gatherer]: [Profession.Botanist, Profession.Tracker],
		},
	},
	{
		name: "Mining",
		primary: [Profession.Miner, Profession.Geologist],
		secondary: {
			[Profession.Miner]: [Profession.Blacksmith, Profession.Prospector],
			[Profession.Geologist]: [Profession.Excavator, Profession.Gemologist],
		},
	},
	{
		name: "Combat",
		primary: [Profession.Fighter, Profession.Scout],
		secondary: {
			[Profession.Fighter]: [Profession.Brute, Profession.Defender],
			[Profession.Scout]: [Profession.Acrobat, Profession.Desperado],
		},
	},
];

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
