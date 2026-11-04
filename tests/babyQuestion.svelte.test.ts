import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import {
	type FarmerFriendships,
	type GameLocation,
	Season,
	Status,
} from "../codegen/save";
import {
	babyQuestionStatus,
	playerBabyQuestionStatus,
	playerMarriageOf,
	readHome,
} from "../src/lib/babyQuestion";
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

describe("married to another player", () => {
	const pair = (a: string, b: string, married: boolean, due = false) => ({
		key: { FarmerPair: { Farmer1: a, Farmer2: b } },
		value: {
			Friendship: {
				Points: 0,
				GiftsThisWeek: 0,
				GiftsToday: 0,
				TalkedToToday: false,
				ProposalRejected: false,
				Status: married ? Status.Married : Status.Friendly,
				Proposer: 0,
				RoommateMarriage: false,
				...(due
					? {
							NextBirthingDate: {
								Year: 3,
								Season: Season.Spring,
								DayOfMonth: 5,
							},
						}
					: {}),
			},
		},
	});
	const pairs = (...items: ReturnType<typeof pair>[]): FarmerFriendships => ({
		item: items,
	});

	it("finds the partner from either side of the pair", () => {
		const all = pairs(pair("1", "2", false), pair("3", "4", true));
		expect(playerMarriageOf("4", all)?.partnerId).toBe("3");
		expect(playerMarriageOf(3, all)?.partnerId).toBe("4");
		expect(playerMarriageOf("1", all)).toBeUndefined();
		expect(playerMarriageOf("1", undefined)).toBeUndefined();
	});

	const you = {
		name: "Princess",
		home: { ...home, upgradeLevel: 2, children: 1, toddlers: 1 },
	};
	const partner = { name: "weswy", home: { ...home, upgradeLevel: 3 } };

	it("is eligible when either home qualifies", () => {
		const marriage = playerMarriageOf("1", pairs(pair("1", "2", true)));
		const status = playerBabyQuestionStatus(you, partner, marriage);
		expect(unmet(status)).toEqual([]);
		expect(status.eligible).toBe(true);
		expect(status.title).toBe("Will Princess and weswy be asked about a baby?");
	});

	it("needs one home with the nursery, crib and room, not each in a different one", () => {
		const marriage = playerMarriageOf("1", pairs(pair("1", "2", true)));
		// Nursery only in the partner's home, but the partner's crib is gone
		const noCrib = { ...partner, home: { ...partner.home, cribStyle: 0 } };
		const lowHouse = { ...you, home: { ...you.home, upgradeLevel: 1 } };
		expect(unmet(playerBabyQuestionStatus(lowHouse, noCrib, marriage))).toEqual(
			["crib", "children"],
		);
		const full = {
			...partner,
			home: { ...partner.home, children: 2, toddlers: 2 },
		};
		const yours = { ...you, home: { ...you.home, children: 2, toddlers: 2 } };
		expect(unmet(playerBabyQuestionStatus(yours, full, marriage))).toEqual([
			"children",
		]);
	});

	it("is not eligible when not married to a player, or already expecting", () => {
		expect(playerBabyQuestionStatus(you, undefined, undefined).eligible).toBe(
			false,
		);
		const expecting = playerMarriageOf("1", pairs(pair("1", "2", true, true)));
		expect(unmet(playerBabyQuestionStatus(you, partner, expecting))).toEqual([
			"not-pregnant",
		]);
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
		render(BabyQuestion, { props: { status } });
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
		render(BabyQuestion, { props: { status } });
		expect(
			(screen.getByTestId("baby-requirement-children") as HTMLInputElement)
				.checked,
		).toBe(false);
		expect(screen.getByTestId("baby-question-status").textContent).toContain(
			"Not eligible: 2 requirements not met",
		);
	});
});
