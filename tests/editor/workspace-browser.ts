import { render } from "vitest-browser-svelte";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { openTestDocument } from "../helpers/open-editor.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";

/** Browser fixtures use the same file owner as Node fixtures, with real input
 * interactions and asynchronous unmounting before the owner is released. */
export async function renderBrowserWorkspace(
	document: SaveDocument,
	section?: string,
) {
	const opened = await openTestDocument(document);
	let unmount: (() => Promise<void>) | undefined;
	const dispose = async () => {
		// Await consumer teardown before closing the registry they borrow.
		try {
			await unmount?.();
		} finally {
			await opened.close();
		}
	};
	try {
		const page = await render(WorkspaceHarness, { model: opened.model });
		unmount = page.unmount;
		if (section) await page.getByRole("link", { name: section }).click();
		return { ...opened, page, dispose };
	} catch (cause) {
		// Acquisition failures have no caller to release the partially opened file.
		await dispose();
		throw cause;
	}
}
