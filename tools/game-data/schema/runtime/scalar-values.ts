import type { Schema } from "effect";
import { scalarTypes } from "../mappings/scalars.ts";
import type { TextValue } from "./values.ts";
import { textValue } from "./values.ts";

// Retain each registry entry's decoded type while lifting its text codec into a
// composable XML value. The mapped assertion preserves the key/schema pairing
// that Object.entries/fromEntries otherwise widen to a heterogeneous union.
export const scalarValues = Object.fromEntries(
	Object.entries(scalarTypes).map(([id, scalar]) => [
		id,
		textValue(
			scalar.codec as Schema.Codec<unknown, string>,
			scalar.xmlItemName,
		),
	]),
) as {
	[K in keyof typeof scalarTypes]: TextValue<
		(typeof scalarTypes)[K]["codec"]["Type"]
	>;
};
const stringValue = scalarValues["System.String"];
const booleanValue = scalarValues["System.Boolean"];
export { stringValue as String, booleanValue as Boolean };
export const Byte = scalarValues["System.Byte"];
export const Int32 = scalarValues["System.Int32"];
export const UInt32 = scalarValues["System.UInt32"];
export const Int64 = scalarValues["System.Int64"];
export const UInt64 = scalarValues["System.UInt64"];
export const Single = scalarValues["System.Single"];

export const Double = scalarValues["System.Double"];

export const Guid = scalarValues["System.Guid"];
export type Guid = typeof Guid.Type;
