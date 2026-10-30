import { expect, it } from "vitest";
import { freezeDraftState } from "../../src/lib/editor/draft-state";
import type { SessionState } from "../../src/lib/editor/domain";
import { tinyFixture } from "./fixtures";

const state = (): SessionState => ({ document: tinyFixture(), history: [] });

it("deeply freezes owned branches without changing scalars or missing fields", () => {
	const initial = state();
	initial.document.SaveGame.player.money = -0;
	const before = structuredClone(initial);
	expect(freezeDraftState(initial)).toBe(true);
	expect(initial).toEqual(before);
	expect(Object.is(initial.document.SaveGame.player.money, -0)).toBe(true);
	expect(Object.hasOwn(initial, "domainState")).toBe(false);
	expect(Object.isFrozen(initial)).toBe(true);
	expect(Object.isFrozen(initial.document.SaveGame.player.items.Item)).toBe(
		true,
	);
	// Reflection bypasses a producer proxy, so the underlying descendants must
	// themselves reject writes instead of relying on proxy traps for isolation.
	const document = Object.getOwnPropertyDescriptor(initial, "document")?.value;
	expect(() => {
		document.SaveGame.player.name = "Leaked";
	}).toThrow(TypeError);
	expect(() => {
		initial.document.SaveGame.player.items.Item.length = 0;
	}).toThrow(TypeError);
});

it("detects aliases across different branches and array positions", () => {
	for (const branches of [
		(shared: object) => ({ left: { shared }, right: { shared } }),
		(shared: object) => ({ values: [shared, shared] }),
	]) {
		const initial = state();
		const shared = { value: 1 };
		Object.assign(initial.document.SaveGame, branches(shared));
		expect(freezeDraftState(initial)).toBe(false);
		expect(Object.isFrozen(shared)).toBe(true);
		// Rechecking the same immutable root must retain its fallback decision.
		expect(freezeDraftState(initial)).toBe(false);
	}
});

it("finds newly introduced aliases between previously frozen subtrees", () => {
	const initial = state();
	const shared = { value: 1 };
	const left = { shared };
	Object.assign(initial.document.SaveGame, { left });
	expect(freezeDraftState(initial)).toBe(true);
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
	expect(freezeDraftState(aliased)).toBe(false);
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
	expect(freezeDraftState(distinct)).toBe(true);
	expect(freezeDraftState(initial)).toBe(true);
});
