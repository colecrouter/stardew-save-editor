import { Cause, Data, Effect, Exit } from "effect";

// The internal error channel is explicit; the Promise API still returns the
// original browser rejection so legacy and application callers remain compatible.
class BrowserCallFailure extends Data.TaggedError("BrowserCallFailure")<{
	readonly cause: unknown;
}> {}
const browserCall = <A>(run: () => Promise<A>) =>
	Effect.tryPromise({
		try: run,
		catch: (cause) => new BrowserCallFailure({ cause }),
	});
const browserCause = (cause: Cause.Cause<BrowserCallFailure>) => {
	const failure = Cause.squash(cause);
	return failure instanceof BrowserCallFailure ? failure.cause : failure;
};

/** A chosen destination owns no writable stream until validated bytes are ready. */
export interface SaveDestination {
	write: (blob: Blob, signal?: AbortSignal) => Promise<boolean>;
}

/**
 * Ask for a destination directly in the click handler, before export can exhaust
 * transient user activation. Cancellation returns no destination and skips export.
 * The fallback only records the filename; it starts no download until write().
 */
export async function chooseSaveDestination(
	filename: string,
	signal?: AbortSignal,
): Promise<SaveDestination | undefined> {
	if (signal?.aborted) return;
	if (!("showSaveFilePicker" in window))
		return {
			write: (blob, owner = signal) => writeDownload(blob, filename, owner),
		};
	try {
		const handle = await window.showSaveFilePicker({
			types: [
				{
					description: "Stardew Valley Save File",
					accept: { "text/text": [] },
				},
			],
			suggestedName: filename,
		});
		if (signal?.aborted) return;
		return {
			write: (blob, owner = signal) => writePicker(blob, handle, owner),
		};
	} catch (cause) {
		// Only dismissing the picker is ordinary cancellation. Later stream failures
		// must remain errors, including AbortError from a failed write or close.
		if (cause instanceof DOMException && cause.name === "AbortError") return;
		throw cause;
	}
}

/**
 * Convenience for callers whose bytes are already ready, such as original backups.
 * The signal suppresses work before writing; it cannot roll back a started write.
 * Fallback anchors/URLs are released after a delay needed by Safari/WebKit.
 * @returns True after a picker write completes or a fallback download starts;
 * false on picker cancellation or an aborted owner before writing.
 * @throws Browser failures other than picker cancellation.
 */
export async function downloadSave(
	blob: Blob,
	filename: string,
	signal?: AbortSignal,
): Promise<boolean> {
	const destination = await chooseSaveDestination(filename, signal);
	return destination ? destination.write(blob, signal) : false;
}

async function writePicker(
	blob: Blob,
	handle: FileSystemFileHandle,
	signal?: AbortSignal,
): Promise<boolean> {
	if (signal?.aborted) return false;
	const result = await Effect.runPromiseExit(
		Effect.acquireUseRelease(
			browserCall(() => handle.createWritable()),
			(writable) =>
				Effect.gen(function* () {
					// A late acquisition still belongs to this scope. Its finalizer
					// releases the unused stream without writing an abandoned file.
					if (signal?.aborted) return false;
					yield* browserCall(() => writable.write(blob));
					yield* browserCall(() => writable.close());
					return true;
				}),
			(writable, exit) => {
				// A successful close transfers ownership to the browser. A late,
				// unused acquisition must abort; without another failure to report,
				// cleanup rejection itself needs to reach the caller.
				if (Exit.isSuccess(exit)) {
					return exit.value ? Effect.void : browserCall(() => writable.abort());
				}
				// An already-errored stream can reject abort too. Preserve the
				// write/close failure rather than replacing it with a cleanup error.
				return browserCall(() => writable.abort(browserCause(exit.cause))).pipe(
					Effect.ignore,
				);
			},
		),
	);
	if (Exit.isFailure(result)) throw browserCause(result.cause);
	return result.value;
}

async function writeDownload(
	blob: Blob,
	filename: string,
	signal?: AbortSignal,
): Promise<boolean> {
	if (signal?.aborted) return false;
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	// Safari/WebKit needs a DOM-attached anchor and time to establish the stream.
	// The bounded timer owns cleanup even if the component leaves after the click.
	document.body.appendChild(anchor);
	try {
		anchor.click();
	} finally {
		setTimeout(() => {
			URL.revokeObjectURL(url);
			anchor.remove();
		}, 1000);
	}
	return true;
}
