/** Public presentation data is readonly at every nested collection boundary. */
export type ImmutableView<T> = T extends object
	? { readonly [K in keyof T]: ImmutableView<T[K]> }
	: T;

/** Freeze newly projected plain presentation data before publication. Cached
 * views may then be shared safely between revisions; engine snapshots and draft
 * reads retain their separate detached, mutable contract. Never pass saved state. */
export function immutableView<T>(value: T): ImmutableView<T> {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		// Children must be frozen too: a readonly outer array cannot protect a
		// nested drawing layer, property option or item descriptor from mutation.
		for (const child of Object.values(value)) immutableView(child);
		Object.freeze(value);
	}
	// Recursive freezing establishes the readonly contract without changing its shape.
	return value as ImmutableView<T>;
}
