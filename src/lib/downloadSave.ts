import { Cause, Data, Effect, Exit } from "effect";

// The internal error channel is explicit; the Promise API still returns the
// original browser rejection so legacy and application callers remain compatible.
export class BrowserCallFailure extends Data.TaggedError("BrowserCallFailure")<{
	readonly cause: unknown;
	readonly stage: SaveDownloadStage;
}> {}
const browserCall = <A>(stage: SaveDownloadStage, run: () => Promise<A>) =>
	Effect.tryPromise({
		try: run,
		catch: (cause) => new BrowserCallFailure({ cause, stage }),
	});
const browserCause = (cause: Cause.Cause<BrowserCallFailure>) => {
	const failure = Cause.squash(cause);
	return failure instanceof BrowserCallFailure ? failure.cause : failure;
};

// Read cancellation afresh after asynchronous browser work; TypeScript must not
// carry an earlier readonly-property narrowing across an external abort event.
const isAborted = (signal: AbortSignal | undefined): boolean =>
	signal?.aborted === true;

/** A chosen destination owns no writable stream until validated bytes are ready. */
export interface SaveDestination {
	write: (blob: Blob, signal?: AbortSignal) => Promise<boolean>;
}

// Stages identify the browser operation that failed. Export preparation
// belongs to the application caller.
export type SaveDownloadStage =
	| "picker"
	| "create_writable"
	| "write"
	| "close"
	| "abort"
	| "download";

// Keep the Effect destination separate from the legacy Promise adapter so
// callers can retain the failure stage without decoding a browser exception.
interface SaveDestinationEffect {
	readonly completion: "close" | "download";
	write: (
		blob: Blob,
		signal?: AbortSignal,
	) => Effect.Effect<boolean, BrowserCallFailure>;
}

/** Start the picker directly from the click, before preparing the save. */
export async function chooseSaveDestinationEffect(
	filename: string,
	signal?: AbortSignal,
	mode: "picker" | "download" = "picker",
): Promise<SaveDestinationEffect | undefined> {
	if (isAborted(signal)) return;
	if (mode === "download" || !("showSaveFilePicker" in window))
		return {
			completion: "download",
			write: (blob, owner = signal) =>
				browserCall("download", () => writeDownload(blob, filename, owner)),
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
		if (isAborted(signal)) return;
		return {
			completion: "close",
			write: (blob, owner = signal) => writePicker(blob, handle, owner),
		};
	} catch (cause) {
		// Dismissing the picker is ordinary cancellation. Stream errors retain
		// their failure stage even if the browser also names them AbortError.
		if (cause instanceof DOMException && cause.name === "AbortError") return;
		throw new BrowserCallFailure({ stage: "picker", cause });
	}
}

/** Preserve the Promise contract and raw browser errors for existing callers. */
export async function chooseSaveDestination(
	filename: string,
	signal?: AbortSignal,
	mode: "picker" | "download" = "picker",
): Promise<SaveDestination | undefined> {
	try {
		const destination = await chooseSaveDestinationEffect(
			filename,
			signal,
			mode,
		);
		if (!destination) return;
		return {
			write: async (blob, owner = signal) => {
				const result = await Effect.runPromiseExit(
					destination.write(blob, owner),
				);
				if (Exit.isFailure(result)) throw browserCause(result.cause);
				return result.value;
			},
		};
	} catch (cause) {
		throw cause instanceof BrowserCallFailure ? cause.cause : cause;
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

function writePicker(
	blob: Blob,
	handle: FileSystemFileHandle,
	signal?: AbortSignal,
): Effect.Effect<boolean, BrowserCallFailure> {
	return Effect.suspend(() => {
		if (isAborted(signal)) return Effect.succeed(false);
		return Effect.acquireUseRelease(
			browserCall("create_writable", () => handle.createWritable()),
			(writable) =>
				Effect.gen(function* () {
					// A late acquisition still belongs to this scope. Its finalizer
					// releases the unused stream without writing an abandoned file.
					if (isAborted(signal)) return false;
					yield* browserCall("write", () => writable.write(blob));
					yield* browserCall("close", () => writable.close());
					return true;
				}),
			(writable, exit) => {
				// A successful close transfers ownership to the browser. A late,
				// unused acquisition must abort; without another failure to report,
				// cleanup rejection itself needs to reach the caller.
				if (Exit.isSuccess(exit)) {
					return exit.value
						? Effect.void
						: browserCall("abort", () => writable.abort());
				}
				// An already-errored stream can reject abort too. Preserve the
				// write/close failure rather than replacing it with a cleanup error.
				// Keep its stage too: this cleanup must not relabel a write as abort.
				return browserCall("abort", () =>
					writable.abort(browserCause(exit.cause)),
				).pipe(Effect.ignore);
			},
		);
	});
}

// Keep synchronous browser failures in the rejected-Promise channel expected by
// destination callers, even though anchor creation itself does not suspend.
// oxlint-disable-next-line typescript/require-await -- async preserves rejection behavior for synchronous DOM exceptions.
async function writeDownload(
	blob: Blob,
	filename: string,
	signal?: AbortSignal,
): Promise<boolean> {
	if (isAborted(signal)) return false;
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
