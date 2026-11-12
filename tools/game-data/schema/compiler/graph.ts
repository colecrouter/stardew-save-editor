import type { CompilationContract, ValueContract } from "./contract.ts";

// Nested serializer payloads still introduce references to ordinary CLR objects.
// Use the same traversal for cycle detection and deciding which wrappers to emit.
export function referencedTypes(value: ValueContract): string[] {
	if (value.kind === "object") return [value.type];
	if (value.kind === "nullable") return referencedTypes(value.value);
	if (value.kind === "inventory" || value.kind === "array")
		return referencedTypes(value.item);
	if (value.kind === "dictionary")
		return [...referencedTypes(value.key), ...referencedTypes(value.value)];
	return [];
}

export function recursiveObjects(
	contract: CompilationContract,
): ReadonlySet<string> {
	const objects = new Map(
		contract.objects.map((object) => [object.clrType, object]),
	);
	const indices = new Map<string, number>();
	const low = new Map<string, number>();
	const stack: string[] = [];
	const active = new Set<string>();
	const recursive = new Set<string>();
	let next = 0;
	function visit(id: string): void {
		const object = objects.get(id);
		if (!object) throw new Error(`Missing object contract ${id}`);
		// Tarjan's traversal groups mutually dependent declarations. Acyclic parents
		// of a recursive group must stay outside it so their schemas can infer types.
		const index = next++;
		indices.set(id, index);
		low.set(id, index);
		stack.push(id);
		active.add(id);
		const dependencies = [
			...new Set([
				...object.fields.flatMap((field) => referencedTypes(field.value)),
				...object.variants.filter((variant) => variant !== id),
			]),
		];
		for (const dependency of dependencies) {
			if (!indices.has(dependency)) {
				visit(dependency);
				low.set(
					id,
					Math.min(low.get(id) ?? index, low.get(dependency) ?? index),
				);
			} else if (active.has(dependency)) {
				low.set(
					id,
					Math.min(low.get(id) ?? index, indices.get(dependency) ?? index),
				);
			}
		}
		if (low.get(id) !== index) return;
		const component: string[] = [];
		let member: string | undefined;
		do {
			member = stack.pop();
			if (member === undefined)
				throw new Error("Incomplete recursive component");
			active.delete(member);
			component.push(member);
		} while (member !== id);
		// Reuse of a completed child is not recursion. Single-node components only
		// need annotations when their own fields refer back to their declared type.
		if (component.length > 1 || dependencies.includes(id))
			for (const candidate of component) recursive.add(candidate);
	}
	for (const object of contract.objects)
		if (!indices.has(object.clrType)) visit(object.clrType);
	return recursive;
}
