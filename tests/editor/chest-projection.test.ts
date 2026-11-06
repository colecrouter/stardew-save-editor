import { expect, it } from "vitest";
import { get } from "svelte/store";
import { Result } from "effect";
import {
	projectChests,
	readChests,
} from "../../src/lib/editor/inventory-views";
import { discoverPlacedChests } from "../../src/lib/editor/chest-storage";
import { freezeDraftState } from "../../src/lib/editor/draft-state";
import { openEditor } from "../../src/lib/editor/editor-model";
import { setInventoryItem } from "../../src/lib/editor/inventory-operations";
import { XMLCodec } from "../../src/lib/xmlCodec";
import { fixtureXml, parser, tinyFixture } from "./fixtures";

const chest = (name = "Chest") => ({
	"@_xsi:type": "Chest",
	name,
	items: {
		Item: [
			{
				"@_xsi:type": "Object",
				itemId: "24",
				name: "Parsnip",
				bigCraftable: false,
				category: -75,
				stack: 20,
				quality: 0,
				modData: { opaque: "007" },
			},
		],
	},
});
function state(
	raws: object[],
	options: { name?: string; x?: number; farmerId?: string } = {},
) {
	const document = tinyFixture();
	document.SaveGame.player.UniqueMultiplayerID = options.farmerId ?? "host";
	Object.assign(document.SaveGame, {
		locations: {
			GameLocation: [
				{
					name: options.name ?? "Farm",
					objects: {
						item: raws.map((raw, index) => ({
							key: { Vector2: { X: (options.x ?? 1) + index, Y: 2 } },
							value: { Object: raw },
						})),
					},
				},
			],
		},
	});
	const identities = Object.fromEntries(
		discoverPlacedChests(document).map((chest) => [
			chest.id,
			chest.slots.map((_, slot) => `${chest.id}:item:${slot}`),
		]),
	);
	// These private fixture graphs stand in for committed immutable revisions.
	// New revisions rebuild ancestors while preserving unchanged raw chest refs.
	freezeDraftState({ document, history: [] });
	return { document, identities };
}
const required = <A>(value: A | undefined): A => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

it.each([{ name: "Renamed ancestor" }, { x: 99 }])(
	"recomputes external chest labels for %j",
	(options) => {
		const raw = chest();
		const original = projectChests(state([raw]));
		const nextState = state([raw], options);
		const next = projectChests(nextState, original);
		expect(next.views).toEqual(readChests(nextState));
		expect(next.views[0]).not.toBe(original.views[0]);
	},
);

it("checks global collisions and current identity values before reusing a raw chest", () => {
	const raw = chest();
	const originalState = state([raw]);
	const original = projectChests(originalState);
	const id = required(original.views[0]).ownerId;
	const collisionState = state([raw], { farmerId: id });
	const collided = projectChests(collisionState, original);
	expect(collided.views).toEqual(readChests(collisionState));
	expect(collided.views[0]?.supported).toBe(false);
	const restored = projectChests(state([raw]), collided);
	expect(restored.views[0]?.supported).toBe(true);
	// Equal identity values in a newly allocated array remain reusable; a change
	// to their order must rebuild even though the saved chest is unchanged.
	expect(projectChests(state([raw]), restored).views).toBe(restored.views);
	const ids = required(originalState.identities[id]);
	const changed = {
		...originalState,
		identities: { ...originalState.identities, [id]: ids.toReversed() },
	};
	const next = projectChests(changed, original);
	expect(next.views).toEqual(readChests(changed));
	expect(next.views[0]).not.toBe(original.views[0]);
	const malformed = {
		...originalState,
		identities: { ...originalState.identities, [id]: [] },
	};
	expect(projectChests(malformed, next).views[0]?.supported).toBe(false);
});

it("evicts removed entries, keeps candidate generations independent and handles reordering", () => {
	const a = chest("First"),
		b = chest("Second");
	const original = projectChests(state([a, b]));
	const secondId = required(original.views[1]).ownerId;
	const removedState = state([a]);
	const removed = projectChests(removedState, original);
	expect(removed.views[0]).toBe(original.views[0]);
	expect(removed.lookup(b, secondId)).toBeUndefined();
	// Preparing a candidate cannot erase entries from the published generation.
	expect(original.lookup(b, secondId)).toBe(original.views[1]);
	const reinserted = projectChests(state([a, b]), removed);
	expect(reinserted.views[1]).not.toBe(original.views[1]);
	const reorderedState = state([b, a]);
	const reordered = projectChests(reorderedState, reinserted);
	expect(reordered.views).toEqual(readChests(reorderedState));
	expect(reordered.views[0]?.name).toContain("Second");
});

it("keeps aliased raw chests distinct by placed owner path", () => {
	const raw = chest();
	const initialState = state([raw, raw]);
	const original = projectChests(initialState);
	expect(original.views[0]?.ownerId).not.toBe(original.views[1]?.ownerId);
	expect(original.views[0]?.slots[0]?.entityId).not.toBe(
		original.views[1]?.slots[0]?.entityId,
	);
	const hit = projectChests(state([raw, raw]), original);
	expect(hit.views).toBe(original.views);
	const removed = projectChests(state([raw]), hit);
	expect(
		removed.lookup(raw, required(original.views[1]).ownerId),
	).toBeUndefined();
	expect(removed.views).toEqual(readChests(state([raw])));
});

it("reuses sibling views from the first item edit through Undo/Redo in the model", async () => {
	const document = parser.parse(fixtureXml);
	Object.assign(document.SaveGame, {
		locations: structuredClone(
			state([chest(), chest("Neighbor")]).document.SaveGame.locations,
		),
	});
	const opened = await openEditor(new XMLCodec().stringify(document));
	try {
		const original = required(get(opened.model.view)).chests;
		const selected = required(original[0]),
			neighbor = required(original[1]);
		const slot = required(selected.slots[0]);
		const result = await opened.model.commands.transact(
			setInventoryItem({
				ownerId: selected.ownerId,
				entityId: slot.entityId,
				property: "stack",
				value: 25,
			}),
		);
		expect(result && Result.isSuccess(result)).toBe(true);
		const edited = required(get(opened.model.view)).chests;
		expect(edited[0]?.slots[0]?.quantity).toBe(25);
		expect(edited[0]).not.toBe(selected);
		expect(edited[1]).toBe(neighbor);
		await opened.model.commands.undo();
		const undone = required(get(opened.model.view)).chests;
		expect(undone[0]?.slots[0]?.quantity).toBe(20);
		expect(undone[1]).toBe(neighbor);
		await opened.model.commands.redo();
		expect(required(get(opened.model.view)).chests[1]).toBe(neighbor);
	} finally {
		await opened.close();
	}
});
