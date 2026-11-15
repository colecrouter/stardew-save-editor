import { readFileSync } from "node:fs";

import { parse } from "devalue";
import { inject } from "vitest";

import { setFixtureBaseline } from "./fixture-context.ts";

// Each isolated test module starts from the same decoded baseline. Only the
// fixture cache sees this reference; parser callers always receive fresh clones.
setFixtureBaseline(parse(readFileSync(inject("editorFixturePath"), "utf8")));
