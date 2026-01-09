import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { parseBundleValue } from "$lib/proxies/bundleSerialization";
import { Bundle } from "$lib/proxies/CommunityBundles.svelte";
import type { BoolArrayContainer, StringContainer } from "$types/save";

// Regression coverage for remixed bundle entries that use string item IDs (e.g. "SummerSquash").

describe("Community bundle requirements", () => {
	it("preserves non-numeric item identifiers", () => {
		const bundleData: StringContainer = {
			string: "TestBundle//SummerSquash 1 0/0/1",
		};
		const bundleKey: StringContainer = { string: "Pantry/0" };
		const submitted: BoolArrayContainer = { boolean: [false] };

		let bundle!: Bundle;
		const dispose = $effect.root(() => {
			bundle = new Bundle(bundleData, bundleKey, submitted);
		});

		flushSync();

		const requirement = bundle.requiredItems[0];
		expect(requirement).toBeDefined();
		if (!requirement) throw new Error("bundle requirement missing");

		const [initialRequirement] = parseBundleValue(
			bundleData.string,
		).requirements;
		expect(initialRequirement).toBeDefined();
		if (!initialRequirement) throw new Error("parsed requirement missing");

		expect(requirement.itemID).toBe("SummerSquash");
		expect(initialRequirement[0]).toBe("SummerSquash");

		requirement.itemID = 258;
		flushSync();

		const [updatedRequirement] = parseBundleValue(
			bundleData.string,
		).requirements;
		expect(updatedRequirement).toBeDefined();
		if (!updatedRequirement)
			throw new Error("parsed requirement missing after update");

		expect(requirement.itemID).toBe(258);
		expect(updatedRequirement[0]).toBe("258");

		dispose();
	});
});
