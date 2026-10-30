import type { EditorModel } from "./editor-model.ts";
import type { InventoryView, InventorySlotView } from "./inventory-views.ts";
import {
	setStorageQuality,
	type StorageItemHandle,
} from "./storage-operations.ts";

/** Storage composition needs only typed commands, never a saved document or draft. */
type StoragePort = {
	readonly commands: Pick<EditorModel["commands"], "execute" | "transact">;
};
export interface StorageMatch {
	readonly owner: InventoryView;
	readonly item: InventorySlotView;
}
/** Search contents across every supplied container; item IDs remain useful for untranslated/modded names. */
export function searchStorage(
	owners: readonly InventoryView[],
	query: string,
): StorageMatch[] {
	const needle = query.trim().toLocaleLowerCase();
	return owners.flatMap((owner) =>
		owner.slots
			.filter(
				(item) =>
					!item.empty &&
					(!needle ||
						`${item.name} ${item.itemId}`.toLocaleLowerCase().includes(needle)),
			)
			.map((item) => ({ owner, item })),
	);
}
/** Bind commands to captured owner/instance handles; queue resolution owns slot positions. */
export function createStorageDomain(port: StoragePort) {
	return {
		organize: (ownerId: string) =>
			port.commands.execute([{ type: "inventory-organize", ownerId }]),
		organizeAll: (ownerIds: readonly string[]) =>
			port.commands.execute(
				ownerIds.map((ownerId) => ({ type: "inventory-organize", ownerId })),
			),
		transfer: (sources: readonly StorageItemHandle[], ownerId: string) =>
			port.commands.execute([{ type: "inventory-transfer", ownerId, sources }]),
		changeType: (ownerId: string, itemId: string) =>
			port.commands.execute([{ type: "chest-type", ownerId, itemId }]),
		quality: (items: readonly StorageItemHandle[], quality: number) =>
			port.commands.transact(setStorageQuality(items, quality)),
	};
}
