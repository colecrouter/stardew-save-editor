import { describe, it, expect } from "vitest";
import { Color } from "../../src/lib/proxies/Color";

describe("Color", () => {
    it("should return correct PackedValue for yellow", () => {
        const color = new Color("rgb(255, 230, 0)");
        expect(color.PackedValue).toBe(4278249215);
    });
});
