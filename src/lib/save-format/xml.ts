import {
	Effect,
	Schema,
	SchemaIssue,
	SchemaTransformation,
	Stream,
} from "effect";
import { Xml } from "effect/encoding";
import type { Codec, Frame, Header } from "./events.ts";
import { invalid, namespaceAttribute, whitespace } from "./events.ts";

export function decodeChunks<A>(
	rootName: string,
	codec: Codec<A>,
	chunks: Iterable<string>,
) {
	return Effect.gen(function* () {
		const stack: Array<{ header: Header; frame: Frame }> = [];
		let result: unknown;
		let rootSeen = false;
		function* boundedChunks() {
			// The XML channel batches events produced by an input chunk. Bound that
			// chunk even for a caller supplying one complete save string, so the
			// parser cannot retain a document-sized batch of pending events.
			for (const chunk of chunks)
				for (let offset = 0; offset < chunk.length; offset += 16_384)
					yield chunk.slice(offset, offset + 16_384);
		}
		// Events are consumed as they arrive. Only open frames and decoded values
		// remain live; no parser-object tree or complete event buffer is built.
		yield* Stream.fromIterable(boundedChunks()).pipe(
			Stream.pipeThroughChannel(Xml.decodeString({ maxDepth: 128 })),
			Stream.runForEach((event) => {
				// Structural whitespace does not change a frame. String codecs have
				// their own text handler, so whitespace-only saved strings still survive.
				if (
					event._tag === "Text" &&
					stack.at(-1)?.frame.text === whitespace &&
					!event.text.trim()
				)
					return Effect.void;
				let ended: Header | undefined;
				return Effect.gen(function* () {
					if (event._tag === "Doctype")
						return yield* invalid("DOCTYPE is unsupported");
					if (event._tag === "StartElement") {
						const parent = stack.at(-1);
						const declarations = Object.entries(event.attributes)
							.filter(([name]) => namespaceAttribute(name))
							.map(([name, value]) => [
								name === "xmlns" ? "" : name.slice(6),
								value,
							]);
						const header = {
							name: event.name,
							attributes: event.attributes,
							namespaces:
								declarations.length === 0
									? (parent?.header.namespaces ?? {})
									: {
											...parent?.header.namespaces,
											...Object.fromEntries(declarations),
										},
						};
						if (!parent) {
							if (rootSeen) return yield* invalid("Expected one document root");
							if (event.name !== rootName)
								return yield* invalid(`Expected document root ${rootName}`);
							rootSeen = true;
						}
						const opening = parent
							? parent.frame.child(header)
							: codec.open(header);
						const frame = yield* opening;
						stack.push({ header, frame });
					} else if (event._tag === "Text") {
						const current = stack.at(-1);
						if (current) yield* current.frame.text(event.text);
						else if (event.text.trim())
							return yield* invalid("Text outside document root");
					} else if (event._tag === "EndElement") {
						const finished = stack.pop();
						ended = finished?.header;
						// The XML parser guarantees balanced events. A violation here is
						// an implementation defect, not an invalid user value.
						if (!finished || finished.header.name !== event.name)
							return yield* Effect.die(
								new Error("XML event stack is inconsistent"),
							);
						const value = yield* finished.frame.finish();
						if (!stack.length) result = value;
					}
					// Declarations, comments and processing instructions do not enter
					// the saved-value model and require no reader operation.
				}).pipe(
					Effect.mapError((issue) => {
						// Compute paths only for failures; building one for every successful
						// event dominates allocation on large, deeply nested saves.
						const path = stack.map((frame) => frame.header.name);
						if (ended) path.push(ended.name);
						else if (event._tag === "StartElement") path.push(event.name);
						return new SchemaIssue.Pointer(path, issue);
					}),
				);
			}),
		);
		// The root frame has already validated its value. This final schema check
		// gives the public function its exact generated decoded type.
		return yield* Schema.decodeUnknownEffect(Schema.toType(codec))(result).pipe(
			Effect.mapError((error) => error.issue),
		);
	});
}

export function document<A>(
	rootName: string,
	codec: Codec<A>,
): Schema.Codec<A, string> {
	return Schema.String.pipe(
		Schema.decodeTo(
			Schema.toType(codec),
			SchemaTransformation.transformEffect({
				decode: (source) =>
					decodeChunks(rootName, codec, [source]).pipe(
						Effect.mapError((error) =>
							Xml.isXmlError(error)
								? new SchemaIssue.InvalidValue({ message: error.message })
								: error,
						),
					),
				encode: (value) =>
					Stream.fromIterable(codec.events(rootName, value)).pipe(
						Stream.pipeThroughChannel(Xml.encodeString()),
						Stream.mkString,
						Effect.catchCause((cause) =>
							Effect.fail(
								new SchemaIssue.InvalidValue({ message: String(cause) }),
							),
						),
					),
			}),
		),
	);
}
