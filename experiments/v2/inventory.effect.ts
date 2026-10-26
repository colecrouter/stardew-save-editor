import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { get } from "svelte/store";
import { exportDocument, loadFixture, parser } from "./fixture.ts";
import { makeAtomInventory } from "./inventory-atoms.ts";
import { type InventoryModel, openInventory } from "./inventory-model.ts";
import { makeStoreInventory } from "./inventory-stores.ts";

async function until(check: () => boolean) {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 2));
	}
	throw new Error("Inventory observation did not settle");
}
function mount(model: InventoryModel) {
	const stop = [
		model.items,
		model.selected,
		model.money,
		model.canUndo,
		model.canRedo,
		model.count,
		model.error,
	].map((store) => store.subscribe(() => {}));
	return () => {
		for (const unsubscribe of stop) unsubscribe();
	};
}

for (const [name, factory] of [
	["Atom", makeAtomInventory],
	["store", makeStoreInventory],
] as const) {
	it.effect(
		`${name}: real-save item edit exports only the intended change`,
		() =>
			Effect.gen(function* () {
				const baseline = yield* Effect.promise(loadFixture);
				const opened = yield* Effect.promise(() =>
					openInventory(factory, baseline),
				);
				const stop = mount(opened.model);
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						await opened.close();
					}),
				);
				const selected = get(opened.model.items).find((item) => item.editable);
				if (!selected)
					throw new Error("Fixture has no supported stackable object");
				opened.model.chooseSlot(selected.slot);
				const value = selected.stack < 999 ? selected.stack + 1 : 998;
				opened.model.stack.set(value);
				yield* Effect.promise(() => until(() => get(opened.model.count) === 1));
				const state = yield* opened.session.snapshot;
				const expected = structuredClone(baseline);
				const item = expected.SaveGame.player.items.Item[
					selected.slot
				] as Record<string, unknown>;
				item.stack = value;
				expect(state.document).toEqual(expected);
				expect(parser.parse(exportDocument(state.document))).toEqual(expected);
			}),
	);
	it.effect(
		`${name}: field writes, undo, redo and compact reorder preserve history`,
		() =>
			Effect.gen(function* () {
				const opened = yield* Effect.promise(() => openInventory(factory));
				const stop = mount(opened.model);
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						await opened.close();
					}),
				);
				const model = opened.model;
				model.stack.set(7);
				yield* Effect.promise(() =>
					until(() => get(model.selected)?.stack === 7),
				);
				const state = yield* opened.session.snapshot;
				expect(state.cursor).toBe(1);
				expect(state.entries[0].actions[0].type).toBe("item-stack");
				expect(state.document.SaveGame.player.items.Item[0]).toMatchObject({
					stack: 7,
					modData: { keep: "007" },
				});
				model.undo();
				yield* Effect.promise(() =>
					until(() => get(model.selected)?.stack === 2),
				);
				model.redo();
				yield* Effect.promise(() =>
					until(() => get(model.selected)?.stack === 7),
				);
				model.reverse();
				yield* Effect.promise(() =>
					until(() => get(model.items)[0].name === "Empty"),
				);
				expect((yield* opened.session.snapshot).entries[1].intent.review).toBe(
					"compact",
				);
			}),
	);

	it.effect(
		`${name}: invalid writes are observable and do not advance history`,
		() =>
			Effect.gen(function* () {
				const opened = yield* Effect.promise(() => openInventory(factory));
				const stop = mount(opened.model);
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						await opened.close();
					}),
				);
				opened.model.stack.set(0);
				yield* Effect.promise(() =>
					until(() => get(opened.model.error).length > 0),
				);
				expect((yield* opened.session.snapshot).cursor).toBe(0);
				opened.model.stack.set(5);
				yield* Effect.promise(() =>
					until(() => get(opened.model.selected)?.stack === 5),
				);
				expect(get(opened.model.error)).toBe("");
				opened.model.chooseSlot(2);
				opened.model.stack.set(10);
				yield* Effect.promise(() =>
					until(() => get(opened.model.error).length > 0),
				);
				expect((yield* opened.session.snapshot).cursor).toBe(1);
			}),
	);

	it.effect(
		`${name}: changing selection cannot retarget a submitted mutation`,
		() =>
			Effect.gen(function* () {
				const opened = yield* Effect.promise(() => openInventory(factory));
				const stop = mount(opened.model);
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						await opened.close();
					}),
				);
				opened.model.stack.set(9);
				opened.model.chooseFarmer("guest");
				yield* Effect.promise(() => until(() => get(opened.model.count) === 1));
				expect(get(opened.model.selected)?.name).toBe("Stone");
				expect(get(opened.model.selected)?.stack).toBe(12);
				expect(
					(yield* opened.session.snapshot).document.SaveGame.player.items
						.Item[0],
				).toMatchObject({ stack: 9 });
			}),
	);

	it.effect(
		`${name}: unrelated money edits do not notify item subscribers`,
		() =>
			Effect.gen(function* () {
				const opened = yield* Effect.promise(() => openInventory(factory));
				let notifications = 0;
				const stop = opened.model.items.subscribe(() => {
					notifications++;
				});
				const stopMoney = opened.model.money.subscribe(() => {});
				yield* Effect.addFinalizer(() =>
					Effect.promise(async () => {
						stop();
						stopMoney();
						await opened.close();
					}),
				);
				yield* Effect.promise(() =>
					until(() => opened.model.debug().liveStreams === 1),
				);
				const before = notifications;
				yield* opened.session.execute([
					{ type: "money", farmerId: "host", value: 99 },
				]);
				yield* Effect.promise(() =>
					until(() => get(opened.model.money) === 99),
				);
				expect(notifications).toBe(before);
				let selectedNotifications = 0;
				const stopSelected = opened.model.selected.subscribe(() => {
					selectedNotifications++;
				});
				const selectedBefore = selectedNotifications;
				yield* opened.session.execute([
					{
						type: "item-stack",
						farmerId: "host",
						slot: 1,
						itemId: "388",
						value: 60,
					},
				]);
				yield* Effect.promise(() =>
					until(() => get(opened.model.items)[1].stack === 60),
				);
				expect(selectedNotifications).toBe(selectedBefore);
				stopSelected();
			}),
	);

	it.effect(
		`${name}: consumer removal and repeated session closure release streams`,
		() =>
			Effect.gen(function* () {
				for (let index = 0; index < 10; index++) {
					const opened = yield* Effect.promise(() => openInventory(factory));
					const stop = mount(opened.model);
					yield* Effect.promise(() =>
						until(() => opened.model.debug().liveStreams === 1),
					);
					stop();
					yield* Effect.promise(() =>
						until(() => opened.model.debug().liveStreams === 0),
					);
					yield* opened.session.execute([
						{
							type: "item-stack",
							farmerId: "host",
							slot: 0,
							itemId: "72",
							value: 7,
						},
					]);
					const forgotten = mount(opened.model);
					expect(get(opened.model.selected)?.stack).toBe(7);
					yield* Effect.promise(() =>
						until(() => opened.model.debug().liveStreams === 1),
					);
					yield* Effect.promise(opened.close);
					expect(opened.model.debug().liveStreams).toBe(0);
					expect(opened.model.debug().nodes).toBe(0);
					forgotten();
				}
			}),
	);
}
