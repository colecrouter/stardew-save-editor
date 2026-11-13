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
	// Text callers retain the established synchronous iterable interface.
	function* boundedChunks() {
		for (const chunk of chunks)
			for (let offset = 0; offset < chunk.length; offset += 16_384)
				yield chunk.slice(offset, offset + 16_384);
	}
	// Create the iterator for each evaluation so reusing this Effect does not
	// reuse an already-consumed generator from an earlier decode.
	return Effect.suspend(() =>
		decodeEvents(
			rootName,
			codec,
			Stream.fromIterable(boundedChunks(), { chunkSize: 1 }).pipe(
				Stream.pipeThroughChannel(Xml.decodeString({ maxDepth: 128 })),
			),
		),
	);
}

// Byte callers keep UTF-8 decoding inside the XML channel, including characters
// split between reads. The same interpreter and final value checks serve both paths.
export function decodeByteStream<A, E>(
	rootName: string,
	codec: Codec<A>,
	bytes: Stream.Stream<Uint8Array, E>,
) {
	return decodeEvents(
		rootName,
		codec,
		bytes.pipe(Stream.pipeThroughChannel(Xml.decode({ maxDepth: 128 }))),
	);
}

function decodeEvents<A, E>(
	rootName: string,
	codec: Codec<A>,
	events: Stream.Stream<Xml.Event, E>,
) {
	return Effect.gen(function* () {
		const stack: Array<{ header: Header; frame: Frame }> = [];
		let result: unknown;
		let rootSeen = false;

		// Upstream supplies bounded batches; the interpreter consumes each before
		// requesting another input chunk, so stream cancellation stops further reads.
		yield* events.pipe(
			Stream.runForEachArray((events) => {
				// One interpreter Effect owns a bounded event batch. Per-event generator
				// and error-wrapper Effects otherwise dominate allocation on full saves.
				let active: Xml.Event | undefined;
				let ended: Header | undefined;
				return Effect.gen(function* () {
					for (const event of events) {
						active = event;
						ended = undefined;
						// Structural whitespace has no frame operation; scalar text handlers
						// still receive whitespace-only strings because those are saved values.
						if (
							event._tag === "Text" &&
							stack.at(-1)?.frame.text === whitespace &&
							!event.text.trim()
						)
							continue;
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
								if (rootSeen)
									return yield* invalid("Expected one document root");
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
							// Balanced events are guaranteed by the XML channel. A mismatch here
							// is an interpreter defect rather than an expected user-input failure.
							if (!finished || finished.header.name !== event.name)
								return yield* Effect.die(
									new Error("XML event stack is inconsistent"),
								);
							const value = yield* finished.frame.finish();
							if (!stack.length) result = value;
						}
						// Declarations, comments and instructions do not enter the typed model.
					}
				}).pipe(
					Effect.mapError((issue) => {
						// Capture the active event outside the interpreter so a failure can build
						// its exact path lazily, including an element already popped by finish().
						const path = stack.map((frame) => frame.header.name);
						if (ended) path.push(ended.name);
						else if (active?._tag === "StartElement") path.push(active.name);
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
