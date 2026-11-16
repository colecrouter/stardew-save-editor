import { expect, it } from "vitest";

import { readProgress } from "../../src/lib/editor/progress-data.ts";
import {
	concealedAchievement,
	presentProgressCategory,
} from "../../src/lib/editor/progress-spoilers.ts";
import { requireDefined } from "../helpers/assertions.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

it("conceals secret awards unless this farmer has a recorded award", () => {
	const view = readProgress(tinyEditorFixture());
	const awards = requireDefined(view.farmers[0]).achievements;
	const secret = requireDefined(awards.find((award) => award.id === 40));
	expect(concealedAchievement({ ...secret, recorded: false }, true)).toBe(true);
	expect(concealedAchievement({ ...secret, recorded: undefined }, true)).toBe(
		true,
	);
	expect(concealedAchievement({ ...secret, recorded: true }, true)).toBe(false);
	expect(concealedAchievement(secret, false)).toBe(false);
	expect(
		concealedAchievement(
			requireDefined(awards.find((award) => award.id === 15)),
			true,
		),
	).toBe(false);
});

it("conceals uncertain endgame identities without changing scores or collection checklists", () => {
	const view = readProgress(tinyEditorFixture());
	const clock = requireDefined(
		view.shared.find((category) => category.id === "clock"),
	);
	const concealed = presentProgressCategory(clock, true);
	expect(concealed.label).toBe("Undiscovered milestone");
	expect(requireDefined(concealed.requirements[0]).name).toBe(
		"Undiscovered requirement",
	);
	expect(concealed.lower).toBe(clock.lower);
	expect(concealed.upper).toBe(clock.upper);
	expect(concealed.section).toBeUndefined();
	expect(clock.label).toBe("Golden Clock");
	const discovered = {
		...clock,
		requirements: [
			{ name: "Gold Clock", status: "complete" as const, value: 1 },
		],
	};
	expect(presentProgressCategory(discovered, true)).toBe(discovered);
	const cooking = requireDefined(
		requireDefined(view.farmers[0]).categories.find(
			(category) => category.id === "cooking",
		),
	);
	expect(presentProgressCategory(cooking, true)).toBe(cooking);
});
