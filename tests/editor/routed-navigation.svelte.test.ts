import { expect, it } from "vitest";
import { commands } from "vitest/browser";

import {
	exportDocument,
	tinyEditorFixture,
} from "../helpers/editor-document.ts";

it("guards local drafts and preserves applied edits through panel history", async () => {
	// Calendar and farm fields are enough for history coverage. The full-save
	// codec tests own large-file processing.
	const result = await commands.checkEditorRouting(
		exportDocument(tinyEditorFixture()),
	);
	expect(result.warning).toMatch(/discard its unapplied changes/);
	expect(result.reloadWarning).toBe(result.warning);
	expect(result.canceled).toEqual({
		path: "/editor/calendar",
		year: result.editedYear,
		menuOpen: true,
	});
	expect(result.restoredYear).toBe(result.originalYear);
	expect(result.restoredFarmName).toBe("Route history farm");
	expect(result.guideStepRetained).toBe(true);
	expect(result.errors).toEqual([]);
});
