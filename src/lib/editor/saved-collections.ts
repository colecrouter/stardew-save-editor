/** Tolerant collection readers used at feature boundaries; inspection never normalizes saved data. */
export const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const empty = (value: unknown) =>
	value === undefined || value === null || value === "";
export const list = (value: unknown): unknown[] =>
	empty(value) ? [] : Array.isArray(value) ? value : [value];
/** Read XML empty/singleton/array collections without changing their saved shape. */
export function collection(raw: unknown, key: string) {
	const supported =
		empty(raw) ||
		(record(raw) &&
			(empty(raw[key]) || Array.isArray(raw[key]) || record(raw[key])));
	return { raw, entries: record(raw) ? list(raw[key]) : [], supported };
}
/** Deliberate insertion may expand a singleton; retained container members remain untouched. */
export function append(raw: unknown, key: string, value: unknown) {
	return {
		...(record(raw) ? raw : {}),
		[key]: [...collection(raw, key).entries, value],
	};
}
