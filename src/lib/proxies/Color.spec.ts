import { describe, expect, it } from "vitest";
import { Color } from "./Color.svelte";

describe("Color", () => {
	it("should return correct PackedValue for yellow", () => {
		const color = new Color("rgb(255, 230, 0)");
		expect(color.PackedValue).toBe(4278249215);
	});
	it("retains the legacy hex formats and unsigned alpha packing", () => {
		const color = new Color("#123456ab");
		expect(color.toHex(3)).toBe("#135");
		expect(color.toHex()).toBe("#123456");
		expect(color.toHex(8)).toBe("#123456ab");
		expect(color.PackedValue).toBe(0xab563412);
	});
});
