import type { SaveDocument } from "../../src/lib/editor/domain.ts";

// The runner installs plain fixture data without loading the XML runtime into
// legacy/component suites which never consume the generated save model.
let baseline: { xml: string; document: SaveDocument } | undefined;
export function setFixtureBaseline(value: NonNullable<typeof baseline>): void {
	baseline = value;
}
export function getFixtureBaseline(xml: string): SaveDocument | undefined {
	return baseline?.xml === xml ? baseline.document : undefined;
}
