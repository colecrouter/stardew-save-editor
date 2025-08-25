/**
 * Unique symbol to represent the raw player data inside of proxies.
 *
 * This enables us to programmatically access raw data from proxies when serializing, without needing runtime assertions.
 */
export const Raw = Symbol("RAW");

export interface DataProxy<T> {
	[Raw]: T;
}
