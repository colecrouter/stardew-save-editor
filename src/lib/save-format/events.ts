import { Effect, Schema, SchemaIssue } from "effect";
import type { Xml } from "effect/encoding";

import { isRecord, isUnknownArray } from "../unknown.ts";

export const xsi = "http://www.w3.org/2001/XMLSchema-instance";
export interface Header {
	readonly name: string;
	readonly attributes: Readonly<Record<string, string>>;
	readonly namespaces: Readonly<Record<string, string>>;
}
export interface Frame {
	text(value: string): Reading<void>;
	child(header: Header): Reading<Frame>;
	// Finish snapshots mutable reader state after children complete; storing an
	// already-constructed Effect could capture that state before the frame is read.
	// oxlint-disable-next-line effecttsgo/lazy-effect -- Completion is an invocation-time frame contract.
	finish(): Reading<unknown>;
}
export type Reading<A> = Effect.Effect<A, SchemaIssue.Issue>;
// Expected data failures enter the typed channel at their source. These helpers
// do not catch defects from code that happens to run while interpreting XML.
export const invalid = (message: string) =>
	Effect.fail(new SchemaIssue.InvalidValue({ message }));
export const decodeValue = <A, I>(
	schema: Schema.Codec<A, I>,
	value: unknown,
): Reading<A> =>
	Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError((error) => error.issue),
	);
// The schema describes plain application values. Event readers/writers own XML
// structure; neither direction has a parser-object or original-tree intermediate.
export type Codec<A = unknown> = Schema.Codec<A> & {
	readonly open: (header: Header) => Reading<Frame>;
	readonly write: (
		name: string,
		value: unknown,
		attributes?: Readonly<Record<string, string>>,
	) => Iterable<Xml.Event>;
	readonly events: (
		name: string,
		value: unknown,
		attributes?: Readonly<Record<string, string>>,
	) => Iterable<Xml.Event>;
	readonly item?: Codec;
	readonly missingValue?: null;
	readonly text?: Schema.Codec<A, string>;
};
export function record(input: unknown): Record<string, unknown> {
	if (!isRecord(input)) throw new Error("Expected an object");
	return input;
}
// Frame child callbacks construct their issue at the rejected input, preserving
// per-read diagnostic identity instead of sharing one module-level failure.
// oxlint-disable-next-line effecttsgo/lazy-effect -- This function implements the parser callback contract.
export function rejectContent(): Reading<never> {
	return invalid("Unexpected XML content");
}
export function whitespace(value: string): Reading<void> {
	return value.trim() !== "" ? rejectContent() : Effect.void;
}
export function namespaceAttribute(name: string): boolean {
	return name === "xmlns" || name.startsWith("xmlns:");
}
export function noAttributes(header: Header): Reading<void> {
	return Object.keys(header.attributes).some(
		(name) => !namespaceAttribute(name),
	)
		? invalid(`${header.name}: unsupported element metadata`)
		: Effect.void;
}
export function instanceAttribute(
	header: Header,
	local: string,
): Reading<string | undefined> {
	const names = Object.keys(header.attributes).filter((name) => {
		const parts = name.split(":");
		return (
			parts.length === 2 &&
			parts[1] === local &&
			header.namespaces[parts[0] ?? ""] === xsi
		);
	});
	return names.length > 1
		? invalid(`Duplicate xsi:${local}`)
		: Effect.succeed(names[0]);
}
export function without(header: Header, name: string | undefined): Header {
	if (!(name != null && name !== "")) return header;
	const attributes = { ...header.attributes };
	delete attributes[name];
	return { ...header, attributes };
}
export function attach<A>(
	schema: Schema.Codec<A>,
	open: (header: Header) => Reading<Frame>,
	write: (
		name: string,
		value: A,
		attributes: Readonly<Record<string, string>>,
	) => Iterable<Xml.Event>,
): Codec<A> {
	const validate = Schema.decodeUnknownSync(schema);
	return Object.assign(schema.annotate({}), {
		// Frames check local XML structure and scalar conversions. The document
		// validates the completed value once, instead of revalidating every ancestor.
		open,
		write: (
			name: string,
			value: unknown,
			attributes: Readonly<Record<string, string>> = {},
		) => {
			// Internal child writes receive document-validated values. Revalidating
			// each ancestor would repeat whole subtrees; events() is the public gate.
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The document codec established A before internal traversal.
			return write(name, value as A, attributes);
		},
		events: (
			name: string,
			value: unknown,
			attributes: Readonly<Record<string, string>> = {},
		) => write(name, validate(value), attributes),
	});
}
export function lazy<A>(get: () => Codec<A>): Codec<A> {
	// Resolve recursive definitions on first use, then reuse the codec and schema.
	// A fresh dispatch/schema per element makes whole-save validation needlessly expensive.
	let resolved: Codec<A> | undefined;
	const resolve = () => (resolved ??= get());
	return attach(
		Schema.suspend(() => Schema.toType(resolve())),
		(header) => Effect.suspend(() => resolve().open(header)),
		(name, value, attributes) => resolve().write(name, value, attributes),
	);
}
export function accepted(
	frame: Frame,
	accept: (value: unknown) => void,
): Frame {
	return {
		...frame,
		// Defer both child completion and parent mutation until execution. Reusing
		// this Effect must finish the child again, rather than reuse a stale value.
		finish: () =>
			Effect.suspend(() =>
				// Most scalar finishes already return an Exit. Map that directly;
				// pending child Effects retain normal sequencing and failure behavior.
				Effect.mapEager(frame.finish(), (value) => {
					accept(value);
					return value;
				}),
			),
	};
}
export function add(
	object: Record<string, unknown>,
	name: string,
	value: unknown,
): void {
	Object.defineProperty(object, name, {
		value,
		writable: true,
		enumerable: true,
		configurable: true,
	});
}

/** Append only to containers established as repeated fields by the XML reader. */
export function append(
	object: Record<string, unknown>,
	name: string,
	value: unknown,
): void {
	const values = object[name];
	if (!isUnknownArray(values))
		throw new Error(`Missing repeated XML field ${name}`);
	values.push(value);
}

export function unknownFrame(header: Header): Reading<Frame> {
	return Effect.gen(function* () {
		// Unknown subtrees alone use the ordinary property representation. Retain the
		// namespace bindings actually used by their names so moving them stays valid.
		const attributes = { ...header.attributes };
		const prefixes = [header.name, ...Object.keys(attributes)]
			.filter((name) => name.includes(":"))
			.map((name) => name.split(":")[0] ?? "");
		const type = yield* instanceAttribute(header, "type");
		if (type != null && type !== "" && attributes[type]?.includes(":") === true)
			prefixes.push(attributes[type].split(":")[0] ?? "");
		for (const prefix of prefixes)
			if (prefix !== "xmlns" && header.namespaces[prefix] !== undefined)
				attributes[`xmlns:${prefix}`] = header.namespaces[prefix] ?? "";
		if (
			!header.name.includes(":") &&
			header.namespaces[""] != null &&
			header.namespaces[""] !== ""
		)
			attributes["xmlns"] = header.namespaces[""];
		const result: Record<string, unknown> = Object.fromEntries(
			Object.entries(attributes).map(([key, value]) => [`@_${key}`, value]),
		);
		const repeated = new Set<string>();
		let text = "";
		return {
			text: (value) =>
				Effect.sync(() => {
					text += value;
				}),
			child: (child) =>
				unknownFrame(child).pipe(
					Effect.map((frame) =>
						accepted(frame, (value) => {
							if (!Object.hasOwn(result, child.name))
								add(result, child.name, value);
							else if (repeated.has(child.name)) {
								const siblings = result[child.name];
								// The repeated-name set is populated only after creating an array.
								if (!isUnknownArray(siblings))
									throw new Error("Missing repeated XML values");
								siblings.push(value);
							} else {
								add(result, child.name, [result[child.name], value]);
								repeated.add(child.name);
							}
						}),
					),
				),
			finish: () =>
				Effect.sync(() => {
					if (!(Object.keys(result).length !== 0)) return text;
					if (text !== "" && (text.trim() !== "" || !/[\r\n]/.test(text)))
						add(result, "#text", text);
					return result;
				}),
		};
	});
}
export function* unknownEvents(
	name: string,
	value: unknown,
): Generator<Xml.Event> {
	if (Array.isArray(value)) {
		for (const item of value) yield* unknownEvents(name, item);
		return;
	}
	const object =
		value !== null && typeof value === "object"
			? record(value)
			: { "#text": value ?? "" };
	const attributes = Object.fromEntries(
		Object.entries(object)
			.filter(([key]) => key.startsWith("@_"))
			.map(([key, nestedValue2]) => [key.slice(2), String(nestedValue2)]),
	);
	yield { _tag: "StartElement", name, attributes };
	for (const [key, nestedValue] of Object.entries(object)) {
		if (key === "#text") yield { _tag: "Text", text: String(nestedValue) };
		else if (!key.startsWith("@_")) yield* unknownEvents(key, nestedValue);
	}
	yield { _tag: "EndElement", name };
}
