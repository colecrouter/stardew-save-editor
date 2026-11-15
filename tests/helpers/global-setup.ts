import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "devalue";
import type { TestProject } from "vitest/node";
import { parser } from "./editor-document.ts";

declare module "vitest" {
	interface ProvidedContext {
		editorFixturePath: string;
	}
}

/** Decode the public save once per run, before isolated test files start.
 * Devalue preserves bigint and undefined for both Node and real browsers without
 * sending the large save through worker configuration. Consumers clone edits. */
export default async function setup(project: TestProject) {
	// Keep the prepared fixture inside the workspace's existing filesystem allow
	// list so Browser Mode's readFile command needs no broader filesystem access.
	const parent = fileURLToPath(
		new URL("../../.svelte-kit/fixtures/", import.meta.url),
	);
	await mkdir(parent, { recursive: true });
	const directory = await mkdtemp(join(parent, "editor-fixture-"));
	try {
		// Match production byte decoding, including removal of the UTF-8 BOM.
		const xml = new TextDecoder().decode(
			await readFile(new URL("../TestSave", import.meta.url)),
		);
		const path = join(directory, "baseline.json");
		await writeFile(path, stringify({ xml, document: parser.parse(xml) }));
		project.provide("editorFixturePath", path);
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
	return () => rm(directory, { recursive: true, force: true });
}
