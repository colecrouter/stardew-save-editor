import pako from "pako";

// Read in the worker on downstream demand. Only one input chunk and the output
// of one small inflate push are retained; no full-file byte/string copy exists.
export function saveBlobBytes(
	blob: Blob,
	options: {
		// Infinity bypasses the adapter's subdivision for controlled comparisons.
		maxInputBytes?: number;
		// Diagnostics observe queue size only, never uploaded contents.
		onBufferedBytes?: (bytes: number) => void;
	} = {},
): ReadableStream<Uint8Array> {
	// Reject a zero/negative diagnostic step before acquiring a reader: it would
	// prevent input progress and leave a permanently pending pull.
	const limit = options.maxInputBytes;
	if (
		limit !== undefined &&
		limit !== Infinity &&
		(!Number.isSafeInteger(limit) || limit < 1)
	)
		throw new RangeError(
			"Input subdivision must be a positive integer or Infinity",
		);
	const reader = blob.stream().getReader();
	let input = new Uint8Array();
	let offset = 0;
	let first = true;
	let eof = false;
	let cancelled = false;
	let inflater: pako.Inflate | undefined;
	let inflatedComplete = false;
	const output: Uint8Array[] = [];
	let bufferedBytes = 0;
	const enqueue = (chunk: Uint8Array) => {
		output.push(chunk);
		bufferedBytes += chunk.byteLength;
		options.onBufferedBytes?.(bufferedBytes);
	};
	let released = false;
	const release = () => {
		if (!released) {
			released = true;
			reader.releaseLock();
		}
	};
	return new ReadableStream({
		async pull(controller) {
			try {
				while (!output.length && !eof && !cancelled) {
					if (offset === input.length) {
						const read = await reader.read();
						if (cancelled) return;
						if (read.done) {
							eof = true;
							if (inflater && !inflatedComplete) {
								inflater.push(new Uint8Array(), true);
								if (!inflatedComplete || inflater.err)
									throw new Error("Incomplete zlib stream");
							}
							release();
							break;
						}
						input = read.value;
						offset = 0;
						if (!input.length) continue;
						if (first) {
							first = false;
							// Match the game's zlib sniff without materializing the file first.
							if (input[0] === 120) {
								inflater = new pako.Inflate({ chunkSize: 16_384 });
								inflater.onData = (chunk) => {
									if (!(chunk instanceof Uint8Array))
										throw new Error("Unexpected inflate output");
									enqueue(chunk);
								};
								const onEnd = inflater.onEnd.bind(inflater);
								inflater.onEnd = (status) => {
									onEnd(status);
									inflatedComplete = status === 0;
								};
							}
						}
					}
					// Small compressed pushes bound expansion retained before the consumer
					// can apply backpressure. Uncompressed input needs no extra copying.
					const end = Math.min(
						input.length,
						offset + (options.maxInputBytes ?? (inflater ? 1024 : 65_536)),
					);
					const part = input.subarray(offset, end);
					offset = end;
					if (inflater) {
						if (!inflater.push(part, false))
							throw new Error(inflater.msg || "Invalid zlib stream");
					} else enqueue(part);
				}
				if (cancelled) return;
				const next = output.shift();
				if (next) {
					bufferedBytes -= next.byteLength;
					controller.enqueue(next);
				}
				if (eof && !output.length) controller.close();
			} catch (cause) {
				controller.error(cause);
				await reader.cancel().catch(() => undefined);
				release();
			}
		},
		async cancel() {
			// Cancellation must reach an outstanding read, not wait for an async
			// generator to finish that read before it can enter a finally block.
			cancelled = true;
			output.length = 0;
			await reader.cancel().catch(() => undefined);
			release();
		},
	});
}
