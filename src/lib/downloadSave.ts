// Both editors use the same browser file behavior. Returning false means the
// user cancelled or the owning screen closed before a write could begin.
export async function downloadSave(
	blob: Blob,
	filename: string,
	signal?: AbortSignal,
): Promise<boolean> {
	if (signal?.aborted) return false;
	try {
		if ("showSaveFilePicker" in window) {
			const handle = await window.showSaveFilePicker({
				types: [
					{
						description: "Stardew Valley Save File",
						accept: { "text/text": [] },
					},
				],
				suggestedName: filename,
			});
			if (signal?.aborted) return false;
			const writable = await handle.createWritable();
			if (signal?.aborted) {
				await writable.abort();
				return false;
			}
			await writable.write(blob);
			await writable.close();
			return true;
		}
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
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === "AbortError")
			return false;
		throw cause;
	}
}
