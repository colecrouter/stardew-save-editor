import { describe, expect, it } from "vitest";
import {
	createSpecialOrderResolver,
	parseRequiredCount,
} from "../codegen/specialOrderTokens";

const treasure = [
	{
		Name: "Treasure",
		Values: [
			{
				RequiredTags: "",
				Value: "Target|item_prismatic_shard|LocalizedName|[ShardName]|Count|4",
			},
		],
	},
];

describe("special order generation", () => {
	it("resolves fixed elements and nested localized strings", () => {
		const resolve = createSpecialOrderResolver("QiChallenge4", treasure, {
			Objective: "Collect {Treasure:Count} {Treasure:LocalizedName}.",
			ShardName: "Prismatic Shards",
		});
		expect(resolve("[Objective]")).toBe("Collect 4 Prismatic Shards.");
		expect(resolve("{Treasure:Target}")).toBe("item_prismatic_shard");
		expect(parseRequiredCount(resolve("{Treasure:Count}"))).toBe(4);
	});

	it("rejects unresolved tokens rather than generating broken objectives", () => {
		const resolve = createSpecialOrderResolver("QiChallenge4", null, {});
		expect(() => resolve("{Treasure:Count}")).toThrow(
			"unresolved objective token",
		);
		expect(() => resolve("[Missing]")).toThrow("unresolved objective token");
	});

	it("rejects choices which need runtime selection", () => {
		const value = treasure[0]?.Values[0];
		if (!value) throw new Error("Missing fixture value");
		expect(() =>
			createSpecialOrderResolver(
				"Quest",
				[{ Name: "Treasure", Values: [value, value] }],
				{},
			),
		).toThrow("requires runtime selection");
		expect(() =>
			createSpecialOrderResolver(
				"Quest",
				[
					{
						Name: "Treasure",
						Values: [{ ...value, RequiredTags: "some_condition" }],
					},
				],
				{},
			),
		).toThrow("requires runtime selection");
	});

	it.each([
		"{Treasure:Count}",
		"4items",
		"",
		"0",
		"-1",
		"1.5",
	])("rejects invalid counts: %s", (value) => {
		expect(() => parseRequiredCount(value)).toThrow(
			"Invalid special-order objective count",
		);
	});
});
