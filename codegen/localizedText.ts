/** Loads a strings file by asset name (e.g. `Strings\\Objects`), or undefined if it doesn't exist */
export type StringsLoader = (
	asset: string,
) => Record<string, string> | undefined;

/**
    Resolve the game's `[LocalizedText <asset>:<key> <args...>]` tokens, as used by
    the DisplayName/Description fields in Data/*.json, into plain text.

    Arguments replace `{0}`, `{1}`, etc. in the looked-up string. Returns undefined
    if the text isn't a token or the string can't be found.
*/
export function createLocalizedTextResolver(load: StringsLoader) {
	const cache = new Map<string, Record<string, string> | undefined>();

	return function resolve(text: string | null | undefined) {
		if (!text) return undefined;
		const match =
			/^\[LocalizedText ([^:\]]+):([^\s\]]+)((?: [^\s\]]+)*)\]$/.exec(text);
		if (!match?.[1] || !match[2]) return undefined;
		const [, asset, key, rawArgs = ""] = match;

		if (!cache.has(asset)) cache.set(asset, load(asset));
		const value = cache.get(asset)?.[key];
		if (value === undefined) return undefined;

		const args = rawArgs.trim().split(" ").filter(Boolean);
		return value.replace(/\{(\d+)\}/g, (token, index: string) => {
			return args[Number(index)] ?? token;
		});
	};
}
