import { expect, it } from "vitest";

import { editorResources } from "../../src/lib/editor/editor-model.ts";
import { fixtureXml, parser } from "./fixtures.ts";
import { renderTestWorkspace } from "./workspace.ts";

it("releases the workspace and file when initial section setup fails", async () => {
	// No fixture reaches the caller on setup failure, so caller finally blocks
	// cannot release it. The shared acquisition helper must own that failure path.
	await expect(
		renderTestWorkspace(parser.parse(fixtureXml), "Missing section"),
	).rejects.toThrow(/Missing section/);
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
	expect(document.querySelector(".editor")).toBeNull();
});
