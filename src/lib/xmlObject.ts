import { Effect, Stream } from "effect";
import { Xml } from "effect/encoding";
import { arrayTags, nestedArrayTags } from "./workers/jank.ts";

type RecordNode = Record<string, unknown>;

// The editor's saved representation uses scalars for text-only elements and
// @_ attributes on records. Keep identifiers and imprecise numbers as strings.
function scalar(text: string): string | number | boolean {
	if (text === "true") return true;
	if (text === "false") return false;
	const trimmed = text.trim();
	// Farm/animal names such as "007", "0x1F" and "1e3" must keep their spelling.
	if (!/^[+-]?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)$/.test(trimmed)) return text;
	const number = Number(trimmed);
	if (!Number.isFinite(number) || /e/i.test(String(number))) return text;
	// Compare normalized decimal spellings to avoid rounding large multiplayer IDs.
	let normalized = trimmed.replace(/^\+/, "").replace(/^(-?)\./, "$10.");
	// Trim only the decimal suffix. A backtracking regex here can rescan long
	// internal zero runs quadratically when an opaque numeric value ends in 1.
	if (normalized.includes(".")) {
		let end = normalized.length;
		while (normalized.charCodeAt(end - 1) === 48) end--;
		if (normalized[end - 1] === ".") end--;
		normalized = normalized.slice(0, end);
	}

	return String(number) === normalized || normalized === "-0" ? number : text;
}

export function parseXmlObject(xml: string): RecordNode {
	const root: RecordNode = {};
	const stack: {
		name: string;
		path: string;
		record: RecordNode;
		text: string;
	}[] = [];
	// Consume events directly rather than retaining a second document-sized event
	// tree. Effect validates syntax while scanning, replacing a separate XML pass.
	function* chunks() {
		// Bound transient event batches while allowing the parser to carry tokens
		// across 64 Ki UTF-16 code-unit boundaries (including surrogate pairs).
		for (let offset = 0; offset < xml.length; offset += 64 * 1024)
			yield xml.slice(offset, offset + 64 * 1024);
	}
	Effect.runSync(
		Stream.fromIterable(chunks(), { chunkSize: 1 }).pipe(
			// Mod data may contain a single opaque value larger than Effect's
			// default token cap. Preserve it; retain the default nesting-depth guard.
			Stream.pipeThroughChannel(Xml.decodeString({ maxTokenSize: Infinity })),
			Stream.runForEachArray((events) =>
				Effect.sync(() => {
					for (const event of events) {
						// A frame retains attributes, child fields and joined text until its
						// closing tag determines whether it is a scalar or a record.
						if (event._tag === "StartElement") {
							const parent = stack.at(-1);
							const record: RecordNode = {};
							for (const [name, value] of Object.entries(event.attributes))
								record[`@_${name}`] = value;
							stack.push({
								name: event.name,
								path: parent ? `${parent.path}.${event.name}` : event.name,
								record,
								text: "",
							});
						} else if (event._tag === "Text") {
							const current = stack.at(-1);
							if (current) current.text += event.text;
						} else if (event._tag === "EndElement") {
							const current = stack.pop();
							if (!current) throw new Error("XML element stack is empty");
							const { name, path, record, text } = current;
							// Indentation is not saved data. Literal spaces without line breaks remain
							// meaningful, including a player-entered name consisting only of spaces.
							const formatting = text.trim() === "" && /[\r\n]/.test(text);
							const value =
								Object.keys(record).length === 0
									? scalar(formatting ? "" : text)
									: record;
							if (value === record && text && !formatting)
								record["#text"] = scalar(text);
							const parent = stack.at(-1)?.record ?? root;
							// Known game collections must stay arrays even with one member.
							// Parent paths disambiguate tags also used as scalar fields.
							const forceArray =
								arrayTags.has(name) ||
								[...(nestedArrayTags.get(name) ?? [])].some((tag) =>
									path.endsWith(`.${tag}.${name}`),
								);
							// Repeated unfamiliar tags also form arrays, preserving mod data.
							if (Object.hasOwn(parent, name)) {
								const previous = parent[name];
								if (Array.isArray(previous)) previous.push(value);
								else parent[name] = [previous, value];
							} else {
								// Define own members so unfamiliar mod names cannot invoke prototype setters.
								Object.defineProperty(parent, name, {
									value: forceArray ? [value] : value,
									enumerable: true,
									writable: true,
									configurable: true,
								});
							}
						} else if (event._tag === "ProcessingInstruction") {
							// Preserve opaque instruction data without interpreting it as game fields.
							const parent = stack.at(-1)?.record ?? root;
							const name = `?${event.target}`;
							const value = { "#text": event.data };
							if (Object.hasOwn(parent, name)) {
								const previous = parent[name];
								if (Array.isArray(previous)) previous.push(value);
								else parent[name] = [previous, value];
							} else parent[name] = value;
						} else if (event._tag === "Declaration") {
							// Preserve the existing declaration representation expected by export/tests.
							root["?xml"] = {
								"@_version": event.version,
								...(event.encoding ? { "@_encoding": event.encoding } : {}),
								...(event.standalone !== undefined
									? { "@_standalone": event.standalone ? "yes" : "no" }
									: {}),
							};
						}
					}
				}),
			),
		),
	);
	// Comments and DTD declarations do not enter the saved record representation;
	// Effect still checks their syntax and rejects undeclared entity references.
	return root;
}

// The saved representation only admits scalar text and attributes. Reject an
// unsupported object instead of silently exporting the string "[object Object]".
function xmlText(value: unknown): string {
	if (typeof value === "string") return value;
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	)
		return String(value);
	throw new Error("XML text and attributes require scalar values");
}

export function buildXmlObject(document: unknown, pretty: boolean): string {
	// Yield events as the encoder requests them, so export does not retain an
	// additional event object for every element in the complete save.
	function* element(
		name: string,
		value: unknown,
		depth = 0,
	): Generator<Xml.Event> {
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index++) {
				if (pretty && index > 0)
					yield { _tag: "Text", text: `\n${"    ".repeat(depth)}` };
				yield* element(name, value[index], depth);
			}
			return;
		}
		// Undefined members and empty arrays represent omitted saved fields. Null
		// represents an empty element; xsi:nil remains an explicit saved attribute.
		if (value === undefined) return;
		if (name.startsWith("?")) {
			// Legacy cached records may store instruction attributes; new imports keep
			// the opaque instruction body. Both encodings remain readable on export.
			const instruction = value as RecordNode;
			const data = Object.hasOwn(instruction, "#text")
				? xmlText(instruction["#text"])
				: Object.entries(instruction)
						.filter(([key]) => key.startsWith("@_"))
						.map(([key, entry]) => `${key.slice(2)}="${xmlText(entry)}"`)
						.join(" ");
			yield { _tag: "ProcessingInstruction", target: name.slice(1), data };
			return;
		}
		const record =
			value !== null && typeof value === "object"
				? (value as RecordNode)
				: undefined;
		const attributes: Record<string, string> = Object.create(null);
		if (record)
			for (const [key, entry] of Object.entries(record)) {
				if (key.startsWith("@_") && entry !== undefined)
					attributes[key.slice(2)] = xmlText(entry);
			}
		yield { _tag: "StartElement", name, attributes };
		if (record) {
			const content = Object.entries(record).filter(
				([key, entry]) =>
					!key.startsWith("@_") &&
					entry !== undefined &&
					(!Array.isArray(entry) || entry.length > 0),
			);
			// Only element-only content can acquire indentation. Whitespace inside mixed
			// content or scalar values is part of the saved text and must remain intact.
			const indent =
				pretty && !Object.hasOwn(record, "#text") && content.length > 0;
			for (const [key, entry] of content) {
				if (key === "#text") yield { _tag: "Text", text: xmlText(entry) };
				else {
					if (indent)
						yield { _tag: "Text", text: `\n${"    ".repeat(depth + 1)}` };
					yield* element(key, entry, depth + 1);
				}
			}
			if (indent) yield { _tag: "Text", text: `\n${"    ".repeat(depth)}` };
		} else if (value !== null && value !== "")
			yield { _tag: "Text", text: xmlText(value) };
		yield { _tag: "EndElement", name };
	}
	function* events(): Generator<Xml.Event> {
		// The declaration is a pseudo-member in the existing saved representation,
		// while Effect models it separately from game elements and their attributes.
		for (const [name, value] of Object.entries(document as RecordNode)) {
			if (name === "?xml") {
				const declaration = value as RecordNode;
				yield {
					_tag: "Declaration",
					version: xmlText(declaration["@_version"] ?? "1.0"),
					...(declaration["@_encoding"] !== undefined
						? { encoding: xmlText(declaration["@_encoding"]) }
						: {}),
					...(declaration["@_standalone"] !== undefined
						? { standalone: declaration["@_standalone"] === "yes" }
						: {}),
				};
				// Keep the legacy pretty-export declaration on its own line; compact
				// downloads retain their existing whitespace-free declaration boundary.
				if (pretty) yield { _tag: "Text", text: "\n" };
			} else yield* element(name, value);
		}
	}
	const chunks = Effect.runSync(
		Stream.fromIterable(events()).pipe(
			Stream.pipeThroughChannel(Xml.encodeString()),
			Stream.runCollect,
		),
	);
	// Effect emits explicit closing tags. Compact only empty pairs; escaped text
	// cannot contain a literal tag, and quoted attribute values are matched whole.
	// Add the game's space here, where quoted attribute values remain intact.
	// A global slash/greater-than replacement would also rewrite saved attributes.
	return chunks
		.join("")
		.replace(/<([^\s<>/]+)((?:\s+[^=\s]+="[^"]*")*)><\/\1>/g, "<$1$2 />");
}
