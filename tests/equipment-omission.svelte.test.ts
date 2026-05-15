import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { Player } from "../codegen/save";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item } from "../src/lib/proxies/Item.svelte";
import { Raw } from "../src/lib/proxies/index";
import { RingProxy } from "../src/lib/proxies/items";
import { XMLManager } from "../src/lib/workers/xml";

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
			inv.set("leftRing", Item.fromName("Ruby Ring"));
			flushSync();

			// Clear it, it should be omitted
			inv.set("leftRing", undefined);
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

	it("preserves explicit CombinedRing xsi:type and nested rings in equipment slots", () => {
		const sourceXml = `<?xml version="1.0" encoding="utf-8"?>
<SaveGame>
	<player>
		<items>
			<Item xsi:nil="true" />
		</items>
		<leftRing xsi:type="CombinedRing">
			<isLostItem>false</isLostItem>
			<category>-96</category>
			<hasBeenInInventory>true</hasBeenInInventory>
			<name>Combined Ring</name>
			<parentSheetIndex>880</parentSheetIndex>
			<itemId>880</itemId>
			<price>100</price>
			<indexInTileSheet>880</indexInTileSheet>
			<uniqueID>12345</uniqueID>
			<combinedRings>
				<Ring>
					<isLostItem>false</isLostItem>
					<category>-96</category>
					<hasBeenInInventory>true</hasBeenInInventory>
					<name>Lucky Ring</name>
					<parentSheetIndex>859</parentSheetIndex>
					<itemId>859</itemId>
					<price>200</price>
					<indexInTileSheet>859</indexInTileSheet>
					<uniqueID>12346</uniqueID>
				</Ring>
				<Ring>
					<isLostItem>false</isLostItem>
					<category>-96</category>
					<hasBeenInInventory>true</hasBeenInInventory>
					<name>Burglar's Ring</name>
					<parentSheetIndex>526</parentSheetIndex>
					<itemId>526</itemId>
					<price>1500</price>
					<indexInTileSheet>526</indexInTileSheet>
					<uniqueID>12347</uniqueID>
				</Ring>
			</combinedRings>
		</leftRing>
	</player>
</SaveGame>`;
		const mgr = new XMLManager();
		const save = mgr.parse<SaveFile>(sourceXml);
		const player = save.SaveGame.player;
		if (!Array.isArray(player.items.Item)) {
			player.items.Item = [player.items.Item];
		}

		const inv = withRoot(() => new Inventory(player));
		const leftRing = inv.get("leftRing");

		expect(leftRing).toBeInstanceOf(RingProxy);
		expect(leftRing?.[Raw]["@_xsi:type"]).toBe("CombinedRing");

		const xml = xmlFromSave(save);
		expect(xml).toContain('<leftRing xsi:type="CombinedRing">');
		expect(xml).toContain("<combinedRings>");
		expect(xml).toContain("<name>Lucky Ring</name>");
		expect(xml).toContain("<name>Burglar's Ring</name>");
	});
});
