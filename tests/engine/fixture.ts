import { readFile } from "node:fs/promises";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { parser } from "../../tests/helpers/editor-document.ts";
export {
	parser,
	exportDocument,
	tinyFixture,
	scenarios,
} from "../../tests/helpers/editor-document.ts";

// Read the public save from disk; the shared parser reuses the prepared baseline.
export async function loadFixture(): Promise<SaveDocument> {
	const xml = await readFile(
		new URL("../../tests/TestSave", import.meta.url),
		"utf8",
	);
	return parser.parse(xml);
}
