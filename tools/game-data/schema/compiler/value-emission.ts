import { structures } from "../mappings/structures.ts";
import type { FieldContract, ValueContract } from "./contract.ts";
import { isElementValue } from "./contract.ts";
import type { EmissionPlan } from "./emission-plan.ts";

const quote = (value: string) => JSON.stringify(value);
export function propertyName(name: string): string {
	// Computed keys keep arbitrary CLR names, including __proto__, as own fields.
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && name !== "__proto__"
		? name
		: `[${quote(name)}]`;
}
export class ValueEmission {
	readonly declarations: string[] = [];
	readonly scalarTypes = new Map<string, string>();
	readonly neededObjects = new Set<string>();
	usesSchema = false;
	usesDictionaryType = false;
	usesInventoryType = false;
	private readonly counts = new Map<string, number>();
	private readonly definitions = new Map<string, string>();
	private readonly plan: EmissionPlan;
	constructor(plan: EmissionPlan) {
		this.plan = plan;
		const count = (value: ValueContract): void => {
			const key = JSON.stringify(value);
			this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
			if (value.kind === "nullable") count(value.value);
			if (value.kind === "array" || value.kind === "inventory")
				count(value.item);
			if (value.kind === "dictionary") {
				count(value.key);
				count(value.value);
			}
		};
		// Count only bindings that will actually be printed. Inherited spreads do
		// not justify another codec constant when their fields already share one.
		for (const payload of plan.fieldPayloads)
			for (const field of payload.ownFields) count(field.value);
	}
	objectName(id: string): string {
		const name = this.plan.names.get(id);
		if (!name) throw new Error(`Unresolved object definition: ${id}`);
		return name;
	}
	private preferred(value: ValueContract): string {
		if (value.kind === "scalar" || value.kind === "enum")
			return `${value.type.split(/[.+]/).at(-1)}${value.kind === "enum" && value.nullable ? "Text" : ""}Codec`;
		if (value.kind === "object")
			return `${this.objectName(value.type)}Reference`;
		if (value.kind === "nullable")
			return `${this.preferred(value.value).replace(/(?:Codec|Reference)$/, "")}OrNullCodec`;
		if (value.kind === "array")
			return `${this.preferred(value.item).replace(/(?:Codec|Reference)$/, "")}ArrayCodec`;
		if (value.kind === "inventory") return "InventoryCodec";
		const comparison =
			value.keyIdentity === "ordinalIgnoreCase" ? "IgnoringCase" : "";
		return `${this.preferred(value.key).replace(/(?:Codec|Reference)$/, "")}To${this.preferred(value.value).replace(/(?:Codec|Reference)$/, "")}Dictionary${comparison}Codec`;
	}
	definition(value: ValueContract): string {
		const key = JSON.stringify(value);
		const previous = this.definitions.get(key);
		if (previous) return previous;
		// Scalars/enums get readable names even when used once. Larger composed
		// definitions are hoisted only when repeated, avoiding one-off indirection.
		const hoist =
			value.kind === "scalar" ||
			value.kind === "enum" ||
			(this.counts.get(key) ?? 0) > 1;
		if (!hoist) return this.inline(value);
		const name = this.plan.symbols.allocate(this.preferred(value));
		this.definitions.set(key, name);
		const expression = this.inline(value);
		// Children are emitted first. Object references inside composed values are
		// suspended, so reusable constants never read an uninitialized schema.
		this.declarations.push(`const ${name} = ${expression};`);
		return name;
	}
	private inline(value: ValueContract): string {
		if (value.kind === "scalar")
			return `Xml.scalarValues[${quote(value.type)}]`;
		if (value.kind === "enum")
			return value.nullable
				? `Xml.textValue(Xml.nullableEnumText([${value.labels.map(quote).join(", ")}]))`
				: `Xml.enumeration([${value.labels.map(quote).join(", ")}])`;
		if (value.kind === "nullable")
			return `Xml.nullable(${this.definition(value.value)})`;
		if (value.kind === "array")
			return `Xml.array(${this.definition(value.item)}, ${quote(value.itemName)})`;
		if (value.kind === "inventory")
			return `Xml.value(Xml.inventory(${this.codec(value.item)}))`;
		if (value.kind === "dictionary")
			return `Xml.value(Xml.dictionary(${quote(value.keyName)}, ${this.codec(value.key)}, ${quote(value.valueName)}, ${this.codec(value.value)}, ${isElementValue(value.value)}${value.keyIdentity ? `, ${quote(value.keyIdentity)}` : ""}))`;
		this.usesSchema = true;
		return `Xml.value(Schema.suspend(() => ${this.objectName(value.type)}Schema))`;
	}
	private codec(value: ValueContract): string {
		const definition = this.definition(value);
		if (value.kind === "scalar" || value.kind === "enum")
			return `${definition}.text`;
		// Array definitions are also codecs, and the dictionary needs their patch
		// capability. Other definitions expose the same raw codec as before via element.
		return value.kind === "array" ? definition : `${definition}.element`;
	}
	field(field: FieldContract): string {
		const shape = structures[field.kind];
		if (!("builder" in shape))
			throw new Error(`Unsupported emitted field shape ${field.kind}`);
		const args = [
			quote(field.xmlName),
			...("itemName" in field ? [quote(field.itemName)] : []),
			this.definition(field.value),
			...(field.maxItems === undefined ? [] : [String(field.maxItems)]),
		];
		const binding = `Xml.${shape.builder}(${args.join(", ")})`;
		return `\t${propertyName(field.memberName)}: ${field.optional ? `Xml.optional(${binding})` : binding},`;
	}
	type(value: ValueContract): string {
		if (value.kind === "scalar" || value.kind === "enum") {
			const definition = this.definition(value);
			const previous = this.scalarTypes.get(definition);
			if (previous) return previous;
			const short = value.type.split(/[.+]/).at(-1) ?? value.type;
			// Avoid names which would look like JavaScript's boxed primitive types.
			const stem = [
				"String",
				"Boolean",
				"Number",
				"Object",
				"Function",
				"Symbol",
				"BigInt",
			].includes(short)
				? `${short}Value`
				: short;
			const name = this.plan.symbols.allocate(
				`${stem}${value.kind === "enum" && value.nullable ? "Text" : ""}`,
			);
			this.scalarTypes.set(definition, name);
			return name;
		}
		if (value.kind === "object") {
			this.neededObjects.add(value.type);
			return this.objectName(value.type);
		}
		if (value.kind === "nullable") return `(${this.type(value.value)}) | null`;
		if (value.kind === "array")
			return `ReadonlyArray<${this.type(value.item)}>`;
		if (value.kind === "inventory") {
			this.usesInventoryType = true;
			return `InventorySlots<${this.type(value.item)}>`;
		}
		this.usesDictionaryType = true;
		return `DictionaryEntries<${this.type(value.key)}, ${this.type(value.value)}>`;
	}
	fieldType(field: FieldContract): string {
		const value = this.type(field.value);
		// The structural registry remains responsible for list multiplicity.
		const handler = structures[field.kind];
		return "multiple" in handler && handler.multiple
			? `ReadonlyArray<${value}>`
			: value;
	}
}
