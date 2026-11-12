import type { CompilationContract } from "./contract.ts";
import { planEmission } from "./emission-plan.ts";
import { ValueEmission, propertyName } from "./value-emission.ts";

const quote = (value: string) => JSON.stringify(value);
export function emitModule(
	contract: CompilationContract,
	runtimeImport: string,
): string {
	const plan = planEmission(contract);
	const values = new ValueEmission(plan);
	const name = (id: string) => values.objectName(id);
	const payloads = new Map(
		plan.payloads.map((payload) => [payload.object.clrType, payload]),
	);
	const neededValues = new Set<string>();
	const explicitTypes = new Map<string, string>();
	// Only recursive schemas need explicit decoded types. Acyclic schemas and
	// acyclic parents of cycles infer theirs through the annotated cycle boundary.
	for (const id of plan.recursive)
		if (plan.referenced.has(id)) values.neededObjects.add(id);
	for (const id of plan.explicitPayloads) {
		const payload = payloads.get(id);
		if (
			!payload ||
			(payload.object.isAbstract &&
				!plan.payloads.some((candidate) => candidate.base === payload))
		)
			continue;
		neededValues.add(id);
		let local = payload.ownFields.length
			? `{\n${payload.ownFields.map((field) => `\treadonly ${propertyName(field.memberName)}${field.optional ? "?" : ""}: ${values.fieldType(field)};`).join("\n")}\n}`
			: "Record<string, never>";
		if (payload.base) {
			const base = payload.base.object.clrType;
			neededValues.add(base);
			const inherited = payload.overrides.length
				? `Omit<${name(base)}Value, ${payload.overrides.map(quote).join(" | ")}>`
				: `${name(base)}Value`;
			// An empty extension is just its base. Intersecting with Record<string,
			// never> would accidentally forbid the inherited properties themselves.
			local = payload.ownFields.length ? `${inherited} & ${local}` : inherited;
		}
		explicitTypes.set(id, `type ${name(id)}Value = ${local};`);
	}
	const fields: string[] = [];
	const schemas: string[] = [];
	// Payload field maps are composed in inheritance order, with changed bindings
	// overriding the base's slot. Abstract bases may supply fields without having
	// a concrete value schema of their own.
	for (const payload of plan.fieldPayloads) {
		const object = payload.object;
		const base = payload.base
			? `\t...${name(payload.base.object.clrType)}Fields,\n`
			: "";
		fields.push(
			`// Saved payload fields of ${quote(object.clrType)}.\nconst ${name(object.clrType)}Fields = {\n${base}${payload.ownFields.map((field) => values.field(field)).join("\n")}\n};`,
		);
		if (!object.isAbstract) {
			const annotation = plan.explicitPayloads.has(object.clrType)
				? `: Schema.Codec<Preserved<${name(object.clrType)}Value>, Xml.XmlElement> & { readonly valueSchema: Schema.Codec<${name(object.clrType)}Value> }`
				: "";
			schemas.push(
				`const ${name(object.clrType)}ValueSchema${annotation} = Xml.structure(${name(object.clrType)}Fields, { allowType: true });`,
			);
		}
	}
	const wrappers: string[] = [];
	const variantUses = new Map<string, number>();
	for (const object of contract.objects)
		if (plan.referenced.has(object.clrType))
			for (const variant of object.variants)
				if (variant !== object.clrType)
					variantUses.set(variant, (variantUses.get(variant) ?? 0) + 1);
	const sharedVariants = new Map<string, string>();
	const variantSchemas: string[] = [];
	const variantExpression = (id: string, allowMissing: boolean): string => {
		const concrete = payloads.get(id)?.object;
		if (!concrete) throw new Error(`Missing concrete variant ${id}`);
		return `Xml.variant(${quote(id)}, ${JSON.stringify({ name: concrete.typeName, namespace: concrete.typeNamespace })}, ${name(id)}ValueSchema, ${allowMissing})`;
	};
	// Derived-case discriminator codecs are identical across declared unions.
	// A concrete declared base still gets its distinct allow-missing policy.
	for (const [id, count] of variantUses)
		if (count > 1) {
			const symbol = `${name(id)}Variant`;
			sharedVariants.set(id, symbol);
			variantSchemas.push(`const ${symbol} = ${variantExpression(id, false)};`);
		}
	for (const object of contract.objects) {
		if (!plan.referenced.has(object.clrType)) continue;
		const alternatives = object.variants.map(
			(id) =>
				(id !== object.clrType ? sharedVariants.get(id) : undefined) ??
				variantExpression(id, id === object.clrType),
		);
		if (alternatives.length > 1) values.usesSchema = true;
		let expression =
			alternatives.length === 1
				? alternatives[0]
				: `Schema.Union([${alternatives.join(", ")}])`;
		if (object.clrType === "System.Object")
			expression = `Xml.anyObject(${expression})`;
		if (plan.recursive.has(object.clrType)) {
			values.usesSchema = true;
			wrappers.push(
				`const ${name(object.clrType)}Schema: Schema.Codec<${name(object.clrType)}, Xml.XmlElement> = Schema.suspend(() => ${expression});`,
			);
		} else
			wrappers.push(`const ${name(object.clrType)}Schema = ${expression};`);
	}
	const objectTypes: string[] = [];
	// Factor repeated concrete cases out of explicit unions too. Inferred schemas
	// need no parallel union declaration; only types crossing a recursive boundary
	// require these aliases and their concrete payload type dependencies.
	const instanceUses = new Map<string, number>();
	for (const id of values.neededObjects)
		if (plan.recursive.has(id))
			for (const variant of payloads.get(id)?.object.variants ?? [])
				instanceUses.set(variant, (instanceUses.get(variant) ?? 0) + 1);
	const instanceTypes: string[] = [];
	for (const [id, count] of instanceUses)
		if (count > 1)
			instanceTypes.push(
				`type ${name(id)}Instance = Variant<${quote(id)}, ${name(id)}Value>;`,
			);
	for (const id of values.neededObjects) {
		const object = payloads.get(id)?.object;
		if (!object) throw new Error(`Missing declared type ${id}`);
		if (!plan.recursive.has(id)) {
			objectTypes.push(`type ${name(id)} = typeof ${name(id)}Schema.Type;`);
			continue;
		}
		const variants = object.variants.map((variant) => {
			neededValues.add(variant);
			return (instanceUses.get(variant) ?? 0) > 1
				? `${name(variant)}Instance`
				: `Variant<${quote(variant)}, ${name(variant)}Value>`;
		});
		if (id === "System.Object") variants.push("Xml.ScalarObject");
		objectTypes.push(`type ${name(id)} = ${variants.join(" | ")};`);
	}
	const valueTypes = [...neededValues].map(
		(id) =>
			explicitTypes.get(id) ??
			`type ${name(id)}Value = typeof ${name(id)}ValueSchema.valueSchema.Type;`,
	);
	const helpers = valueTypes.length
		? [
				"type Preserved<A> = { readonly value: A; readonly original: Xml.XmlElement };",
				"type Variant<Id extends string, A> = { readonly type: Id } & Preserved<A>;",
				...(values.usesDictionaryType
					? [
							"type DictionaryEntries<K, V> = Preserved<ReadonlyArray<Preserved<{ readonly key: K; readonly value: V }>>>;",
						]
					: []),
				...(values.usesInventoryType
					? [
							"type InventorySlots<A> = Preserved<ReadonlyArray<Preserved<A | null>>>;",
						]
					: []),
			]
		: [];
	const scalarTypes = [...values.scalarTypes].map(
		([definition, type]) => `type ${type} = typeof ${definition}.Type;`,
	);
	// Shared value definitions and inherited field maps precede payload schemas.
	// Their object edges are suspended; explicit types close only genuine cycles.
	return `// Generated from catalog format 3 for ${quote(contract.root.clrType)}. Do not edit.
// Values are edited through .value; .original retains unmodeled XML.
${values.usesSchema || valueTypes.length ? 'import { Schema } from "effect";\n' : ""}import * as Xml from ${quote(runtimeImport)};

${[...helpers, ...scalarTypes, ...valueTypes, ...instanceTypes, ...objectTypes, ...values.declarations, ...fields, ...schemas, ...variantSchemas, ...wrappers].join("\n\n")}

export const FragmentSchema = Xml.named(${quote(contract.root.xmlName)}, ${name(contract.root.clrType)}Schema);
export const FragmentXmlSchema = Xml.fromXml(FragmentSchema);
export type Fragment = typeof FragmentSchema.Type;
`;
}
