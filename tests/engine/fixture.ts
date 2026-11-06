import { readFile } from "node:fs/promises";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { parser } from "../../tests/helpers/editor-document.ts";
export {
	parser,
	exportDocument,
	tinyFixture,
	scenarios,
} from "../../tests/helpers/editor-document.ts";

// Keep the native Node import graph free of Vite's raw-loader syntax.
export async function loadFixture(): Promise<SaveDocument> {
	const xml = await readFile(
		new URL("../../tests/TestSave", import.meta.url),
		"utf8",
	);
	return parser.parse(xml);
}
