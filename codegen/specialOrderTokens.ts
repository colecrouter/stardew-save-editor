export interface RandomizedElement {
	Name: string;
	Values: { RequiredTags: string; Value: string }[];
}

/** Resolve fixed special-order substitutions; actual random choices need runtime support. */
export function createSpecialOrderResolver(
	questKey: string,
	elements: RandomizedElement[] | null | undefined,
	strings: Record<string, string>,
) {
	const substitutions = new Map<string, string>();
	for (const element of elements ?? []) {
		const [value] = element.Values;
		if (element.Values.length !== 1 || !value || value.RequiredTags) {
			throw new Error(
				`${questKey}: ${element.Name} requires runtime selection`,
			);
		}
		const fields = value.Value.split("|");
		for (let i = 0; i < fields.length; i += 2) {
			const key = fields[i];
			const fieldValue = fields[i + 1];
			if (!key || fieldValue === undefined) {
				throw new Error(`${questKey}: invalid ${element.Name} substitution`);
			}
			substitutions.set(`${element.Name}:${key}`, fieldValue);
		}
	}

	return function resolve(text: string, depth = 0): string {
		if (depth > 10) throw new Error(`${questKey}: cyclic objective tokens`);
		return text.replace(
			/\[([^[\]]+)\]|\{([^{}]+)\}/g,
			(
				token,
				stringKey: string | undefined,
				elementKey: string | undefined,
			) => {
				const value =
					stringKey !== undefined
						? strings[stringKey]
						: substitutions.get(elementKey ?? "");
				if (value === undefined) {
					throw new Error(`${questKey}: unresolved objective token ${token}`);
				}
				return resolve(value, depth + 1);
			},
		);
	};
}

export function parseRequiredCount(value: string): number {
	const count = Number(value);
	if (!Number.isSafeInteger(count) || count <= 0) {
		throw new Error(`Invalid special-order objective count: ${value}`);
	}
	return count;
}
