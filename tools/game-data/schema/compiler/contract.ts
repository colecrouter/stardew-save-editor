import { resolveKeyIdentity } from "../mappings/key-identities.ts";
import type { DictionaryKeyComparison } from "../mappings/key-identities.ts";
import {
	collectionItemName,
	rootElementName,
	serializationNames,
} from "../mappings/type-names.ts";
import { customSerializer } from "../mappings/custom-serializers.ts";
import { enumWrapper } from "../mappings/enum-wrappers.ts";
import { sequenceItem } from "../mappings/sequences.ts";
import { collectionItemValue } from "../mappings/collection-items.ts";
import type { ScalarType } from "../mappings/scalars.ts";
import {
	isScalarType,
	scalarTypes,
	scalarXmlType,
} from "../mappings/scalars.ts";
import type {
	StructureBindings,
	StructureKind,
} from "../mappings/structures.ts";
import { structures } from "../mappings/structures.ts";
import {
	discoverKnownTypes,
	isAssignable,
} from "../mappings/type-annotations.ts";
import type {
	CatalogAttribute,
	CatalogMember,
	CatalogTypes,
} from "./catalog.ts";

// The scalar registry owns built-ins; enum labels come from the catalog. Object
// references point at separately resolved definitions, so shared types are emitted
// once and their XML element names remain controlled by the enclosing member.
export type ValueContract =
	| { readonly kind: "scalar"; readonly type: ScalarType }
	| {
			readonly kind: "enum";
			readonly type: string;
			readonly labels: readonly string[];
			readonly nullable?: true;
	  }
	| { readonly kind: "object"; readonly type: string }
	| { readonly kind: "nullable"; readonly value: ValueContract }
	| { readonly kind: "inventory"; readonly item: ValueContract }
	// This is the XML sequence representation, shared by CLR arrays and List<T>.
	// Their distinct CLR generic names remain the naming mapping's responsibility.
	| {
			readonly kind: "array";
			readonly item: ValueContract;
			readonly itemName: string;
	  }
	| {
			readonly kind: "dictionary";
			readonly key: ValueContract;
			readonly value: ValueContract;
			readonly keyName: string;
			readonly keyIdentity?: DictionaryKeyComparison;
			readonly valueName: string;
	  };

// Element-valued codecs receive whole XML trees; text codecs receive strings.
// Keep this distinction shared by field classification and serializer emission.
export function isElementValue(value: ValueContract): boolean {
	return (
		value.kind === "object" ||
		value.kind === "dictionary" ||
		value.kind === "inventory" ||
		value.kind === "array" ||
		value.kind === "nullable"
	);
}

// Derive field kinds and collection item requirements from the runtime bindings.
// A new structural kind therefore can't silently disappear from the compiler union.
export type FieldContract = {
	[K in StructureKind]: {
		readonly kind: K;
		readonly memberName: string;
		readonly xmlName: string;
		readonly value: ValueContract;
		readonly maxItems?: 1;
		readonly optional?: true;
	} & (StructureBindings[K] extends { readonly item: string }
		? { readonly itemName: string }
		: unknown);
}[StructureKind];

export interface ObjectContract {
	readonly clrType: string;
	readonly baseType?: string;
	readonly xmlName: string;
	readonly fields: readonly FieldContract[];
	readonly typeName: string;
	readonly typeNamespace: string;
	readonly variants: readonly string[];
	readonly isAbstract: boolean;
}
export interface CompilationContract {
	readonly root: ObjectContract;
	// Acyclic dependencies finish first. Back references retain CLR IDs so the
	// emitter can identify cycles without expanding the same declaration again.
	readonly objects: readonly ObjectContract[];
}

const xmlAttribute = {
	root: "System.Xml.Serialization.XmlRootAttribute",
	type: "System.Xml.Serialization.XmlTypeAttribute",
	element: structures.element.annotation,
	attribute: structures.attribute.annotation,
	array: structures.collection.annotation,
	item: "System.Xml.Serialization.XmlArrayItemAttribute",
	enum: "System.Xml.Serialization.XmlEnumAttribute",
} as const;

// Interpret raw CLR arguments before choosing codecs. Namespace-qualified member
// slots and per-nesting-level array overrides still require separate mappings.
function validateSettings(attribute: CatalogAttribute, path: string): void {
	for (const [key, argument] of Object.entries(
		attribute.namedArguments ?? {},
	)) {
		const value = argument.value;
		// An absent/null namespace inherits the surrounding context; an empty
		// namespace explicitly selects none. Both fit our no-namespace roots.
		if (key === "Namespace" && (value === null || value === "")) continue;
		// XmlSchemaForm.None=0 leaves the default unchanged; Unqualified=2
		// explicitly omits a namespace. Qualified=1 needs namespace handling.
		if (key === "Form" && (value === 0 || value === 2)) continue;
		// Wrapped reference items allow nil by default; false suppresses that item
		// behavior. Other explicit true overrides still need their own validation.
		if (key === "IsNullable" && value === false) continue;
		if (key === "NestingLevel" && value === 0) continue;
		// Naming settings are interpreted by resolveName for the relevant kind
		// of declaration; their values must be strings before use as XML names.
		if (
			["ElementName", "AttributeName", "TypeName", "Name"].includes(key) &&
			typeof value === "string"
		)
			continue;
		throw new Error(
			`${path}: unsupported ${attribute.type}.${key}=${JSON.stringify(value)}`,
		);
	}
}

function resolveName(
	attribute: CatalogAttribute | undefined,
	setting: string,
	fallback: string,
	path: string,
): string {
	if (!attribute) return fallback;
	validateSettings(attribute, path);
	// Named settings override the string constructor overload, which overrides
	// the CLR name. Explicit empty names also fall back to the CLR declaration.
	const named = attribute.namedArguments?.[setting]?.value;
	const positional = attribute.constructorArguments?.find(
		(argument) => argument.type === "System.String",
	)?.value;
	const name = named ?? positional ?? fallback;
	if (typeof name !== "string")
		throw new Error(`${path}: XML name must be a string`);
	return name || fallback;
}

function requirePlainName(
	name: string,
	path: string,
	kind: "root XML" | "XML" | "item",
): void {
	// Colons would require namespace resolution; the limited ASCII subset is
	// deliberate until the runtime can match qualified names correctly.
	if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name))
		throw new Error(`${path}: unsupported ${kind} name ${name}`);
}

function resolveValue(
	types: CatalogTypes,
	id: string,
	path: string,
	visit: (id: string, path: string) => void,
	enumNames: "xml" | "clr" = "xml",
	activeSequences: ReadonlySet<string> = new Set(),
): ValueContract {
	// A registry entry is both compile-time support and a concrete runtime codec.
	if (isScalarType(id)) return { kind: "scalar", type: id };
	if (/\[[,]+\]$/.test(id))
		throw new Error(`${path}: multidimensional arrays are unsupported`);
	const record = types.get(id);
	const itemType = record ? sequenceItem(record) : undefined;
	if (itemType) {
		if (id === "System.Byte[]")
			throw new Error(`${path}: binary byte arrays are unsupported`);
		if (activeSequences.has(id))
			throw new Error(`${path}: invalid recursive array/list metadata (${id})`);
		const nested = new Set([...activeSequences, id]);
		const item = collectionItemValue(
			types,
			itemType,
			resolveValue(types, itemType, `${path}[]`, visit, "xml", nested),
		);
		const itemName = collectionItemName(types, itemType);
		requirePlainName(itemName, path, "item");
		return { kind: "array", item, itemName };
	}

	if (record?.kind === "nullable") {
		const args = record.genericArguments;
		if (
			record.genericDefinition !== "System.Nullable`1" ||
			args?.length !== 1 ||
			!args[0]
		)
			throw new Error(
				`${path}: nullable type requires generic metadata; reinspect the game`,
			);
		// CLR Nullable<T> cannot itself contain another nullable value. Reject
		// malformed cyclic metadata here instead of recursing through it forever.
		if (args[0] === id || types.get(args[0])?.kind === "nullable")
			throw new Error(`${path}: nested nullable CLR metadata is invalid`);
		const inner = resolveValue(types, args[0], path, visit);
		if (inner.kind !== "scalar" && inner.kind !== "enum")
			throw new Error(
				`${path}: nullable CLR value requires a supported scalar or enum`,
			);
		return { kind: "nullable", value: inner };
	}
	const serializer = record?.customXml ? customSerializer(record) : undefined;
	if (record && serializer) {
		if (serializer.kind === "inventory") {
			const item = resolveValue(
				types,
				serializer.item(record),
				`${path}.slots`,
				visit,
			);
			if (item.kind !== "object")
				throw new Error(`${path}: inventory requires an object item codec`);
			return { kind: "inventory", item };
		}
		const [keyId, valueId] = serializer.arguments(record);
		const key = resolveValue(types, keyId, `${path}.key`, visit);
		const value = resolveValue(types, valueId, `${path}.value`, visit);
		// Structured keys require a reviewed identity. The full XML codec stays
		// untouched; duplicate detection uses a separate comparison-schema view.
		// A reviewed serializer can select a string comparer without changing the
		// string key's XML representation or its ordinary edit equivalence.
		const keyIdentity =
			serializer.comparison ??
			(key.kind === "object"
				? resolveKeyIdentity(types, key.type, path)
				: undefined);
		if (isElementValue(key) && key.kind !== "object")
			throw new Error(`${path}: dictionary key representation is unsupported`);
		const payloadName = (id: string): string => {
			const name = rootElementName(types, id);
			requirePlainName(name, path, "XML");
			return name;
		};
		return {
			kind: "dictionary",
			key,
			value,
			keyName: payloadName(keyId),
			keyIdentity,
			valueName: payloadName(valueId),
		};
	}
	if (record?.customXml)
		throw new Error(
			`${path}: unsupported value type ${id} (custom XML serializer)`,
		);
	if (record?.kind === "object") {
		visit(id, path);
		return { kind: "object", type: id };
	}
	if (record?.kind !== "enum")
		throw new Error(`${path}: unsupported value type ${id}`);
	if (record.attributes?.length)
		throw new Error(`${path}: enum type attributes are unsupported`);
	// Enum codecs use saved labels rather than CLR integer values. We don't
	// infer combinations for flags enums or accept alternate undeclared labels.
	const labels = (record.members ?? []).map((member) => {
		const attributes = member.attributes ?? [];
		if (
			attributes.length > 1 ||
			attributes.some((attribute) => attribute.type !== xmlAttribute.enum)
		)
			throw new Error(`${path}.${member.name}: unsupported enum annotations`);
		// NetNullableEnum writes Enum.ToString text, bypassing XmlEnum aliases.
		// Ordinary enum serializers still use the attribute's saved label.
		return enumNames === "clr"
			? member.name
			: resolveName(attributes[0], "Name", member.name, path);
	});
	if (!labels.length || new Set(labels).size !== labels.length)
		throw new Error(`${path}: empty or ambiguous enum`);
	return { kind: "enum", type: id, labels };
}

function validateMemberAttributes(
	member: CatalogMember,
	path: string,
): readonly CatalogAttribute[] {
	const attributes = member.attributes ?? [];
	// Structural registrations supply the supported outer annotations; item
	// annotations configure a collection's child names rather than another slot.
	const allowed: readonly string[] = [
		...Object.values(structures).flatMap((shape) =>
			"annotation" in shape ? [shape.annotation] : [],
		),
		xmlAttribute.item,
	];
	for (const attribute of attributes) {
		if (!allowed.includes(attribute.type))
			throw new Error(`${path}: unsupported attribute ${attribute.type}`);
		validateSettings(attribute, path);
		// A Type constructor argument changes the value's serialization type;
		// it is not merely another spelling for the member's CLR type name.
		if (
			attribute.constructorArguments?.some(
				(argument) => argument.type === "System.Type",
			)
		)
			throw new Error(
				`${path}: explicit item/element type overrides are unsupported`,
			);
	}
	return attributes;
}

function resolveField(
	types: CatalogTypes,
	rootId: string,
	member: CatalogMember,
	visit: (id: string, path: string) => void,
): FieldContract {
	const path = `${rootId}.${member.name}`;
	const attributes = validateMemberAttributes(member, path);
	// XmlArrayItem configures children inside a wrapper; it isn't a competing
	// mapping for the member itself. Multiple outer mappings need polymorphism.
	const mappings = attributes.filter(
		(attribute) => attribute.type !== xmlAttribute.item,
	);
	if (mappings.length > 1)
		throw new Error(`${path}: multiple XML mappings are unsupported`);
	const mapping = mappings[0];
	const isAttribute = mapping?.type === xmlAttribute.attribute;
	const xmlName = resolveName(
		mapping,
		isAttribute ? "AttributeName" : "ElementName",
		member.name,
		path,
	);
	requirePlainName(xmlName, path, "XML");
	if (/\[[,]+\]$/.test(member.type))
		throw new Error(`${path}: multidimensional arrays are unsupported`);
	// Byte arrays have a binary/base64 serialization contract, unlike lists of
	// individual Byte values. Keep them explicit until binary mappings are supported.
	if (member.type === "System.Byte[]")
		throw new Error(`${path}: binary byte arrays are unsupported`);
	const memberType = types.get(member.type);
	if (memberType?.kind === "collection" && !memberType.customXml) {
		if (isAttribute)
			throw new Error(`${path}: collections cannot be XML attributes`);

		const items = attributes.filter(
			(attribute) => attribute.type === xmlAttribute.item,
		);
		if (items.length > 1 || !memberType.elementType)
			throw new Error(`${path}: ambiguous collection item mapping`);
		const itemType = memberType.elementType;
		// A reviewed wrapper can serialize through text while retaining a narrower
		// enum domain. Resolve that domain instead of emitting arbitrary strings or
		// interpreting NetField's inherited Nullable<T> interface as XML structure.
		const wrapper = enumWrapper(memberType);
		const resolveItem = (): ValueContract => {
			if (!wrapper) return resolveValue(types, itemType, path, visit);
			const value = resolveValue(
				types,
				wrapper.enumType(memberType),
				path,
				visit,
				"clr",
			);
			if (value.kind !== "enum")
				throw new Error(`${path}: enum wrapper requires an enum argument`);
			return { ...value, nullable: true };
		};

		// XmlElement names each repeated sibling, while XmlArrayItem only names
		// children inside a wrapper. Reject combining those incompatible shapes.
		if (mapping?.type === xmlAttribute.element) {
			if (items.length)
				throw new Error(`${path}: XmlArrayItem requires a wrapped collection`);
			const value = resolveItem();
			return {
				memberName: member.name,
				xmlName,
				maxItems: memberType.maxItems,
				kind: isElementValue(value) ? "objectElements" : "elements",
				value,
			};
		}

		// XmlArrayItem overrides the item's XML type name. Root-only names are
		// reserved for separately serialized dictionary payloads, not array entries.
		const fallback = collectionItemName(types, itemType);
		const itemName = resolveName(items[0], "ElementName", fallback, path);
		requirePlainName(itemName, path, "item");
		// Wrapped items retain explicit null reference slots unless the item
		// annotation suppresses them. This is independent of wrapper presence and
		// preserves NetField's existing maxItems bound, including a null single slot.
		const value = collectionItemValue(
			types,
			itemType,
			resolveItem(),
			items[0]?.namedArguments?.IsNullable?.value !== false,
		);
		return {
			memberName: member.name,
			xmlName,
			maxItems: memberType.maxItems,
			kind: isElementValue(value) ? "objects" : "collection",
			itemName,
			value,
		};
	}
	// A custom serializer cannot be treated as an ordinary collection, even if
	// its CLR type is enumerable. resolveValue will reject that unsupported type.
	if (
		attributes.some(
			(attribute) =>
				attribute.type === xmlAttribute.item ||
				attribute.type === xmlAttribute.array,
		)
	)
		throw new Error(`${path}: array annotations on a non-collection`);
	const value = resolveValue(types, member.type, path, visit);
	if (isAttribute && isElementValue(value))
		throw new Error(
			`${path}: ${value.kind === "nullable" ? "nullable values" : "objects"} cannot be XML attributes`,
		);
	return {
		memberName: member.name,
		xmlName,
		kind: isAttribute
			? "attribute"
			: isElementValue(value)
				? "object"
				: "element",
		value,
	};
}

export function resolveContract(
	types: CatalogTypes,
	rootId: string,
): CompilationContract {
	const knownTypes = discoverKnownTypes(types, rootId);
	const completed = new Map<string, ObjectContract>();
	const active = new Set<string>();
	function visit(id: string, path: string): ObjectContract | undefined {
		const previous = completed.get(id);
		if (previous) return previous;
		// Re-encountering an active declaration records a graph edge, not another
		// expansion. References already retain CLR IDs; emission will defer cycles.
		if (active.has(id)) return undefined;
		const root = types.get(id);
		if (!root || root.kind !== "object" || root.customXml)
			throw new Error(`${path}: expected an ordinary object type`);
		active.add(id);
		const annotation = serializationNames(types, id);
		const xmlName = annotation.rootName;
		// Only assignable known objects belong in this declared type's union.
		// Include declarations on unrelated graph owners don't become variants here.
		const variants = [...new Set([id, ...knownTypes])]
			.filter((candidate) => {
				const record = types.get(candidate);
				return (
					record?.kind === "object" &&
					!record.isAbstract &&
					isAssignable(types, candidate, id)
				);
			})
			.sort();
		if (!variants.length)
			throw new Error(
				`${path}: no known concrete variants for abstract type ${id}`,
			);
		const memberNames = new Set<string>();
		const xmlNames = new Set<string>();
		// Stable ordering gives reproducible definitions. Runtime patching still
		// follows original XML order, not this declaration order.
		const fields = [...(root.members ?? [])]
			.sort((a, b) => a.name.localeCompare(b.name, "en"))
			.map((member) => {
				const memberPath = `${path}.${member.name}`;
				if (memberNames.has(member.name))
					throw new Error(`${memberPath}: duplicate member`);
				memberNames.add(member.name);
				const field = resolveField(types, path, member, visit);
				// Attribute and element names occupy separate XML slots.
				const key = `${field.kind === "attribute" ? "attribute" : "element"}:${field.xmlName}`;
				if (xmlNames.has(key))
					throw new Error(
						`${memberPath}: duplicate XML mapping ${field.xmlName}`,
					);
				xmlNames.add(key);
				// XmlSerializer accepts absent ordinary members without assigning them.
				// Preserve that absence instead of inventing constructor/CLR defaults.
				// Repeated siblings already represent zero occurrences as an empty list.
				const shape = structures[field.kind];
				return "builder" in shape && shape.builder === "repeatedValues"
					? field
					: { ...field, optional: true as const };
			});
		// An ordinary object can legitimately have no public saved members: for
		// example, XmlSerializer writes System.Random as an empty element without
		// its internal state. Keep the usual object envelope so unknown XML survives;
		// missing metadata and custom serializers still fail their separate checks.
		requirePlainName(xmlName, path, "root XML");
		// Resolve every variant once so emission can either order acyclic schemas
		// or suspend recursive edges. Inherited saved members are already flattened
		// by the inspector, not represented as schema inheritance references.
		for (const variant of variants)
			if (variant !== id) visit(variant, `${path}[${variant}]`);
		const identities = new Set<string>();
		// System.Object dispatches scalars and ordinary objects in one QName space.
		// Reject an object annotation that would make scalar dispatch ambiguous.
		if (id === "System.Object")
			for (const scalar of Object.keys(scalarTypes) as ScalarType[]) {
				const identity = scalarXmlType(scalar);
				identities.add(JSON.stringify([identity.namespace, identity.name]));
			}
		for (const variant of variants) {
			const record = types.get(variant);
			if (!record) throw new Error(`${path}: missing variant ${variant}`);
			const identity = serializationNames(types, variant);
			requirePlainName(identity.typeName, path, "XML");
			const key = JSON.stringify([identity.typeNamespace, identity.typeName]);
			if (identities.has(key))
				throw new Error(`${path}: ambiguous XML type ${identity.typeName}`);
			identities.add(key);
		}
		const result = {
			clrType: id,
			...(root.baseType ? { baseType: root.baseType } : {}),
			xmlName,
			fields,
			typeName: annotation.typeName,
			typeNamespace: annotation.typeNamespace,
			variants,
			isAbstract: root.isAbstract ?? false,
		};
		active.delete(id);
		// Newly visited children finish before their parent; active back references
		// remain IDs and are resolved against the completed graph during emission.
		completed.set(id, result);
		return result;
	}
	const root = visit(rootId, rootId);
	if (!root) throw new Error(`${rootId}: root resolution did not complete`);
	return { root, objects: [...completed.values()] };
}
