import type { Color as ColorType } from "$types/save";

const RGB_REGEX = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;

// Type to make the specified keys optional, but keep the rest of the keys the same.
type OptionalPick<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export class Color implements ColorType {
    A = 0;
    R = 0;
    G = 0;
    B = 0;

    constructor(
        color:
            | `#${string}`
            | string
            | OptionalPick<Omit<ColorType, "PackedValue">, "A">,
    ) {
        if (typeof color === "string") {
            if (color.startsWith("#")) {
                this.R = Number.parseInt(color.slice(1, 3) || "0", 16);
                this.G = Number.parseInt(color.slice(3, 5) || "0", 16);
                this.B = Number.parseInt(color.slice(5, 7) || "0", 16);
                this.A =
                    color.length === 9
                        ? Number.parseInt(color.slice(7, 9) || "255", 16)
                        : 255;
            } else if (color.match(RGB_REGEX)) {
                // rgb(RRR, GGG, BBB)
                const [_, R, G, B] = color.match(RGB_REGEX) ?? [];
                this.R = Number.parseInt(R ?? "0");
                this.G = Number.parseInt(G ?? "0");
                this.B = Number.parseInt(B ?? "0");
                this.A = 255;
            } else {
                // RRR GGG BBB (AAA)
                const split = color.split(" ");
                this.R = Number.parseInt(split[0] ?? "0");
                this.G = Number.parseInt(split[1] ?? "0");
                this.B = Number.parseInt(split[2] ?? "0");
                this.A = Number.parseInt(split[3] ?? "255");
            }
        } else {
            this.R = color.R;
            this.G = color.G;
            this.B = color.B;
            this.A = color.A ?? 255;
        }
    }

    get PackedValue() {
        // Updated packing order with unsigned conversion: A << 24 | B << 16 | G << 8 | R, then >>> 0 to convert to unsigned.
        return (
            (((this.A & 0xff) << 24) |
                ((this.B & 0xff) << 16) |
                ((this.G & 0xff) << 8) |
                (this.R & 0xff)) >>>
            0
        );
    }

    toHex(length: 3 | 6 | 8 = 6) {
        const hex = [this.R, this.G, this.B, this.A].map((val) =>
            val.toString(16).padStart(2, "0"),
        ) as [string, string, string, string];

        switch (length) {
            case 3:
                return `#${hex[0][0]}${hex[1][0]}${hex[2][0]}`;
            case 6:
                return `#${hex[0]}${hex[1]}${hex[2]}`;
            case 8:
                return `#${hex[0]}${hex[1]}${hex[2]}${hex[3]}`;
        }
    }

    toJSON() {
        // Return the regular object, but also include the packed value.
        return {
            A: this.A,
            R: this.R,
            G: this.G,
            B: this.B,
            PackedValue: this.PackedValue,
        };
    }
}
