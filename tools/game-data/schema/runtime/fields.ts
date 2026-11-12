// Preserve the existing runtime import path; the definitions and both directions
// of structural handling now live together in the shared registration module.

export type { Binding, EncodedValue, Field } from "../mappings/structures.ts";
export {
	attribute,
	collection,
	element,
	elements,
	nested,
	objectElements,
	objects,
	replaceField,
	selectField,
} from "../mappings/structures.ts";
