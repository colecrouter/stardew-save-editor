// Compatibility import for the original experiment; the application owns this implementation.
export * from "../../src/lib/editor/editor-model.ts";

import { openEditor as openApplicationEditor } from "../../src/lib/editor/editor-model.ts";
import type { HistoryLimits } from "../../src/lib/editor/history.ts";
// Contract tests enable comparison-only inventory/bundle commands explicitly.
export const openEditor = (bytes: Uint8Array, limits: HistoryLimits = {}) =>
	openApplicationEditor(bytes, limits, {
		includeProofs: true,
		validateExport: false,
	});

import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { openTestDocument } from "../helpers/open-editor.ts";
// Domain rejection tests may deliberately supply values the XML codec rejects.
// Construct the same application model directly for those in-memory scenarios.
export const openDocument = (
	document: SaveDocument,
	limits: HistoryLimits = {},
) =>
	openTestDocument(document, limits, {
		includeProofs: true,
		validateExport: false,
	});
