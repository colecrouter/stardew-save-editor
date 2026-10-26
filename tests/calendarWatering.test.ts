import { describe, expect, it } from "vitest";
import {
	planRainWatering,
	type WateringMark,
	type WateringTarget,
} from "$lib/calendarWatering";

const soil = (
	id: string,
	value: number | undefined,
	context = "Default",
	outdoors = true,
): WateringTarget => ({ id, kind: "soil", value, context, outdoors });
const bowl = (
	id: string,
	value: boolean | undefined,
	context = "Default",
): WateringTarget => ({ id, kind: "bowl", value, context, outdoors: true });
const plan = (
	targets: readonly WateringTarget[],
	provenance: readonly WateringMark[] = [],
	wasRaining = false,
	raining = true,
) =>
	planRainWatering({
		targets,
		provenance,
		context: "Default",
		wasRaining,
		raining,
	});

describe("reversible rain preparation", () => {
	it("waters affected outdoor targets across locations and preserves wet, hidden, indoor and independent-context targets", () => {
		const targets = [
			soil("farm", 0),
			soil("forest", 0),
			bowl("pet", false),
			soil("wet", 1),
			soil("hidden", 2),
			soil("indoors", 0, "Default", false),
			soil("island", 0, "Island"),
		];
		const before = structuredClone(targets);
		const result = plan(targets);
		expect(result.writes.map((write) => write.id)).toEqual([
			"farm",
			"forest",
			"pet",
		]);
		expect(result.provenance).toEqual([
			{ id: "farm", context: "Default", kind: "soil", before: 0 },
			{ id: "forest", context: "Default", kind: "soil", before: 0 },
			{ id: "pet", context: "Default", kind: "bowl", before: false },
		]);
		expect(targets).toEqual(before);
	});

	it("restores serializable provenance against reordered and cloned target snapshots", () => {
		const started = plan([
			soil("soil", 0),
			bowl("bowl", false),
			soil("missing-value", undefined),
		]);
		const restored = JSON.parse(
			JSON.stringify(started.provenance),
		) as WateringMark[];
		expect(Object.hasOwn(started.provenance[2] ?? {}, "before")).toBe(false);
		const result = plan(
			[bowl("bowl", true), soil("missing-value", 1), soil("soil", 1)],
			restored,
			true,
			false,
		);
		expect(result.writes).toEqual([
			{ id: "soil", kind: "soil", value: 0 },
			{ id: "bowl", kind: "bowl", value: false },
			{ id: "missing-value", kind: "soil", value: undefined },
		]);
		expect(result.provenance).toEqual([]);
		expect(restored).toHaveLength(3);
	});

	it("ignores removed/replaced targets, intervening edits and moves to another context", () => {
		const started = plan([
			soil("removed", 0),
			soil("changed", 0),
			soil("moved", 0),
			bowl("emptied", false),
		]);
		const result = plan(
			[
				soil("replacement", 1),
				soil("changed", 2),
				soil("moved", 1, "Island"),
				bowl("emptied", false),
			],
			started.provenance,
			true,
			false,
		);
		expect(result).toEqual({ writes: [], provenance: [] });
	});

	it("preserves other contexts' provenance and does nothing between rainy weather choices", () => {
		const marks: WateringMark[] = [
			{ id: "valley", context: "Default", kind: "soil", before: 0 },
			{ id: "island", context: "Island", kind: "soil", before: 0 },
		];
		const targets = [soil("valley", 1), soil("island", 1, "Island")];
		expect(plan(targets, marks, true, true)).toEqual({
			writes: [],
			provenance: marks,
		});
		expect(plan(targets, marks, true, false)).toEqual({
			writes: [{ id: "valley", kind: "soil", value: 0 }],
			provenance: [marks[1]],
		});
	});

	it("leaves watering from the imported save untouched and accepts arbitrary identity strings", () => {
		expect(
			plan([soil("wet", 1), bowl("pet", true)], [], true, false).writes,
		).toEqual([]);
		expect(plan([soil("__proto__", 0)]).writes).toEqual([
			{ id: "__proto__", kind: "soil", value: 1 },
		]);
	});

	it("rejects ambiguous identities before producing writes", () => {
		expect(() => plan([soil("same", 0), bowl("same", false)])).toThrow(
			"Duplicate watering target",
		);
		const mark: WateringMark = {
			id: "same",
			kind: "soil",
			context: "Default",
			before: 0,
		};
		expect(() => plan([soil("same", 1)], [mark, mark], true, false)).toThrow(
			"Duplicate watering provenance",
		);
	});
});
