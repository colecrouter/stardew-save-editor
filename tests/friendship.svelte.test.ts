import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { type FriendshipData, Season, Status } from "../codegen/save";
import { characters } from "../src/lib/NPCs";
import { Raw } from "../src/lib/proxies";
import { Friendship, Friendships } from "../src/lib/proxies/Friendship.svelte";

const abigail = () => Friendship.fromName("Abigail")[Raw];

describe("relationship management", () => {
	it("adds every missing social NPC without replacing existing progress", () => {
		const existing = abigail();
		existing.value.Friendship.Points = 1250;
		const data: FriendshipData = { item: [existing] };

		let friendships!: Friendships;
		const cleanup = $effect.root(() => {
			friendships = new Friendships(data);
		});

		expect(friendships.addMissingCharacters()).toBe(characters.length - 1);
		flushSync();
		expect(friendships.size).toBe(characters.length);
		expect(data.item).toHaveLength(characters.length);
		expect(friendships.get("Abigail")?.points).toBe(1250);
		expect(friendships.get("Leo")?.points).toBe(0);
		expect(friendships.addMissingCharacters()).toBe(0);
		cleanup();
	});

	it("deletes a relationship from both the reactive map and raw save", () => {
		const data: FriendshipData = { item: [abigail()] };
		let friendships!: Friendships;
		const cleanup = $effect.root(() => {
			friendships = new Friendships(data);
		});

		expect(friendships.delete("Abigail")).toBe(true);
		expect(friendships.has("Abigail")).toBe(false);
		expect(data.item).toEqual([]);
		cleanup();
	});
});

describe("pregnancy", () => {
	const today = { year: 1, season: Season.Winter, day: 20 };

	const married = () => {
		const raw = abigail();
		raw.value.Friendship.Status = Status.Married;
		let friendship!: Friendship;
		const cleanup = $effect.root(() => {
			friendship = new Friendship(raw);
		});
		return { raw, friendship, cleanup };
	};

	it("makes a spouse pregnant, due 14 days later across the season", () => {
		const { raw, friendship, cleanup } = married();
		friendship.setPregnant(true, today);
		flushSync();
		expect(friendship.pregnant).toBe(true);
		expect(friendship.daysUntilBirth(today)).toBe(14);
		expect(raw.value.Friendship.NextBirthingDate).toEqual({
			Year: 2,
			DayOfMonth: 6,
			Season: Season.Spring,
		});
		cleanup();
	});

	it("ends a pregnancy by removing the due date", () => {
		const { raw, friendship, cleanup } = married();
		friendship.setPregnant(true, today, 3);
		flushSync();
		friendship.setPregnant(false, today);
		flushSync();
		expect(friendship.pregnant).toBe(false);
		expect(raw.value.Friendship).not.toHaveProperty("NextBirthingDate");
		cleanup();
	});

	it("only lets a spouse be pregnant", () => {
		const raw = abigail();
		let friendship!: Friendship;
		const cleanup = $effect.root(() => {
			friendship = new Friendship(raw);
		});
		friendship.setPregnant(true, today);
		flushSync();
		expect(friendship.pregnant).toBe(false);
		expect(raw.value.Friendship.NextBirthingDate).toBeUndefined();
		cleanup();
	});
});
