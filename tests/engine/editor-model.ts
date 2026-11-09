// Compatibility import for the original experiment; the application owns this implementation.
export * from "../../src/lib/editor/editor-model.ts";

import { openEditor as openApplicationEditor } from "../../src/lib/editor/editor-model.ts";
import type { HistoryLimits } from "../../src/lib/editor/history.ts";
import { SaveProcessingNode } from "../helpers/save-processing-node.ts";
// Contract tests enable comparison-only inventory/bundle commands explicitly.
export const openEditor = (bytes: Uint8Array, limits: HistoryLimits = {}) =>
	openApplicationEditor(SaveProcessingNode, bytes, limits, {
		includeProofs: true,
		validateExport: false,
	});
