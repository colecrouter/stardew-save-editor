import type {
	CatalogAttribute,
	CatalogType,
	CatalogTypes,
} from "../compiler/catalog.ts";
import { customSerializer } from "./custom-serializers.ts";

export interface TypeAnnotations {
	readonly rootName: string;
	readonly typeName: string;
	readonly typeNamespace: string;
	readonly includedTypes: readonly string[];
}
type State = {
	rootName: string;
	typeName: string;
	typeNamespace: string;
	includedTypes: string[];
};
const prefix = "System.Xml.Serialization.";

function name(
	attribute: CatalogAttribute,
	setting: string,
	fallback: string,
): string {
	const value =
		attribute.namedArguments?.[setting]?.value ??
		attribute.constructorArguments?.find((arg) => arg.type === "System.String")
			?.value ??
		fallback;
	if (typeof value !== "string")
		throw new Error(`${attribute.type}: ${setting} must be a string`);
	return value || fallback;
}
function settings(
	attribute: CatalogAttribute,
	allowed: readonly string[],
	path: string,
): void {
	for (const [key, argument] of Object.entries(
		attribute.namedArguments ?? {},
	)) {
		if (!allowed.includes(key))
			throw new Error(`${path}: unsupported ${attribute.type}.${key}`);
		if (key === "IsNullable" && argument.value === false) continue;
		if (
			key !== "IsNullable" &&
			(typeof argument.value === "string" ||
				(key === "Namespace" && argument.value === null))
		)
			continue;
		throw new Error(
			`${path}: unsupported ${attribute.type}.${key}=${JSON.stringify(argument.value)}`,
		);
	}
}

// Type-level annotations are not XML field slots. Register their interpretation
// here rather than letting root-name resolution silently whitelist extra metadata.
export const typeAnnotations = {
	[`${prefix}XmlRootAttribute`]: (
		attribute: CatalogAttribute,
		state: State,
		path: string,
	) => {
		settings(attribute, ["ElementName", "Namespace", "IsNullable"], path);
		if (attribute.namedArguments?.Namespace?.value)
			throw new Error(
				`${path}: unsupported ${attribute.type}.Namespace=${JSON.stringify(attribute.namedArguments?.Namespace?.value)}`,
			);
		state.rootName = name(attribute, "ElementName", state.rootName);
	},
	[`${prefix}XmlTypeAttribute`]: (
		attribute: CatalogAttribute,
		state: State,
		path: string,
	) => {
		settings(attribute, ["TypeName", "Namespace"], path);
		state.typeName = name(attribute, "TypeName", state.typeName);
		state.typeNamespace =
			(attribute.namedArguments?.Namespace?.value as
				| string
				| null
				| undefined) ?? "";
	},
	[`${prefix}XmlIncludeAttribute`]: (
		attribute: CatalogAttribute,
		state: State,
		path: string,
	) => {
		settings(attribute, [], path);
		const args = attribute.constructorArguments ?? [];
		if (
			args.length !== 1 ||
			args[0]?.type !== "System.Type" ||
			typeof args[0].value !== "string"
		)
			throw new Error(`${path}: XmlInclude requires one System.Type argument`);
		// Includes declare known types for the graph. They need not derive from
		// the annotated class: SpecialOrder includes objective and reward types.
		state.includedTypes.push(args[0].value);
	},
} satisfies Record<
	string,
	(attribute: CatalogAttribute, state: State, path: string) => void
>;

export function readTypeAnnotations(
	type: CatalogType,
	fallback = type.id.split(/[.+]/).at(-1) ?? type.id,
): TypeAnnotations {
	const state: State = {
		rootName: fallback,
		typeName: fallback,
		typeNamespace: "",
		includedTypes: [],
	};
	for (const attribute of type.attributes ?? []) {
		if (!Object.hasOwn(typeAnnotations, attribute.type))
			throw new Error(
				`${type.id}: unsupported type attribute ${attribute.type}`,
			);
		typeAnnotations[attribute.type as keyof typeof typeAnnotations](
			attribute,
			state,
			type.id,
		);
	}
	return { ...state, includedTypes: [...new Set(state.includedTypes)] };
}

export function discoverKnownTypes(
	types: CatalogTypes,
	root: string,
): ReadonlySet<string> {
	const known = new Set<string>();
	const seen = new Set<string>();
	const queue = [root];
	for (let index = 0; index < queue.length; index++) {
		const id = queue[index];
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const type = types.get(id);
		if (!type) continue;
		// XmlSerializer knows ordinary types reached through saved members as well
		// as explicit includes. An object-typed substitution can contain its owning
		// DescriptionElement even without an XmlInclude on that class.
		if (type.kind === "object" && !type.customXml) known.add(id);
		// Discover include declarations before resolving field codecs, so includes
		// on an unrelated owner can enable a derived type used elsewhere in the graph.
		for (const attribute of type.attributes ?? []) {
			if (attribute.type !== `${prefix}XmlIncludeAttribute`) continue;
			const state: State = {
				rootName: "",
				typeName: "",
				typeNamespace: "",
				includedTypes: [],
			};
			typeAnnotations[`${prefix}XmlIncludeAttribute`](attribute, state, id);
			for (const included of state.includedTypes) {
				if (!types.has(included))
					throw new Error(
						`${id}: included type is missing from catalog: ${included}`,
					);
				known.add(included);
				queue.push(included);
			}
		}
		if (type.baseType) queue.push(type.baseType);
		if (type.elementType) queue.push(type.elementType);
		// Known serializer payloads may contain their own include declarations.
		const serializer = customSerializer(type);
		if (serializer?.kind === "dictionary")
			queue.push(...serializer.arguments(type));
		for (const member of type.members ?? []) queue.push(member.type);
	}
	return known;
}

export function isAssignable(
	types: CatalogTypes,
	candidate: string,
	declared: string,
): boolean {
	const seen = new Set<string>();
	let current: string | undefined = candidate;
	while (current && !seen.has(current)) {
		if (current === declared || declared === "System.Object") return true;
		seen.add(current);
		current = types.get(current)?.baseType;
	}
	return false;
}
