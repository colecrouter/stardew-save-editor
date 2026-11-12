import { Effect, Schema } from "effect";
import { scalarTypes, scalarXmlType } from "./scalars.ts";
import type { ScalarType } from "./scalars.ts";
import { scalar } from "./values.ts";
import {
	accepted,
	add,
	attach,
	instanceAttribute,
	namespaceAttribute,
	record,
	unknownEvents,
	unknownFrame,
	whitespace,
	without,
	xsi,
	invalid,
	decodeValue,
} from "./events.ts";
import type { Codec, Frame, Header, Reading } from "./events.ts";

// Boxed scalars need a CLR discriminator even when their JS values look alike.
export type ScalarObject = {
	[K in ScalarType]: {
		readonly $type: K;
		readonly value: (typeof scalarTypes)[K]["codec"]["Type"];
	};
}[ScalarType];
export interface Field {
	readonly xmlName: string;
	readonly codec: Codec;
	readonly optional?: true;
	readonly repeated?: true;
}
export function object(
	fields: Readonly<Record<string, Field>>,
): Codec<Readonly<Record<string, unknown>>> {
	const entries = Object.entries(fields);
	const target = Schema.StructWithRest(
		Schema.Struct(
			Object.fromEntries(
				entries.map(([name, field]) => {
					const schema = Schema.toType(field.codec);
					return [name, field.optional ? Schema.optionalKey(schema) : schema];
				}),
			),
		),
		[Schema.Record(Schema.String, Schema.Unknown)],
	);
	const xmlFields = new Map(
		entries.map(([name, field]) => [field.xmlName, { name, field }]),
	);
	return attach(
		target,
		(header) =>
			Effect.gen(function* () {
				if (header.namespaces[""])
					return yield* invalid("Namespaced object elements are unsupported");
				if (yield* instanceAttribute(header, "nil"))
					return yield* invalid("Non-nullable object has xsi:nil");
				const output: Record<string, unknown> = {};
				const seen = new Set<string>();
				const unknownRepeated = new Set<string>();
				// Attributes can be converted immediately; child fields complete one at a
				// time. Only unknown fields keep their generic property representation.
				for (const [key, value] of Object.entries(header.attributes)) {
					// Namespace declarations are reader context, not typed saved fields.
					// Unknown qualified attributes retain just the binding they require.
					if (namespaceAttribute(key)) continue;
					const mapping = xmlFields.get(`@_${key}`);
					if (mapping) {
						if (!mapping.field.codec.text)
							throw new Error(`Attribute ${key} needs a text codec`);
						add(
							output,
							mapping.name,
							yield* decodeValue(mapping.field.codec.text, value),
						);
						seen.add(mapping.name);
					} else {
						add(output, `@_${key}`, value);
						const prefix = key.includes(":") ? key.split(":")[0] : undefined;
						if (prefix && header.namespaces[prefix] !== undefined)
							add(output, `@_xmlns:${prefix}`, header.namespaces[prefix]);
					}
				}
				for (const [name, field] of entries)
					if (field.repeated) add(output, name, []);
					else if (field.codec.missingValue === null) {
						// An absent NetRef and an explicitly cleared one are the same
						// game value. Use null consistently after loading either XML form.
						add(output, name, null);
					}
				return {
					text: whitespace,
					child: (child) =>
						Effect.gen(function* () {
							const mapping = xmlFields.get(child.name);
							if (!mapping) {
								if (Object.hasOwn(fields, child.name))
									return yield* invalid(
										`Unknown XML property collides with member ${child.name}`,
									);
								return accepted(yield* unknownFrame(child), (value) => {
									if (!Object.hasOwn(output, child.name))
										add(output, child.name, value);
									else if (unknownRepeated.has(child.name))
										(output[child.name] as unknown[]).push(value);
									else {
										add(output, child.name, [output[child.name], value]);
										unknownRepeated.add(child.name);
									}
								});
							}
							const { name, field } = mapping;
							if (!field.repeated && seen.has(name))
								return yield* invalid(`Duplicate ${name}`);
							seen.add(name);
							const codec = field.repeated ? field.codec.item : field.codec;
							if (!codec)
								throw new Error(`Repeated ${name} needs an item codec`);
							return accepted(yield* codec.open(child), (value) => {
								if (field.repeated) (output[name] as unknown[]).push(value);
								else add(output, name, value);
							});
						}),
					finish: () =>
						Effect.gen(function* () {
							for (const [name, field] of entries)
								if (!field.optional && !field.repeated && !seen.has(name))
									return yield* invalid(`Missing ${name}`);
							return output;
						}),
				} satisfies Frame;
			}),
		function* (name, value, supplied) {
			const attributes = {
				...Object.fromEntries(
					Object.entries(value)
						.filter(([key]) => key.startsWith("@_") && !xmlFields.has(key))
						.map(([key, value]) => [key.slice(2), String(value)]),
				),
				...supplied,
			};
			if (attributes.xmlns)
				throw new Error("Namespaced object elements are unsupported");
			for (const [member, field] of entries) {
				if (!field.xmlName.startsWith("@_") || !Object.hasOwn(value, member))
					continue;
				if (!field.codec.text)
					throw new Error(`Attribute ${member} needs a text codec`);
				attributes[field.xmlName.slice(2)] = Schema.encodeSync(
					field.codec.text,
				)(value[member]);
			}
			yield { _tag: "StartElement", name, attributes };
			for (const [member, field] of entries)
				if (!field.xmlName.startsWith("@_") && Object.hasOwn(value, member))
					yield* field.codec.write(field.xmlName, value[member]);
			for (const [key, extra] of Object.entries(value))
				if (
					!Object.hasOwn(fields, key) &&
					!xmlFields.has(key) &&
					!key.startsWith("@_")
				)
					yield* unknownEvents(key, extra);
			yield { _tag: "EndElement", name };
		},
	);
}
// Unknown subclasses retain generic fields and the semantic QName needed to
// write their type again. They never masquerade as a validated known subtype.
export interface UnknownObject {
	readonly $type: "$unknown";
	readonly $xmlType: { readonly name: string; readonly namespace: string };
	readonly [field: string]: unknown;
}
export interface Variant {
	readonly id: string;
	readonly name: string;
	readonly namespace: string;
	readonly codec: Codec;
}
function readType(
	header: Header,
): Reading<{ name: string; namespace: string } | undefined> {
	return Effect.gen(function* () {
		const attribute = yield* instanceAttribute(header, "type");
		if (!attribute) return undefined;
		const parts = header.attributes[attribute]?.split(":") ?? [];
		if (
			parts.length > 2 ||
			parts.some((part) => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(part))
		)
			return yield* invalid("Invalid xsi:type QName");
		const prefix = parts.length === 2 ? (parts[0] ?? "") : "";
		const ns = header.namespaces[prefix] ?? (prefix ? undefined : "");
		if (ns === undefined)
			return yield* invalid(`Unbound xsi:type prefix ${prefix}`);
		return { name: parts.at(-1) ?? "", namespace: ns };
	});
}
function typeAttributes(
	value: Readonly<Record<string, unknown>>,
	name: string,
	namespace: string,
): Record<string, string> {
	const attributes: Record<string, string> = {};
	const prefix = (base: string, uri: string) => {
		let name = base;
		for (
			let index = 1;
			Object.hasOwn(value, `@_xmlns:${name}`) &&
			value[`@_xmlns:${name}`] !== uri;
			index++
		)
			name = `${base}${index}`;
		attributes[`xmlns:${name}`] = uri;
		return name;
	};
	const instance = prefix("xsi", xsi);
	attributes[`${instance}:type`] = namespace
		? `${prefix("type", namespace)}:${name}`
		: name;
	return attributes;
}
export function polymorphic(
	declared: string,
	variants: readonly Variant[],
	exposeType = false,
): Codec {
	const needsTag =
		declared === "System.Object" ||
		variants.length !== 1 ||
		variants[0]?.id !== declared;
	const choose = (id: unknown) => {
		const variant = variants.find((variant) => variant.id === id);
		if (!variant)
			throw new Error(`Unknown concrete type ${String(id)} for ${declared}`);
		return variant;
	};
	// Compile each selected payload validator once. Rebuilding Schema.toType for
	// every nested object creates large duplicate schema graphs on full saves.
	const validators = new Map<string, (value: unknown) => unknown>();
	const validate = (id: string, codec: Codec, value: unknown) => {
		let decode = validators.get(id);
		if (!decode) {
			decode = Schema.decodeUnknownSync(Schema.toType(codec));
			validators.set(id, decode);
		}
		decode(value);
	};
	// Validate the declared discriminator as well as the selected payload when
	// callers use ValueSchema directly, outside the XML event entry point.
	const target = Schema.Record(Schema.String, Schema.Unknown).check(
		Schema.makeFilter((value) => {
			if (needsTag && value.$type === "$unknown") {
				const type = value.$xmlType;
				if (
					!type ||
					typeof type !== "object" ||
					!("name" in type) ||
					!("namespace" in type) ||
					typeof type.name !== "string" ||
					typeof type.namespace !== "string" ||
					!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(type.name)
				)
					return "Invalid unknown XML type";
				return variants.some(
					(variant) =>
						variant.name === type.name && variant.namespace === type.namespace,
				)
					? "A known XML type requires its typed representation"
					: undefined;
			}
			// A concrete field may omit its tag, but an explicit conflicting tag
			// must not be silently rewritten as the declared XML type.
			if (!needsTag && value.$type !== undefined && value.$type !== declared)
				return `Expected concrete type ${declared}`;
			try {
				if (
					declared === "System.Object" &&
					typeof value.$type === "string" &&
					Object.hasOwn(scalarTypes, value.$type)
				) {
					validate(value.$type, scalar(value.$type as ScalarType), value.value);
				} else {
					const id = needsTag ? value.$type : declared;
					const variant = variants.find((candidate) => candidate.id === id);
					if (!variant)
						return `Unknown concrete type ${String(id)} for ${declared}`;
					validate(variant.id, variant.codec, value);
				}
				return undefined;
			} catch (error) {
				// Schema rejects invalid payloads; unrelated programming exceptions
				// must escape as defects rather than masquerading as bad save data.
				if (Schema.isSchemaError(error)) return error.message;
				throw error;
			}
		}),
	);
	return attach(
		target,
		(header) =>
			Effect.gen(function* () {
				const type = yield* readType(header);
				const clean = without(header, yield* instanceAttribute(header, "type"));
				if (declared === "System.Object" && type) {
					const id = (Object.keys(scalarTypes) as ScalarType[]).find((id) => {
						const expected = scalarXmlType(id);
						return (
							expected.name === type.name &&
							expected.namespace === type.namespace
						);
					});
					if (id) {
						const frame = yield* scalar(id).open(clean);
						return {
							...frame,
							finish: () =>
								Effect.map(frame.finish(), (value) => ({ $type: id, value })),
						} satisfies Frame;
					}
				}
				const matches = type
					? variants.filter(
							(variant) =>
								variant.name === type.name &&
								variant.namespace === type.namespace,
						)
					: variants.filter((variant) => variant.id === declared);
				const variant = matches[0];
				if (matches.length !== 1 || !variant) {
					if (!needsTag || !type)
						return yield* invalid(
							`Unresolved xsi:type ${type?.name ?? declared}`,
						);
					// Unknown subclass fields stay opaque instead of being decoded as the
					// base class and accidentally losing their subtype-specific data.
					// Keep required bindings via namespace context, while the type's own
					// QName lives in $xmlType rather than duplicated prefix declarations.
					const frame = yield* unknownFrame({
						...clean,
						attributes: Object.fromEntries(
							Object.entries(clean.attributes).filter(
								([name]) => !namespaceAttribute(name),
							),
						),
					});
					return {
						...frame,
						finish: () =>
							Effect.map(frame.finish(), (value) => ({
								// Unknown custom serializers may emit text without child fields.
								// Keep that content in the generic text slot alongside type identity.
								...(typeof value === "string"
									? { "#text": value }
									: record(value)),
								$type: "$unknown",
								$xmlType: type,
							})),
					} satisfies Frame;
				}
				const frame = yield* variant.codec.open(clean);
				return {
					...frame,
					finish: () =>
						Effect.gen(function* () {
							const value = record(yield* frame.finish());
							if (Object.hasOwn(value, "$type"))
								return yield* invalid("$type is reserved");
							return {
								...value,
								...(needsTag || exposeType ? { $type: variant.id } : {}),
							};
						}),
				} satisfies Frame;
			}),
		function* (name, value, attributes) {
			if (needsTag && value.$type === "$unknown") {
				const { $type: _, $xmlType, ...fields } = value;
				const type = $xmlType as UnknownObject["$xmlType"];
				yield* unknownEvents(name, {
					...fields,
					...Object.fromEntries(
						Object.entries(
							typeAttributes(fields, type.name, type.namespace),
						).map(([key, value]) => [`@_${key}`, value]),
					),
				});
				return;
			}
			if (
				declared === "System.Object" &&
				typeof value.$type === "string" &&
				Object.hasOwn(scalarTypes, value.$type)
			) {
				const id = value.$type as ScalarType,
					type = scalarXmlType(id);
				yield* scalar(id).write(name, value.value, {
					...attributes,
					...typeAttributes(value, type.name, type.namespace),
				});
				return;
			}
			const variant = choose(needsTag ? value.$type : declared);
			const { $type: _, ...payload } = value;
			yield* variant.codec.write(
				name,
				payload,
				variant.id === declared
					? attributes
					: {
							...attributes,
							...typeAttributes(value, variant.name, variant.namespace),
						},
			);
		},
	);
}
