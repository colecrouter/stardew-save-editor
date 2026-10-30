import type { SessionState } from "./domain.ts";

/** Report whether privately owned, JSON-validated staging data is a tree.
 * Copy-on-write producers require one path to each object; shared references
 * use detached mutation so writes through an alias retain their existing meaning.
 */
export function isDraftStateTree(state: SessionState): boolean {
	const seen = new WeakSet<object>();
	const pending: object[] = [state];
	while (pending.length > 0) {
		const value = pending.pop();
		if (!value) break;
		// A second path to any object requires the alias-preserving fallback.
		if (seen.has(value)) return false;
		seen.add(value);
		for (const child of Object.values(value)) {
			if (child !== null && typeof child === "object") pending.push(child);
		}
	}
	// Do not cache classifications: staging is privately owned, but this helper
	// does not freeze it or enforce the owner's no-mutation contract.
	return true;
}
