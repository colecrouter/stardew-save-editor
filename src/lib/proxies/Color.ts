import type { Color as ColorType } from "$types/save/1.6";

// Type to make the specified keys optional, but keep the rest of the keys the same.
type OptionalPick<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export class Color implements ColorType {
    A = 0;
    R = 0;
    G = 0;
    B = 0;

    constructor(color: `#${string}` | string | OptionalPick<ColorType, "A">) {
        if (typeof color === "string") {
            if (color.startsWith("#")) {
                this.R = Number.parseInt(color.slice(1, 3), 16) || 0;
                this.G = Number.parseInt(color.slice(3, 5), 16) || 0;
                this.B = Number.parseInt(color.slice(5, 7), 16) || 0;
                this.A = Number.parseInt(color.slice(7, 9), 16) || 0;
            } else {
                // RRR GGG BBB (AAA)
                const split = color.split(" ");
                this.R = Number.parseInt(split[0] ?? "0");
                this.G = Number.parseInt(split[1] ?? "0");
                this.B = Number.parseInt(split[2] ?? "0");
                this.A = Number.parseInt(split[3] ?? "0");
            }
        } else {
            this.R = color.R;
            this.G = color.G;
            this.B = color.B;
            this.A = color.A ?? 255;
        }
    }

    get PackedValue() {
        const hex = [this.R, this.G, this.B, this.A]
            .map((n) => n.toString(16))
            .reverse()
            .join("");
        return Number(`0x${hex}`);
    }
}
