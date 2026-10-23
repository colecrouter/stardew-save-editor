import { vi } from "vitest";
import { Dispose } from "$lib/proxies";
import { Item } from "$lib/proxies/Item.svelte";

export interface TrackedItem {
	name: string;
	/** How many times the item has been disposed */
	disposed: number;
}

/**
 * Record every item `Item.fromName` creates from now on, and how often each is
 * disposed. Undo with `vi.restoreAllMocks()`.
 */
export function trackItems() {
	const created: TrackedItem[] = [];
	const fromName = Item.fromName.bind(Item);
	vi.spyOn(Item, "fromName").mockImplementation((name) => {
		const item = fromName(name);
		const tracked = { name, disposed: 0 };
		const dispose = item[Dispose];
		item[Dispose] = () => {
			tracked.disposed++;
			dispose?.();
		};
		created.push(tracked);
		return item;
	});
	return created;
}
