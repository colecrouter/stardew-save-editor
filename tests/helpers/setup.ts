import { readFileSync } from "node:fs";
import { deserialize } from "node:v8";
import { inject, vi } from "vitest";
import { setFixtureBaseline } from "./fixture-context.ts";

// Each isolated test module starts from the same decoded baseline. Only the
// fixture cache sees this reference; parser callers always receive fresh clones.
const fixture = deserialize(readFileSync(inject("editorFixturePath")));
setFixtureBaseline(fixture);

// Components consume Kit 3's state objects directly. Give isolated component tests
// a stable home-page snapshot without starting the browser navigation runtime.
vi.mock("$app/state", () => ({
	page: {
		url: new URL("http://localhost"),
		params: {},
		route: { id: "/" },
		status: 200,
		error: null,
		data: {},
		state: {},
		form: null,
	},
	navigating: {
		from: null,
		to: null,
		type: null,
		delta: null,
		willUnload: null,
		complete: null,
	},
	updated: { current: false, check: async () => false },
}));
