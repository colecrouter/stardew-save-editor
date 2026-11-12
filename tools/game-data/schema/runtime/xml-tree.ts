import * as Effect from "effect/Effect";
import { Xml } from "effect/encoding";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Stream from "effect/Stream";
import { typeAttribute } from "./xml-types.ts";

// This module owns the XML representation and the text/event boundary. It knows
// nothing about CLR members or the field names selected by a generated schema.
// Effect's event decoder preserves comments and processing instructions. Its
// element collector drops those, so this fragment tree retains the event nodes.
export type XmlNode =
	| XmlElement
	| Xml.Text
	| Xml.Comment
	| Xml.ProcessingInstruction;

// Elements retain attributes and ordered children. Text, comments and processing
// instructions reuse Effect's event values; they do not become typed game fields.
export interface XmlElement {
	readonly _tag: "Element";
	readonly name: string;
	readonly attributes: Readonly<Record<string, string>>;
	readonly children: readonly XmlNode[];
	// In-scope namespace bindings are parser context, not extra XML attributes.
	readonly namespaces?: Readonly<Record<string, string>>;
}

// suspend closes the recursive child reference without constructing an infinite
// schema. Validating this tree also checks the .original envelope during encoding.
export const XmlElementSchema: Schema.Codec<XmlElement> = Schema.suspend(() =>
	Schema.TaggedStruct("Element", {
		name: Schema.String,
		attributes: Schema.Record(Schema.String, Schema.String),
		namespaces: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
		children: Schema.Array(
			Schema.Union([
				XmlElementSchema,
				Schema.TaggedStruct("Text", { text: Schema.String }),
				Schema.TaggedStruct("Comment", { text: Schema.String }),
				Schema.TaggedStruct("ProcessingInstruction", {
					target: Schema.String,
					data: Schema.String,
				}),
			]),
		),
	}),
);

export function parseFragment(xml: string) {
	return Stream.make(xml).pipe(
		// This is a small-fragment experiment, so bound nesting rather than
		// allowing a malformed input to exhaust recursive schema/tree traversal.
		Stream.pipeThroughChannel(Xml.decodeString({ maxDepth: 128 })),
		Stream.runCollect,
		Effect.flatMap((events) =>
			Effect.try({
				try: () => {
					// This experiment accepts a root fragment, without declarations or
					// document-level trivia. XML well-formedness is checked by Effect.
					const stack: Array<{
						_tag: "Element";
						name: string;
						attributes: Readonly<Record<string, string>>;
						children: XmlNode[];
						namespaces: Readonly<Record<string, string>>;
					}> = [];
					let root: XmlElement | undefined;
					for (const event of events) {
						if (event._tag === "StartElement") {
							// Create a new element, then make it the owner of following events until its end tag.
							const parent = stack.at(-1);
							// Object.fromEntries keeps prefixes such as __proto__ as literal
							// bindings instead of invoking object prototype setters.
							const declarations = Object.entries(event.attributes).flatMap(
								([name, value]) =>
									name === "xmlns"
										? [["", value]]
										: name.startsWith("xmlns:")
											? [[name.slice(6), value]]
											: [],
							);
							const namespaces = Object.fromEntries([
								...Object.entries(parent?.namespaces ?? {}),
								...declarations,
							]);
							const element = {
								_tag: "Element" as const,
								name: event.name,
								// Normalize Effect's attribute-map prototype while keeping
								// its entries/order, so schema round trips use plain records.
								attributes: Object.fromEntries(
									Object.entries(event.attributes),
								),
								children: [] as XmlNode[],
								namespaces,
							};

							// The first start event opens the root and has no parent.
							// Later starts attach to the currently open element.
							if (parent) parent.children.push(element);
							stack.push(element);
						} else if (event._tag === "EndElement") {
							// Effect already checks matching tags. Emptying the stack
							// marks the one completed root we return to the tree codec.
							const closed = stack.pop();
							if (!closed) throw new Error("Unexpected XML end event");
							if (stack.length === 0) root = closed;
						} else if (
							event._tag === "Declaration" ||
							event._tag === "Doctype" ||
							stack.length === 0
						) {
							throw new Error(
								"Expected a root fragment without document declarations/trivia",
							);
						} else {
							const parent = stack.at(-1);
							if (!parent) throw new Error("XML event outside root");
							// Preserve non-element events in order; the generated
							// schema may not understand them, but export still needs them.
							parent.children.push(event);
						}
					}
					if (!root) throw new Error("Missing XML root");
					return root;
				},
				catch: (error) =>
					new SchemaIssue.InvalidValue({ message: String(error) }),
			}),
		),
	);
}

export function printFragment(element: XmlElement) {
	// Recreate the event stream in tree order and let Effect validate/escape the
	// output. This preserves XML meaning, not original quotes or CDATA spelling.
	function* events(node: XmlNode): Generator<Xml.Event> {
		if (node._tag !== "Element") {
			yield node;
			return;
		}
		yield {
			_tag: "StartElement",
			name: node.name,
			attributes: node.attributes,
		};
		for (const child of node.children) yield* events(child);
		yield { _tag: "EndElement", name: node.name };
	}
	return Stream.fromIterable(events(element)).pipe(
		Stream.pipeThroughChannel(Xml.encodeString()),
		Stream.mkString,
	);
}

export function assertPlainElement(
	element: XmlElement,
	allowType = false,
): void {
	// The scaffold only compiles no-namespace contracts. Don't accidentally treat
	// an identically spelled namespaced or polymorphic element as that contract.
	if (element.attributes.xmlns)
		throw new Error(`${element.name}: namespaces are unsupported`);
	if (
		Object.keys(element.attributes).some(
			(name) =>
				name.endsWith(":nil") ||
				(name.endsWith(":type") &&
					(!allowType || name !== typeAttribute(element))),
		)
	)
		throw new Error(`${element.name}: nil/type overrides are unsupported`);
}

export function readElementText(element: XmlElement): string {
	// Scalar text may be split around comments/instructions. Concatenate only
	// actual text, and reject nested elements rather than flattening their values.
	assertPlainElement(element);
	if (element.children.some((node) => node._tag === "Element"))
		throw new Error(`${element.name}: scalar contains nested elements`);
	return element.children
		.map((node) => (node._tag === "Text" ? node.text : ""))
		.join("");
}

export function replaceElementText(
	element: XmlElement,
	value: string,
): XmlElement {
	// Edited text replaces the old text slots while retaining comments and
	// processing instructions. Unchanged fields bypass this function entirely.
	let written = false;
	const children = element.children.flatMap((node): XmlNode[] => {
		if (node._tag !== "Text") return [node];
		if (written) return [];
		written = true;
		return [{ _tag: "Text", text: value }];
	});
	// Empty elements have no text slot to replace; insert their edited value.
	if (!written) children.push({ _tag: "Text", text: value });
	return { ...element, children };
}
