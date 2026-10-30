import type { SessionState } from "./domain.ts";

// A completed root is deeply frozen, so neither its shape nor alias classification
// can change. Weak keys let abandoned revisions and their save graphs be collected.
const frozenRoots = new WeakMap<SessionState, boolean>();

/**
 * Freeze privately owned, already JSON-validated staging data and report whether
 * every object has exactly one path from the root. Copy-on-write producers need
 * that tree contract; acyclic shared references must use the detached fallback.
 * Never pass caller-owned data: this deliberately freezes the supplied graph.
 */
export function freezeDraftState(state: SessionState): boolean {
	const cached = frozenRoots.get(state);
	if (cached !== undefined) return cached;

	const seen = new WeakSet<object>();
	const pending: object[] = [state];
	let tree = true;
	while (pending.length > 0) {
		const value = pending.pop();
		if (!value) break;
		// Reaching the same object twice reveals an alias even if that object was
		// frozen in an earlier revision. Skip only its children, not this check.
		if (seen.has(value)) {
			tree = false;
			continue;
		}
		seen.add(value);
		for (const child of Object.values(value)) {
			if (child !== null && typeof child === "object") pending.push(child);
		}
		// Freezing owned descendants protects against reflection through a draft's
		// property descriptors, which can expose base objects outside the proxy.
		if (!Object.isFrozen(value)) Object.freeze(value);
	}

	// Cache only complete roots. Caching independent subtree results could miss an
	// object shared across two otherwise tree-shaped, previously frozen branches.
	frozenRoots.set(state, tree);
	return tree;
}
