import { describe, expect, it, vi } from "vitest";
import { createLocalizedTextResolver } from "../codegen/localizedText";

const strings: Record<string, Record<string, string>> = {
	"Strings\\Objects": {
		Weeds_Description: "A bunch of obnoxious weeds.",
	},
	"Strings\\Tools": {
		TrashCan_Description: "Reclaims {0}% of an item's value when trashed.",
	},
};

describe("localized text resolution", () => {
	it("resolves a token from its strings file", () => {
		const resolve = createLocalizedTextResolver((asset) => strings[asset]);
		expect(resolve("[LocalizedText Strings\\Objects:Weeds_Description]")).toBe(
			"A bunch of obnoxious weeds.",
		);
	});

	it("substitutes token arguments", () => {
		const resolve = createLocalizedTextResolver((asset) => strings[asset]);
		expect(
			resolve("[LocalizedText Strings\\Tools:TrashCan_Description 30]"),
		).toBe("Reclaims 30% of an item's value when trashed.");
	});

	it("returns undefined for missing strings and non-tokens", () => {
		const resolve = createLocalizedTextResolver((asset) => strings[asset]);
		expect(resolve("[LocalizedText Strings\\Objects:Nope]")).toBeUndefined();
		expect(resolve("[LocalizedText Strings\\Missing:Key]")).toBeUndefined();
		expect(resolve("Plain text")).toBeUndefined();
		expect(resolve(undefined)).toBeUndefined();
	});

	it("loads each strings file once", () => {
		const load = vi.fn((asset: string) => strings[asset]);
		const resolve = createLocalizedTextResolver(load);
		resolve("[LocalizedText Strings\\Objects:Weeds_Description]");
		resolve("[LocalizedText Strings\\Objects:Nope]");
		expect(load).toHaveBeenCalledTimes(1);
	});
});
