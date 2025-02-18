import { describe, expect, it } from "vitest";
import { Color } from "./Color";

describe("Color", () => {
    it("should return correct PackedValue for yellow", () => {
        const color = new Color("rgb(255, 230, 0)");
        expect(color.PackedValue).toBe(4278249215);
    });
});
