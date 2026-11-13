import { readFileSync } from "node:fs";
import { deserialize } from "node:v8";
import { inject } from "vitest";
import { setFixtureBaseline } from "./fixture-context.ts";

// Each isolated test module starts from the same decoded baseline. Only the
// fixture cache sees this reference; parser callers always receive fresh clones.
const fixture = deserialize(readFileSync(inject("editorFixturePath")));
setFixtureBaseline(fixture);
