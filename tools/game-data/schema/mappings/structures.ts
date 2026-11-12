import { isXmlValue } from "../runtime/values.ts";
import type { XmlValue, TextValue } from "../runtime/values.ts";
import * as Schema from "effect/Schema";
import { scalarTypes } from "./scalars.ts";
import type { XmlElement, XmlNode } from "../runtime/xml-tree.ts";
import {
	assertPlainElement,
	readElementText,
	replaceElementText,
} from "../runtime/xml-tree.ts";

// These are the supported XML slots. Adding a structural form starts here: define
// its binding data, codec constructor, selector, patcher, and registration below.
// The compiler derives its kind union from these bindings rather than copying it.
export interface StructureBindings {
	attribute: { readonly name: string };
	valueElement: {
		readonly name: string;
		readonly patch: XmlValue<unknown>["patch"];
	};
	valueElements: {
		readonly name: string;
		readonly patch: XmlValue<unknown>["patch"];
	};
	valueCollection: {
		readonly name: string;
		readonly item: string;
		readonly patch: XmlValue<unknown>["patch"];
	};
	boxed: {
		readonly name: string;
		readonly item: string;
		readonly aliases?: readonly string[];
	};
	boxedObject: { readonly name: string; readonly item: string };
	boxedValue: {
		readonly name: string;
		readonly item: string;
		readonly patch: XmlValue<unknown>["patch"];
	};
	element: { readonly name: string };
	elements: { readonly name: string };
	objectElements: { readonly name: string };
	object: { readonly name: string };
	collection: { readonly name: string; readonly item: string };
	objects: { readonly name: string; readonly item: string };
}
export type StructureKind = keyof StructureBindings;
export type Binding = {
	[K in StructureKind]: { readonly kind: K } & StructureBindings[K];
}[StructureKind] & { readonly optional?: true };
export type EncodedValue =
	| string
	| XmlElement
	| ReadonlyArray<string | XmlElement>;
export interface Field<
	S extends Schema.ConstraintCodec<unknown, EncodedValue> =
		Schema.ConstraintCodec<unknown, EncodedValue>,
> {
	readonly schema: S;
	readonly binding: Binding;
}

export function optional<
	S extends Schema.ConstraintCodec<unknown, EncodedValue>,
>(field: Field<S>): Field<Schema.optionalKey<S>> {
	const shape = structures[field.binding.kind];
	// Repeated siblings already model zero occurrences as an empty array. Boxed
	// dictionary payloads have a reviewed required contract rather than CLR-member
	// presence semantics. Only ordinary field builders can opt into absence.
	if (!("builder" in shape) || shape.builder === "repeatedValues")
		throw new Error(
			"Optional presence requires an attribute, element or wrapped collection",
		);
	return {
		schema: Schema.optionalKey(field.schema),
		binding: { ...field.binding, optional: true },
	};
}

// Keep S concrete so the generated object infers field types, including the
// nested envelope's .value, instead of widening everything to unknown.
export function element<S extends Schema.ConstraintCodec<unknown, string>>(
	name: string,
	schema: S,
): Field<S> {
	return { schema, binding: { kind: "element", name } };
}
// Nullable definitions intentionally have no text capability: attributes cannot
// carry xsi:nil, and absence is a separate field-presence policy.
export function attribute<A>(
	name: string,
	definition: TextValue<A>,
): Field<Schema.Codec<A, string>>;
export function attribute<S extends Schema.ConstraintCodec<unknown, string>>(
	name: string,
	schema: S,
): Field<S>;
export function attribute(
	name: string,
	input: Schema.ConstraintCodec<unknown, string> | TextValue<unknown>,
): Field {
	if (isXmlValue(input)) {
		if (!("text" in input))
			throw new Error("Nullable/element values cannot bind to attributes");
		return {
			schema: input.text as Schema.Codec<unknown, string>,
			binding: { kind: "attribute", name },
		};
	}
	return { schema: input, binding: { kind: "attribute", name } };
}
export function field<A>(
	name: string,
	definition: XmlValue<A>,
): Field<Schema.Codec<A, XmlElement>> {
	return {
		schema: definition.element,
		binding: { kind: "valueElement", name, patch: definition.patch },
	};
}
export function list<A>(
	name: string,
	item: string,
	definition: XmlValue<A>,
	maxItems?: number,
): Field<Schema.$Array<Schema.Codec<A, XmlElement>>> {
	return {
		schema: boundedArray(definition.element, maxItems),
		binding: { kind: "valueCollection", name, item, patch: definition.patch },
	};
}
export function repeatedValues<A>(
	name: string,
	definition: XmlValue<A>,
	maxItems?: number,
): Field<Schema.$Array<Schema.Codec<A, XmlElement>>> {
	return {
		schema: boundedArray(definition.element, maxItems),
		binding: { kind: "valueElements", name, patch: definition.patch },
	};
}

export function nested<S extends Schema.ConstraintCodec<unknown, XmlElement>>(
	name: string,
	schema: S,
): Field<S> {
	return { schema, binding: { kind: "object", name } };
}
// Cardinality belongs to the field schema, so both decode and encode enforce
// the inspector's single-value NetField contract while ordinary lists stay free.
function boundedArray<S extends Schema.Constraint>(
	schema: S,
	maxItems?: number,
): Schema.$Array<S> {
	const array = Schema.Array(schema);
	return maxItems === undefined
		? array
		: array.check(Schema.isMaxLength(maxItems));
}
export function collection<S extends Schema.ConstraintCodec<unknown, string>>(
	name: string,
	item: string,
	schema: S,
	maxItems?: number,
): Field<Schema.$Array<S>> {
	return {
		schema: boundedArray(schema, maxItems),
		binding: { kind: "collection", name, item },
	};
}
export function objects<S extends Schema.ConstraintCodec<unknown, XmlElement>>(
	name: string,
	item: string,
	schema: S,
	maxItems?: number,
): Field<Schema.$Array<S>> {
	return {
		schema: boundedArray(schema, maxItems),
		binding: { kind: "objects", name, item },
	};
}

// Repeated elements belong directly to the containing object. Their item codecs
// remain identical to wrapped collections; only selection and placement differ.
export function elements<S extends Schema.ConstraintCodec<unknown, string>>(
	name: string,
	schema: S,
	maxItems?: number,
): Field<Schema.$Array<S>> {
	return {
		schema: boundedArray(schema, maxItems),
		binding: { kind: "elements", name },
	};
}
export function objectElements<
	S extends Schema.ConstraintCodec<unknown, XmlElement>,
>(name: string, schema: S, maxItems?: number): Field<Schema.$Array<S>> {
	return {
		schema: boundedArray(schema, maxItems),
		binding: { kind: "objectElements", name },
	};
}
function repeated(original: XmlElement, binding: Binding): XmlElement[] {
	// No matching siblings represents an empty list, unlike a missing wrapper.
	return original.children.filter(
		(node): node is XmlElement =>
			node._tag === "Element" && node.name === binding.name,
	);
}

// Dictionary key/value wrappers contain a separately serialized payload element.
// These slots retain wrapper provenance in their entry's original XML tree.
export function boxed<S extends Schema.ConstraintCodec<unknown, string>>(
	name: string,
	item: string,
	schema: S,
	aliases: readonly string[] = [],
): Field<S> {
	return { schema, binding: { kind: "boxed", name, item, aliases } };
}
export function boxedObject<
	S extends Schema.ConstraintCodec<unknown, XmlElement>,
>(name: string, item: string, schema: S): Field<S> {
	return { schema, binding: { kind: "boxedObject", name, item } };
}
// A separately serialized dictionary payload can be a composable value (such as
// an array) whose patcher needs the original wrapper rather than a fresh tree.
export function boxedValue<A>(
	name: string,
	item: string,
	definition: XmlValue<A>,
): Field<Schema.Codec<A, XmlElement>> {
	return {
		schema: definition.element,
		binding: { kind: "boxedValue", name, item, patch: definition.patch },
	};
}

function scalarPayload(wrapper: XmlElement, binding: Binding): XmlElement {
	if (binding.kind !== "boxed")
		throw new Error("Expected boxed scalar binding");
	// Compatibility aliases belong to this reviewed serializer, not to every
	// string field. Require exactly one recognized payload, never choose a winner.
	const matches = wrapper.children.filter(
		(node): node is XmlElement =>
			node._tag === "Element" &&
			[binding.item, ...(binding.aliases ?? [])].includes(node.name),
	);
	const payload = matches[0];
	if (matches.length !== 1 || !payload)
		throw new Error(`${binding.name}: expected one dictionary payload`);
	return payload;
}

function payloadBinding(binding: Binding): Binding {
	if (!("item" in binding))
		throw new Error("Boxed payload requires an element name");
	return { kind: "object", name: binding.item };
}

function ownedElement(
	original: XmlElement,
	binding: Binding,
	allowType = false,
	validate = true,
): XmlElement {
	// An empty wrapper is present; a missing wrapper is not an empty list. Two
	// matching elements are ambiguous rather than an invitation to choose one.
	const matches = original.children.filter(
		(node): node is XmlElement =>
			node._tag === "Element" && node.name === binding.name,
	);
	const child = matches[0];
	if (matches.length !== 1 || !child)
		throw new Error(
			`${binding.name}: expected one element, found ${matches.length}`,
		);
	if (validate) assertPlainElement(child, allowType);
	return child;
}
function items(original: XmlElement, binding: Binding): XmlElement[] {
	if (!("item" in binding))
		throw new Error("Collection binding requires an item name");
	// Unknown wrapper children aren't list values, but remain in the original
	// tree for patching. Keep item order without interpreting unknown siblings.
	return ownedElement(original, binding).children.filter(
		(node): node is XmlElement =>
			node._tag === "Element" && node.name === binding.item,
	);
}
function patchElement(
	original: XmlElement,
	binding: Binding,
	update: (child: XmlElement) => XmlElement,
): XmlElement {
	// The selector has already checked presence and shape. Copy only the slot
	// this field owns; don't mutate the envelope retained for later edits/Undo.
	return {
		...original,
		children: original.children.map((node) =>
			node._tag === "Element" && node.name === binding.name
				? update(node)
				: node,
		),
	};
}
function patchItems(
	original: XmlElement,
	binding: Binding,
	values: readonly (string | XmlElement)[],
	patch?: XmlValue<unknown>["patch"],
): XmlElement {
	if (!("item" in binding))
		throw new Error("Collection binding requires an item name");
	return patchElement(original, binding, (wrapper) =>
		patchSiblings(wrapper, binding.item, values, false, patch),
	);
}
export function patchSiblings(
	parent: XmlElement,
	itemName: string,
	values: readonly (string | XmlElement)[],
	appendWhenEmpty: boolean,
	patch?: XmlValue<unknown>["patch"],
): XmlElement {
	// Both list forms reuse existing item positions. With no positions, wrapped
	// lists retain their established prepend behavior; direct lists append so they
	// do not displace the containing object's existing fields.
	let index = 0;
	let insertion = appendWhenEmpty ? parent.children.length : 0;
	const children: XmlNode[] = [];
	for (const child of parent.children) {
		if (child._tag !== "Element" || child.name !== itemName) {
			children.push(child);
			continue;
		}
		const next = values[index];
		// Scalar edits reuse the old item's attributes/comments. Nested objects
		// supply their own preserved tree after their codec has applied edits.
		if (next !== undefined) {
			children.push(
				typeof next === "string"
					? replaceElementText(child, next)
					: withName(patch ? patch(child, next) : next, itemName, parent),
			);
			index++;
		}
		// Missing next values remove known items only. Unknown siblings remain;
		// new items follow the last old slot; the empty-list policy is chosen above.
		insertion = children.length;
	}
	children.splice(
		insertion,
		0,
		...values.slice(index).map((next): XmlElement =>
			typeof next === "string"
				? {
						_tag: "Element",
						name: itemName,
						attributes: {},
						children: [{ _tag: "Text", text: next }],
					}
				: withName(next, itemName, parent),
		),
	);
	return { ...parent, children };
}
function withName(
	value: XmlElement,
	name: string,
	parent: XmlElement,
): XmlElement {
	// The enclosing field/item declaration owns its element name. A reusable CLR
	// object can appear as Shipping and Billing, regardless of its XmlRoot name.
	// Moving a preserved object can change the inherited prefix bindings. Carry
	// bindings that would otherwise change meaning, including ones used by unknown
	// child XML, without adding declarations when it stays under the same scope.
	const attributes = { ...value.attributes };
	for (const [prefix, uri] of Object.entries(value.namespaces ?? {})) {
		if (!prefix || prefix === "xml") continue;
		const key = `xmlns:${prefix}`;
		const inherited = parent.attributes[key] ?? parent.namespaces?.[prefix];
		if (attributes[key] === undefined && inherited !== uri)
			attributes[key] = uri;
	}
	return { ...value, name, attributes };
}

interface StructureHandler {
	readonly annotation?: string;
	// Generated source selects a placement builder here, independently of values.
	readonly builder?: "field" | "attribute" | "list" | "repeatedValues";
	// Generated recursive types use this multiplicity alongside the codec factory.
	readonly multiple?: true;
	// Factory argument lists differ by shape. This common type checks the
	// result only; satisfies preserves each factory's concrete generic signature
	// so generated calls still get full argument checks and type inference.
	readonly field: (...args: never[]) => Field;
	readonly select: (original: XmlElement, binding: Binding) => EncodedValue;
	readonly replace: (
		original: XmlElement,
		binding: Binding,
		value: EncodedValue,
	) => XmlElement;
}

// This is the single registration point for structural support. The annotation
// links CLR metadata to a slot; field preserves schema inference; select/replace
// define both runtime directions. satisfies makes missing registrations an error.
export const structures = {
	boxed: {
		field: boxed,
		select: (original, binding) => {
			const payload = scalarPayload(ownedElement(original, binding), binding);
			const text = readElementText(payload);
			// Legacy integer payloads are CLR Int32 values converted to a string by the
			// game's reader. Validate bounds and discard numeric spelling in typed data.
			return payload.name === "int" &&
				binding.kind === "boxed" &&
				binding.item === "string"
				? String(Schema.decodeSync(scalarTypes["System.Int32"].codec)(text))
				: text;
		},
		replace: (original, binding, value) =>
			patchElement(original, binding, (wrapper) => {
				const payload = scalarPayload(wrapper, binding);
				// Edits write the current serializer's canonical payload name. Unedited
				// legacy spellings bypass replacement and remain in the original XML.
				return patchElement(
					wrapper,
					{ kind: "element", name: payload.name },
					(child) =>
						withName(
							replaceElementText(child, value as string),
							payloadBinding(binding).name,
							wrapper,
						),
				);
			}),
	},
	boxedValue: {
		field: boxedValue,
		select: (original, binding) =>
			ownedElement(
				ownedElement(original, binding),
				payloadBinding(binding),
				false,
				false,
			),
		replace: (original, binding, value) => {
			if (!("patch" in binding))
				throw new Error("Value payload requires a patcher");
			return patchElement(original, binding, (wrapper) =>
				patchElement(wrapper, payloadBinding(binding), (child) =>
					withName(
						binding.patch(child, value as XmlElement),
						payloadBinding(binding).name,
						wrapper,
					),
				),
			);
		},
	},

	boxedObject: {
		field: boxedObject,
		select: (original, binding) =>
			ownedElement(
				ownedElement(original, binding),
				payloadBinding(binding),
				true,
			),
		replace: (original, binding, value) =>
			patchElement(original, binding, (wrapper) =>
				patchElement(wrapper, payloadBinding(binding), () =>
					withName(value as XmlElement, payloadBinding(binding).name, wrapper),
				),
			),
	},

	valueElement: {
		builder: "field",
		field,
		select: (original, binding) =>
			ownedElement(original, binding, false, false),
		replace: (original, binding, value) => {
			if (!("patch" in binding))
				throw new Error("Value binding requires patch behavior");
			return patchElement(original, binding, (child) =>
				withName(
					binding.patch(child, value as XmlElement),
					binding.name,
					original,
				),
			);
		},
	},
	valueElements: {
		builder: "repeatedValues",
		multiple: true,
		field: repeatedValues,
		select: repeated,
		replace: (original, binding, value) => {
			if (!("patch" in binding))
				throw new Error("Value binding requires patch behavior");
			return patchSiblings(
				original,
				binding.name,
				value as readonly XmlElement[],
				true,
				binding.patch,
			);
		},
	},
	valueCollection: {
		builder: "list",
		multiple: true,
		field: list,
		select: items,
		replace: (original, binding, value) => {
			if (!("patch" in binding))
				throw new Error("Value binding requires patch behavior");
			return patchItems(
				original,
				binding,
				value as readonly XmlElement[],
				binding.patch,
			);
		},
	},

	attribute: {
		builder: "attribute",
		annotation: "System.Xml.Serialization.XmlAttributeAttribute",
		field: attribute,
		select: (original, binding) => {
			const value = original.attributes[binding.name];
			// Empty text is valid; only undefined means the attribute is absent.
			if (value === undefined)
				throw new Error(`Missing attribute ${binding.name}`);
			return value;
		},
		replace: (original, binding, value) => ({
			...original,
			attributes: { ...original.attributes, [binding.name]: value as string },
		}),
	},
	element: {
		builder: "field",
		annotation: "System.Xml.Serialization.XmlElementAttribute",
		field: element,
		select: (original, binding) =>
			readElementText(ownedElement(original, binding)),
		replace: (original, binding, value) =>
			patchElement(original, binding, (child) =>
				replaceElementText(child, value as string),
			),
	},
	object: {
		builder: "field",
		annotation: "System.Xml.Serialization.XmlElementAttribute",
		field: nested,
		select: (original, binding) => ownedElement(original, binding, true),
		replace: (original, binding, value) =>
			patchElement(original, binding, () =>
				withName(value as XmlElement, binding.name, original),
			),
	},
	elements: {
		builder: "repeatedValues",
		multiple: true,
		annotation: "System.Xml.Serialization.XmlElementAttribute",
		field: elements,
		select: (original, binding) =>
			repeated(original, binding).map(readElementText),
		replace: (original, binding, value) =>
			patchSiblings(original, binding.name, value as readonly string[], true),
	},
	objectElements: {
		builder: "repeatedValues",
		multiple: true,
		annotation: "System.Xml.Serialization.XmlElementAttribute",
		field: objectElements,
		select: repeated,
		replace: (original, binding, value) =>
			patchSiblings(
				original,
				binding.name,
				value as readonly XmlElement[],
				true,
			),
	},

	collection: {
		builder: "list",
		multiple: true,
		annotation: "System.Xml.Serialization.XmlArrayAttribute",
		field: collection,
		select: (original, binding) =>
			items(original, binding).map(readElementText),
		replace: (original, binding, value) =>
			patchItems(original, binding, value as readonly string[]),
	},
	objects: {
		builder: "list",
		multiple: true,
		annotation: "System.Xml.Serialization.XmlArrayAttribute",
		field: objects,
		select: items,
		replace: (original, binding, value) =>
			patchItems(original, binding, value as readonly XmlElement[]),
	},
} as const satisfies Record<StructureKind, StructureHandler>;

// The selected field's schema has already encoded the replacement value. Keeping
// dispatch here means object() doesn't need another switch whenever a slot grows.
export function selectField(
	original: XmlElement,
	binding: Binding,
): EncodedValue | undefined {
	if (binding.optional && !hasSlot(original, binding)) return undefined;
	return structures[binding.kind].select(original, binding);
}
function hasSlot(original: XmlElement, binding: Binding): boolean {
	// Only direct owned slots count as presence. Empty text/wrappers are present;
	// nested descendants and inherited JavaScript property names are not slots.
	return binding.kind === "attribute"
		? Object.hasOwn(original.attributes, binding.name)
		: original.children.some(
				(node) => node._tag === "Element" && node.name === binding.name,
			);
}
export function replaceField(
	original: XmlElement,
	binding: Binding,
	value: EncodedValue | undefined,
): XmlElement {
	if (value === undefined) {
		if (!binding.optional)
			throw new Error(`Missing required field ${binding.name}`);
		// Removing a property is an explicit deletion of its owned XML slot. Keep
		// every other attribute, sibling and comment in the containing envelope.
		if (binding.kind === "attribute") {
			const attributes = { ...original.attributes };
			delete attributes[binding.name];
			return { ...original, attributes };
		}
		return {
			...original,
			children: original.children.filter(
				(node) => node._tag !== "Element" || node.name !== binding.name,
			),
		};
	}
	let parent = original;
	if (
		binding.optional &&
		binding.kind !== "attribute" &&
		!hasSlot(original, binding)
	) {
		// Existing patchers operate on an owned element. Seed an empty slot when a
		// previously absent member is assigned, then let its normal patcher place
		// validated content. Appending preserves the order of all imported siblings.
		parent = {
			...original,
			children: [
				...original.children,
				{
					_tag: "Element",
					name: binding.name,
					attributes: {},
					children: [],
					...(original.namespaces ? { namespaces: original.namespaces } : {}),
				},
			],
		};
	}
	return structures[binding.kind].replace(parent, binding, value);
}
