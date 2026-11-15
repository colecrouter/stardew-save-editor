/** Narrow opaque records before reading extension fields; arrays retain a separate representation. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/** Keep array elements unknown until their consumer validates the element contract. */
export const isUnknownArray = (value: unknown): value is unknown[] =>
	Array.isArray(value);

/** An own-key check narrows lookup keys without admitting inherited properties. */
export const hasOwnKey = <T extends object>(
	value: T,
	key: PropertyKey,
): key is keyof T => Object.hasOwn(value, key);
