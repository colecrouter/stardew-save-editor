import type {
	CompilationContract,
	FieldContract,
	ObjectContract,
} from "./contract.ts";
import { recursiveObjects, referencedTypes } from "./graph.ts";

// Reserve complete declaration families, not just class names. A CLR FooSchema
// must not collide with the schema variable belonging to CLR Foo, for example.
const suffixes = [
	"",
	"Fields",
	"Value",
	"ValueSchema",
	"Schema",
	"Instance",
	"Variant",
];
export class Symbols {
	private readonly used = new Set([
		"Xml",
		"Schema",
		"Fragment",
		"FragmentSchema",
		"FragmentXmlSchema",
		"Preserved",
		"Variant",
		"DictionaryEntries",
		"InventorySlots",
		// A CLR identifier can be escaped in C# while still spelling a JS/TS
		// keyword. Keep generated type aliases legal without relying on its casing.
		"await",
		"break",
		"case",
		"catch",
		"class",
		"const",
		"continue",
		"debugger",
		"default",
		"delete",
		"do",
		"else",
		"enum",
		"export",
		"extends",
		"false",
		"finally",
		"for",
		"function",
		"if",
		"implements",
		"import",
		"in",
		"instanceof",
		"interface",
		"let",
		"new",
		"null",
		"package",
		"private",
		"protected",
		"public",
		"return",
		"static",
		"super",
		"switch",
		"this",
		"throw",
		"true",
		"try",
		"typeof",
		"var",
		"void",
		"while",
		"with",
		"yield",
		"any",
		"bigint",
		"boolean",
		"never",
		"number",
		"object",
		"string",
		"symbol",
		"unknown",
		"undefined",
		"Record",
		"ReadonlyArray",
		"Omit",
	]);
	allocate(preferred: string): string {
		const stem =
			preferred.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^(?=[0-9])/, "_") ||
			"Type";
		let name = stem;
		for (
			let index = 2;
			suffixes.some((suffix) => this.used.has(`${name}${suffix}`));
			index++
		)
			name = `${stem}${index}`;
		for (const suffix of suffixes) this.used.add(`${name}${suffix}`);
		return name;
	}
}
export interface PayloadPlan {
	readonly object: ObjectContract;
	readonly base?: PayloadPlan;
	readonly ownFields: readonly FieldContract[];
	readonly overrides: readonly string[];
}
export function planEmission(contract: CompilationContract) {
	const symbols = new Symbols();
	const byId = new Map(
		contract.objects.map((object) => [object.clrType, object]),
	);
	const simple = (id: string) =>
		id.split("[")[0]?.split(/[.+]/).at(-1)?.replace(/`\d+$/, "") ?? id;
	const counts = new Map<string, number>();
	for (const object of contract.objects)
		counts.set(
			simple(object.clrType),
			(counts.get(simple(object.clrType)) ?? 0) + 1,
		);
	const names = new Map<string, string>();
	// Sort before allocation so namespace collisions receive deterministic names,
	// independent of root traversal. Generic defaults already have readable names.
	for (const object of [...contract.objects].sort((a, b) =>
		a.clrType.localeCompare(b.clrType, "en"),
	)) {
		const short = simple(object.clrType);
		const preferred =
			counts.get(short) === 1
				? object.clrType.includes("`")
					? object.typeName
					: short
				: object.clrType.replace(/[.+]/g, "");
		names.set(object.clrType, symbols.allocate(preferred));
	}
	const payloads = new Map<string, PayloadPlan>();
	const active = new Set<string>();
	function payload(object: ObjectContract): PayloadPlan {
		const previous = payloads.get(object.clrType);
		if (previous) return previous;
		if (active.has(object.clrType))
			throw new Error(`${object.clrType}: cyclic payload inheritance`);
		active.add(object.clrType);
		const parent = object.baseType ? byId.get(object.baseType) : undefined;
		const fields = new Map(
			object.fields.map((field) => [field.memberName, field]),
		);
		// Only share an inspected base when every inherited slot is still present.
		// Ignored/removed members need the full local payload; changed mappings are
		// emitted as overrides rather than intersected with incompatible base types.
		const base =
			parent?.fields.length &&
			parent.fields.every((field) => fields.has(field.memberName))
				? payload(parent)
				: undefined;
		const inherited = new Map(
			base?.object.fields.map((field) => [field.memberName, field]) ?? [],
		);
		const ownFields = object.fields.filter(
			(field) =>
				JSON.stringify(field) !==
				JSON.stringify(inherited.get(field.memberName)),
		);
		const plan = {
			object,
			...(base ? { base } : {}),
			ownFields,
			overrides: ownFields
				.filter((field) => inherited.has(field.memberName))
				.map((field) => field.memberName),
		};
		active.delete(object.clrType);
		payloads.set(object.clrType, plan);
		return plan;
	}
	for (const object of contract.objects) payload(object);
	const liveFields = new Set<PayloadPlan>();
	function useFields(plan: PayloadPlan): void {
		if (liveFields.has(plan)) return;
		liveFields.add(plan);
		if (plan.base) useFields(plan.base);
	}
	for (const plan of payloads.values())
		if (!plan.object.isAbstract) useFields(plan);
	const referenced = new Set([
		contract.root.clrType,
		...contract.objects.flatMap((object) =>
			object.isAbstract
				? []
				: object.fields.flatMap((field) => referencedTypes(field.value)),
		),
	]);
	const recursive = recursiveObjects(contract);
	const explicitPayloads = new Set<string>();
	function mark(plan: PayloadPlan): void {
		if (explicitPayloads.has(plan.object.clrType)) return;
		explicitPayloads.add(plan.object.clrType);
		// Recursive payload intersections need concrete base payload types, even
		// when that base's discriminator schema can still infer its own union.
		if (plan.base) mark(plan.base);
	}
	for (const id of recursive) {
		const plan = payloads.get(id);
		if (plan) mark(plan);
	}
	// Map insertion follows inheritance dependencies, so shared fields precede
	// derived spreads. Schema references inside fields are deferred separately.
	return {
		symbols,
		names,
		payloads: [...payloads.values()],
		fieldPayloads: [...payloads.values()].filter((plan) =>
			liveFields.has(plan),
		),
		referenced,
		recursive,
		explicitPayloads,
	};
}
export type EmissionPlan = ReturnType<typeof planEmission>;
