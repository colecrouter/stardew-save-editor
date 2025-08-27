import { describe, it, expect } from "vitest";
import { flushSync } from "svelte";
import { XMLManager } from "../src/lib/workers/xml";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item } from "../src/lib/proxies/Item.svelte";
import type { Player } from "../codegen/save";

function withRoot<T>(fn: () => T): T {
	let result!: T;
	const cleanup = $effect.root(() => {
		result = fn();
	});
	flushSync();
	cleanup();
	return result;
}

function xmlFromSave(save: SaveFile): string {
	const mgr = new XMLManager();
	const bytes = mgr.stringify(JSON.parse(JSON.stringify(save)));
	return new TextDecoder().decode(bytes);
}

function getPlayerXml(xml: string): string {
	const match = xml.match(/<player>[\s\S]*?<\/player>/);
	return match ? match[0] : xml;
}

function minimalPlayer(): Player {
	// minimal structure; tests only care about items/equipment fields
	const player = {
		items: { Item: [] },
	} as unknown as Player;
	return player;
}

function wrapSave(player: Player): SaveFile {
	return { SaveGame: { player } } as unknown as SaveFile;
}

describe("Equipment omission (no xsi:nil for equipment) on Inventory serialization", () => {
	it("omits all equipment nodes when unset", () => {
		const player = minimalPlayer();
		withRoot(() => {
			// prime and keep Inventory authoritative
			// eslint-disable-next-line no-new
			new Inventory(player);
		});
		flushSync();

		const xml = xmlFromSave(wrapSave(player));
		const pxml = getPlayerXml(xml);

		const equipTags = [
			"hat",
			"shirtItem",
			"pantsItem",
			"boots",
			"leftRing",
			"rightRing",
		] as const;
		for (const tag of equipTags) {
			expect(new RegExp(`<${tag}\\b`).test(pxml)).toBe(false);
			expect(pxml.includes(`<${tag} xsi:nil="true"`)).toBe(false);
		}
	});

	it("setting then clearing a ring omits the node (no xsi:nil)", () => {
		const player = minimalPlayer();

		$effect.root(() => {
			const inv = new Inventory(player);

			// Set then clear
			inv.leftRing = Item.fromName("Ruby Ring");
			flushSync();

			// Clear it, it should be omitted
			inv.leftRing = undefined;
			flushSync();
			{
				const xml = xmlFromSave(wrapSave(player));
				const pxml = getPlayerXml(xml);
				expect(/<leftRing\b/.test(pxml)).toBe(false);
				expect(pxml.includes('<leftRing xsi:nil="true"')).toBe(false);
			}
		});
	});

	it("nil sentinel on equipment is normalized and removed from raw", () => {
		const player = {
			items: { Item: [] },
			leftRing: { "@_xsi:nil": "true" },
		} as unknown as Player;

		withRoot(() => {
			// eslint-disable-next-line no-new
			new Inventory(player);
		});
		flushSync();

		const xml = xmlFromSave(wrapSave(player));
		const pxml = getPlayerXml(xml);
		// leftRing node should be gone entirely
		expect(/<leftRing\b/.test(pxml)).toBe(false);
	});

	it("non-regression: items array continues to use nil sentinel for empty indices", () => {
		const player = minimalPlayer();
		const inv = withRoot(() => new Inventory(player));

		// Grow inventory; new slots are nil-sentinel-backed
		inv.adjustSlots(12);
		flushSync();

		const xml = xmlFromSave(wrapSave(player));
		// At least one Item entry should be rendered with xsi:nil="true"
		// fast-xml-parser outputs ' />' due to our post-processing in XMLManager
		expect(xml.includes('<Item xsi:nil="true" />')).toBe(true);
	});
});
