import { dateableCharacters } from "$lib/NPCs";
import type { FriendshipData, FriendshipDataItem, Status } from "$types/save";
import { SvelteMap } from "svelte/reactivity";
import { type DataProxy, Raw } from ".";

export class Friendship implements DataProxy<FriendshipDataItem> {
	public [Raw]: FriendshipDataItem;

	public readonly name: string; // key.string
	public readonly maxPoints: number;
	public readonly maxHearts: number;

	public giftsThisWeek: number;
	public giftsToday: number;
	public talkedToToday: boolean;
	public proposalRejected: boolean;
	public status: Status;
	public proposer: number;
	public roommateMarriage: boolean;

	private static HEART_SIZE = 250; // points per "heart" as displayed in-game

	private dateable = $derived(dateableCharacters.some((c) => c === this.name));

	constructor(item: FriendshipDataItem) {
		this[Raw] = item;
		this.name = $state(this[Raw].key.string);
		$effect(() => {
			this[Raw].key.string = this.name;
		});
		const f = this[Raw].value.Friendship;
		this.giftsThisWeek = $state(f.GiftsThisWeek ?? 0);
		$effect(() => {
			f.GiftsThisWeek = this.giftsThisWeek;
		});
		this.giftsToday = $state(f.GiftsToday ?? 0);
		$effect(() => {
			f.GiftsToday = this.giftsToday;
		});
		this.talkedToToday = $state(f.TalkedToToday ?? false);
		$effect(() => {
			f.TalkedToToday = this.talkedToToday;
		});
		this.proposalRejected = $state(f.ProposalRejected ?? false);
		$effect(() => {
			f.ProposalRejected = this.proposalRejected;
		});
		this.status = $state(f.Status);
		$effect(() => {
			f.Status = this.status;
		});
		this.proposer = $state(f.Proposer ?? 0);
		$effect(() => {
			f.Proposer = this.proposer;
		});
		this.roommateMarriage = $state(f.RoommateMarriage ?? false);
		$effect(() => {
			f.RoommateMarriage = this.roommateMarriage;
		});

		// Compute derived values
		this.maxHearts = $derived(
			this.dateable
				? this.status === "Married"
					? 14
					: this.status === "Dating"
						? 10
						: 8
				: 10,
		);
		this.maxPoints = $derived(
			this.maxHearts * Friendship.HEART_SIZE + Friendship.HEART_SIZE - 1,
		); // 250 points per heart, plus 249 points after the last heart
	}

	get points() {
		return this[Raw].value.Friendship.Points;
	}

	/*
		Having a setter for this is slightly problematic, as when maxPoints is updated, points does not update. However, I'm willing to bet that nothing bad will happen in-game.
		As well, if a user accidentally changes maxPoints in the editor, they might be happier if their original value is preserved.
	*/
	set points(v: number) {
		if (Number.isNaN(v)) return;
		// Lower-bound clamp at 0; upper bound based on other properties
		const upper = this.maxPoints;
		const clamped = Math.max(0, Math.min(v, upper));
		this[Raw].value.Friendship.Points = Math.floor(clamped);
	}

	get hearts() {
		return Math.floor(this.points / Friendship.HEART_SIZE);
	}

	set hearts(v: number) {
		this.points = v * Friendship.HEART_SIZE;
	}
}

export class Friendships
	extends SvelteMap<string, Friendship>
	implements DataProxy<FriendshipData>
{
	public [Raw]: FriendshipData;

	constructor(data: FriendshipData) {
		const entries = data.item.map((i) => {
			const proxy = new Friendship(i);
			return [proxy.name, proxy] as const;
		});
		super(entries);
		this[Raw] = data;
	}

	/** Custom iterator to sort similar to how friendships are displayed in-game */
	[Symbol.iterator]() {
		return Array.from(this.entries())
			.sort(([, a], [, b]) => sortFriendships(a, b))
			.values();
	}

	set(name: string, value: Friendship): this {
		super.set(name, value);

		// Update raw data
		const idx = this[Raw].item.findIndex((i) => i.key.string === name);
		if (idx !== -1) {
			// If friendship exists, replace it
			this[Raw].item[idx] = value[Raw];
		} else {
			// Otherwise, just push to the end
			this[Raw].item.push(value[Raw]);
		}

		return this;
	}

	delete(name: string): boolean {
		const idx = this[Raw].item.findIndex((i) => i.key.string === name);
		if (idx !== -1) {
			this[Raw].item.splice(idx, 1);
			return true;
		}
		return false;
	}
}

function sortFriendships(a: Friendship, b: Friendship) {
	// Sort by points, then by alphabet
	if (a.points !== b.points) {
		return b.points - a.points;
	}
	return a.name.localeCompare(b.name);
}
