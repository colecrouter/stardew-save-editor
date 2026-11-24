import { expect, it } from "vitest";
import { commands } from "vitest/browser";

it("guards local drafts and preserves applied edits through panel history", async () => {
	const result = await commands.checkEditorRouting();
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
