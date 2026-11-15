import { parse } from "devalue";
import { inject } from "vitest";
import { commands } from "vitest/browser";

import { setFixtureBaseline } from "./fixture-context.ts";

// Use Vitest's Node-side file command instead of bundling filesystem APIs into
// the browser. Every isolated module receives its own bigint-preserving baseline.
setFixtureBaseline(
	parse(await commands.readFile(inject("editorFixturePath"), "utf8")),
);
