import { fireEvent, render } from "@testing-library/svelte";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import WorkspaceHarness from "./WorkspaceHarness.svelte";
import { exportDocument } from "./fixtures.ts";
import { SaveProcessingSync } from "../../src/lib/editor/save-processing.ts";

/** Mount the production workspace with one file owner. Feature fixtures and
 * assertions stay in their suites; only shared acquisition/navigation/release live here. */
export async function renderTestWorkspace(
	document: SaveDocument,
	section?: string,
) {
	const opened = await openEditor(
		SaveProcessingSync,
		new TextEncoder().encode(exportDocument(document)),
	);
	let unmount: (() => void) | undefined;
	const dispose = async () => {
		// Consumers must release borrowed registry subscriptions before the file closes.
		try {
			unmount?.();
		} finally {
			await opened.close();
		}
	};
	try {
		const page = render(WorkspaceHarness, { model: opened.model });
		unmount = () => page.unmount();
		if (section)
			await fireEvent.click(page.getByRole("link", { name: section }));
		return { ...opened, page, dispose };
	} catch (cause) {
		// Failed setup has no caller-owned fixture yet, so it must release itself.
		await dispose();
		throw cause;
	}
}
