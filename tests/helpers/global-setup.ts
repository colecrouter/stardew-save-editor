import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serialize } from "node:v8";
import type { TestProject } from "vitest/node";
import { parser } from "./editor-document.ts";

declare module "vitest" {
	interface ProvidedContext {
		editorFixturePath: string;
	}
}

/** Decode the public save once per run, before isolated test files start.
 * A V8 snapshot preserves bigint without sending the large save through worker
 * configuration. Each test file loads it privately and clones before editing. */
export default async function setup(project: TestProject) {
	const directory = await mkdtemp(join(tmpdir(), "editor-fixture-"));
	try {
		// Match production byte decoding, including removal of the UTF-8 BOM.
		const xml = new TextDecoder().decode(
			await readFile(new URL("../TestSave", import.meta.url)),
		);
		const path = join(directory, "baseline.bin");
		await writeFile(path, serialize({ xml, document: parser.parse(xml) }));
		project.provide("editorFixturePath", path);
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
	return () => rm(directory, { recursive: true, force: true });
}
