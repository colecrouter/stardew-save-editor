import { describe, expect, it } from "vitest";
import { getQuests, parseQuest } from "../codegen/quests";

// From the game's Data/Quests.json (1.6)
const data = {
	"6": "ItemHarvest/Getting Started/If you want to become a farmer, you have to start with the basics./Cultivate and harvest a parsnip./(O)24/h7 8/100/-1/true",
	"9": "Social/Introductions/It would be a nice gesture to introduce yourself around town././null/25/0/-1/true",
	"18": "Basic/To The Bottom?/So far, there's no sign of the bottom. How low does it go?/Reach the bottom of the mine./-1/-1/0/-1/false",
	"100":
		"LostItem/Robin's Lost Axe/Robin lost her favorite axe./Find Robin's lost axe./Robin (O)788 Forest 110 81/-1/250/-1/true/Hey, you found my axe!",
};

describe("quest data", () => {
	it("parses each field as Quest.getQuestFromId does", () => {
		expect(getQuests(data)).toEqual([
			{
				id: "6",
				type: "ItemHarvest",
				title: "Getting Started",
				description:
					"If you want to become a farmer, you have to start with the basics.",
				objective: "Cultivate and harvest a parsnip.",
				conditions: ["(O)24"],
				nextQuests: ["h7", "8"],
				moneyReward: 100,
				rewardDescription: "-1",
				canBeCancelled: true,
			},
			{
				id: "9",
				type: "Social",
				title: "Introductions",
				description:
					"It would be a nice gesture to introduce yourself around town.",
				// SocializeQuest makes its own
				objective: ".",
				conditions: ["null"],
				nextQuests: ["25"],
				moneyReward: 0,
				rewardDescription: "-1",
				canBeCancelled: true,
			},
			expect.objectContaining({
				id: "18",
				conditions: ["-1"],
				nextQuests: ["-1"],
				canBeCancelled: false,
			}),
			expect.objectContaining({
				id: "100",
				conditions: ["Robin", "(O)788", "Forest", "110", "81"],
				moneyReward: 250,
			}),
		]);
	});

	it("drops the reward text of a quest without gold, as the game does", () => {
		expect(
			parseQuest("1", "Basic/Title/Description/Objective/-1/-1/-1/A hat/true")
				?.rewardDescription,
		).toBeUndefined();
		expect(
			parseQuest("1", "Basic/Title/Description/Objective/-1/-1/0/A hat/true")
				?.rewardDescription,
		).toBe("A hat");
	});

	it("leaves out quests the game can't load", () => {
		// No description
		expect(parseQuest("1", "Basic/Title//Objective/-1/-1/0/-1/true")).toBe(
			undefined,
		);
		// The gold reward isn't a number
		expect(
			parseQuest("1", "Basic/Title/Description/Objective/-1/-1/lots/-1/true"),
		).toBeUndefined();
		// Nor is "can be cancelled" true or false
		expect(
			parseQuest("1", "Basic/Title/Description/Objective/-1/-1/0/-1/maybe"),
		).toBeUndefined();
	});

	it("treats the objective and the fields after the gold reward as optional", () => {
		expect(parseQuest("1", "Basic/Title/Description//-1/-1/0")).toEqual({
			id: "1",
			type: "Basic",
			title: "Title",
			description: "Description",
			objective: undefined,
			conditions: ["-1"],
			nextQuests: ["-1"],
			moneyReward: 0,
			rewardDescription: undefined,
			canBeCancelled: false,
		});
	});
});
