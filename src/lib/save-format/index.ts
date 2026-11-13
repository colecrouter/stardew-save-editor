// Construction API for generated modules. Application consumers use the generated
// schemas and types; reader frames remain internal to the runtime implementation.
export { object, polymorphic } from "./objects.ts";
export type { ScalarObject, UnknownObject } from "./objects.ts";
export {
	scalar,
	text,
	nullable,
	sequence,
	wrapped,
	single,
	optionalReference,
} from "./values.ts";
export type { Codec } from "./values.ts";
export { dictionary } from "./dictionary.ts";
export { document, decodeChunks } from "./xml.ts";
export { nullableEnumText } from "./enum-text.ts";

export { lazy } from "./events.ts";
