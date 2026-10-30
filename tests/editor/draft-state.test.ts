import { expect, it } from "vitest";
import { isDraftStateTree } from "../../src/lib/editor/draft-state";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "./fixtures";

const state = (): SessionState => ({ document: tinyFixture(), history: [] });

it("classifies a tree without changing or freezing owned data", () => {
	const initial = state();
	initial.document.SaveGame.player.money = -0;
	const before = structuredClone(initial);
	expect(isDraftStateTree(initial)).toBe(true);
	expect(initial).toEqual(before);
	expect(Object.is(initial.document.SaveGame.player.money, -0)).toBe(true);
	expect(Object.hasOwn(initial, "domainState")).toBe(false);
	expect(Object.isFrozen(initial)).toBe(false);
	expect(Object.isFrozen(initial.document.SaveGame.player.items.Item)).toBe(
		false,
	);
	// Classification must be recomputed after an owner changes the graph.
	Object.assign(initial, { alias: initial.document });
	expect(isDraftStateTree(initial)).toBe(false);
});

it("detects aliases across different branches and array positions", () => {
	for (const branches of [
		(shared: object) => ({ left: { shared }, right: { shared } }),
		(shared: object) => ({ values: [shared, shared] }),
	]) {
		const initial = state();
		const shared = { value: 1 };
		Object.assign(initial.document.SaveGame, branches(shared));
		expect(isDraftStateTree(initial)).toBe(false);
		expect(Object.isFrozen(shared)).toBe(false);
		// Rechecking an unchanged root must retain its fallback decision.
		expect(isDraftStateTree(initial)).toBe(false);
	}
});

it("finds newly introduced aliases between previously classified subtrees", () => {
	const initial = state();
	const shared = { value: 1 };
	const left = { shared };
	Object.assign(initial.document.SaveGame, { left });
	expect(isDraftStateTree(initial)).toBe(true);
	// Sharing an unchanged branch across revisions is normal. What matters is
	// whether the new root reaches one descendant along multiple paths.
	const aliased: SessionState = {
		...initial,
		document: {
			...initial.document,
			SaveGame: Object.assign(
				{ ...initial.document.SaveGame },
				{ right: { shared } },
			),
		},
	};
	expect(isDraftStateTree(aliased)).toBe(false);
	const distinct: SessionState = {
		...initial,
		document: {
			...initial.document,
			SaveGame: Object.assign(
				{ ...initial.document.SaveGame },
				{ right: { shared: { value: 1 } } },
			),
		},
	};
	expect(isDraftStateTree(distinct)).toBe(true);
	expect(isDraftStateTree(initial)).toBe(true);
});
