import type { Subscriber } from "svelte/store";
import { vi } from "vitest";

vi.mock("$app/stores", async () => {
	const { readable, writable } = await import("svelte/store");
	/**
	 * @type {import('$app/stores').getStores}
	 */
	const getStores = () => ({
		navigating: readable(null),
		page: readable({ url: new URL("http://localhost"), params: {} }),
		session: writable(null),
		updated: readable(false),
	});
	/** @type {typeof import('$app/stores').page} */
	const page = {
		subscribe(fn: Subscriber<{ url: URL; params: Record<string, unknown> }>) {
			return getStores().page.subscribe(fn);
		},
	};
	/** @type {typeof import('$app/stores').navigating} */
	const navigating = {
		subscribe(fn: Subscriber<null>) {
			return getStores().navigating.subscribe(fn);
		},
	};
	/** @type {typeof import('$app/stores').session} */
	const session = {
		subscribe(fn: Subscriber<null>) {
			return getStores().session.subscribe(fn);
		},
	};
	/** @type {typeof import('$app/stores').updated} */
	const updated = {
		subscribe(fn: Subscriber<boolean>) {
			return getStores().updated.subscribe(fn);
		},
	};
	return {
		getStores,
		navigating,
		page,
		session,
		updated,
	};
});
