import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { isRecord } from "../../src/lib/unknown.ts";

// The runner installs plain fixture data without loading the XML runtime into
// legacy/component suites which never consume the generated save model.
let baseline: { xml: string; document: SaveDocument } | undefined;
export function setFixtureBaseline(value: unknown): void {
	// Both filesystem and browser adapters restore the same decoder-owned snapshot.
	// Check its transport envelope without decoding the full save again in every worker.
	if (
		!isRecord(value) ||
		typeof value["xml"] !== "string" ||
		!isRecord(value["document"])
	)
		throw new Error("Invalid decoded fixture snapshot envelope");
	// Global setup decoded this exact document with SaveCodec in this test run.
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The runner serializes the decoder-owned baseline after validating the save.
	baseline = value as NonNullable<typeof baseline>;
}
export function getFixtureBaseline(xml: string): SaveDocument | undefined {
	return baseline?.xml === xml ? baseline.document : undefined;
}
