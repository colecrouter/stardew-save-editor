import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { type GameLocation, Season, Status } from "../codegen/save";
import { babyQuestionStatus, readHome } from "../src/lib/babyQuestion";
import { Raw } from "../src/lib/proxies";
import { Friendship } from "../src/lib/proxies/Friendship.svelte";
import BabyQuestion from "../src/routes/(edit)/relationships/BabyQuestion.svelte";

const today = { year: 2, season: Season.Spring, day: 10 };
const home = { upgradeLevel: 2, cribStyle: 1, children: 0, toddlers: 0 };

/** A spouse who meets everything, with `change` applied to the save data */
const spouse = (change?: (f: Record<string, unknown>) => void) => {
	const raw = Friendship.fromName("Abigail")[Raw];
	const f = raw.value.Friendship;
	f.Status = Status.Married;
	f.Points = 2500;
	f.WeddingDate = { Year: 1, Season: Season.Fall, DayOfMonth: 1 };
	change?.(f as unknown as Record<string, unknown>);
	let friendship!: Friendship;
	$effect.root(() => {
		friendship = new Friendship(raw);
	});
	flushSync();
	return friendship;
};

const unmet = (s: ReturnType<typeof babyQuestionStatus>) =>
	s.requirements.filter((r) => !r.met).map((r) => r.id);

describe("babyQuestionStatus", () => {
	it("is eligible when everything is met", () => {
		const status = babyQuestionStatus(spouse(), today, home);
		expect(unmet(status)).toEqual([]);
		expect(status.eligible).toBe(true);
	});

	it("is not eligible without a spouse", () => {
		const status = babyQuestionStatus(undefined, today, home);
		expect(status.eligible).toBe(false);
		expect(unmet(status)).toEqual([
			"married",
			"not-roommates",
			"hearts",
			"days-married",
		]);
	});

	it("needs 10 hearts", () => {
		const s = spouse((f) => (f.Points = 2499));
		expect(unmet(babyQuestionStatus(s, today, home))).toEqual(["hearts"]);
	});

	it("needs a week of marriage", () => {
		const wed = (day: number) =>
			spouse((f) => {
				f.WeddingDate = { Year: 2, Season: Season.Spring, DayOfMonth: day };
			});
		expect(unmet(babyQuestionStatus(wed(4), today, home))).toEqual([
			"days-married",
		]);
		expect(unmet(babyQuestionStatus(wed(3), today, home))).toEqual([]);
	});

	it("needs a wedding date in the save", () => {
		const s = spouse((f) => {
			delete f.WeddingDate;
		});
		expect(unmet(babyQuestionStatus(s, today, home))).toEqual(["days-married"]);
	});

	it("rejects roommates", () => {
		const s = spouse((f) => {
			f.RoommateMarriage = true;
		});
		expect(unmet(babyQuestionStatus(s, today, home))).toEqual([
			"not-roommates",
		]);
	});

	it("checks the house, crib and children", () => {
		const s = spouse();
		expect(
			unmet(babyQuestionStatus(s, today, { ...home, upgradeLevel: 1 })),
		).toEqual(["nursery"]);
		expect(
			unmet(babyQuestionStatus(s, today, { ...home, cribStyle: 0 })),
		).toEqual(["crib"]);
		expect(
			unmet(babyQuestionStatus(s, today, { ...home, cribStyle: undefined })),
		).toEqual([]);
		expect(
			unmet(
				babyQuestionStatus(s, today, { ...home, children: 2, toddlers: 2 }),
			),
		).toEqual(["children"]);
		// One child is fine once they're a toddler, not before
		expect(
			unmet(
				babyQuestionStatus(s, today, { ...home, children: 1, toddlers: 0 }),
			),
		).toEqual(["children"]);
		expect(
			unmet(
				babyQuestionStatus(s, today, { ...home, children: 1, toddlers: 1 }),
			),
		).toEqual([]);
	});

	it("rejects a spouse who is already pregnant", () => {
		const s = spouse();
		s.setPregnant(true, today);
		expect(unmet(babyQuestionStatus(s, today, home))).toEqual(["not-pregnant"]);
	});
});

describe("readHome", () => {
	const location = (characters: unknown) =>
		({ cribStyle: 0, characters }) as unknown as GameLocation;

	it("counts only children, and which are toddlers", () => {
		const npcs = {
			NPC: [
				{ "@_xsi:type": "Child", daysOld: 55 },
				{ "@_xsi:type": "Child", daysOld: 54 },
				{ "@_xsi:type": "Pet", daysOld: 99 },
			],
		};
		expect(readHome(location(npcs), 3)).toEqual({
			upgradeLevel: 3,
			cribStyle: 0,
			children: 2,
			toddlers: 1,
		});
	});

	it("handles one child, none, and no home", () => {
		expect(
			readHome(location({ NPC: { "@_xsi:type": "Child", daysOld: 60 } }), 2),
		).toMatchObject({ children: 1, toddlers: 1 });
		expect(readHome(location(""), 2).children).toBe(0);
		expect(readHome(undefined, 0)).toEqual({
			upgradeLevel: 0,
			cribStyle: undefined,
			children: 0,
			toddlers: 0,
		});
	});
});

describe("BabyQuestion panel", () => {
	it("shows disabled checkboxes and an eligible result", () => {
		const status = babyQuestionStatus(spouse(), today, home);
		render(BabyQuestion, { props: { status, spouse: "Abigail" } });
		const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
		expect(boxes).toHaveLength(status.requirements.length);
		expect(boxes.every((b) => b.disabled && b.checked)).toBe(true);
		expect(screen.getByTestId("baby-question-status").textContent).toContain(
			"Eligible",
		);
	});

	it("leaves unmet requirements unchecked and counts them", () => {
		const status = babyQuestionStatus(spouse(), today, {
			...home,
			children: 2,
			toddlers: 2,
			upgradeLevel: 1,
		});
		render(BabyQuestion, { props: { status, spouse: "Abigail" } });
		expect(
			(screen.getByTestId("baby-requirement-children") as HTMLInputElement)
				.checked,
		).toBe(false);
		expect(screen.getByTestId("baby-question-status").textContent).toContain(
			"Not eligible: 2 requirements not met",
		);
	});
});
