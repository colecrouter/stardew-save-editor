import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { FriendshipData } from "../codegen/save";
import { characters } from "../src/lib/NPCs";
import { Friendship, Friendships } from "../src/lib/proxies/Friendship.svelte";
import { Raw } from "../src/lib/proxies";

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
