import { TypeIds } from "../../../generated/save-format/save.ts";

// The discriminator is model data, not an XML attribute. Views use the game's
// familiar type name; constructors resolve it through the generated catalog.
export function savedType(value: unknown): string | undefined {
	if (
		value === null ||
		typeof value !== "object" ||
		!("$type" in value) ||
		typeof value.$type !== "string"
	)
		return undefined;
	// Opaque XML type names are display metadata, not proof of a built-in class.
	// Returning no known type keeps namespaced mod classes out of typed editors.
	if (value.$type === "$unknown") return undefined;
	return value.$type.split(/[.+]/).at(-1);
}
export function savedTypeId(name: string): string {
	if (!Object.hasOwn(TypeIds, name))
		throw new Error(`Unknown saved type ${name}`);
	return TypeIds[name as keyof typeof TypeIds];
}
