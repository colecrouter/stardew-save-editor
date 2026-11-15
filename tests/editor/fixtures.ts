import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import { parser } from "../helpers/editor-document.ts";
import fixtureXml from "../TestSave?raw";

export { fixtureXml };
export {
	parser,
	exportDocument,
	tinyFixture,
	scenarios,
} from "../helpers/editor-document.ts";

// Vite loads the public XML as text; standalone Node consumers retain their own loader.
export function loadFixture(): Promise<SaveDocument> {
	return Promise.resolve(parser.parse(fixtureXml));
}
