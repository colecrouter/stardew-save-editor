import fixtureXml from "../TestSave?raw";
import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { parser } from "../helpers/editor-document.ts";
export { fixtureXml };
export {
	parser,
	exportDocument,
	tinyFixture,
	scenarios,
} from "../helpers/editor-document.ts";

// Vite loads the public XML as text; standalone Node consumers retain their own loader.
export async function loadFixture(): Promise<SaveDocument> {
	return parser.parse(fixtureXml);
}
