import { QualityToEdibilityMultiplier, QualityToPriceMultiplier } from "$lib/ItemData";

export const CalculateEdibility = (edibility: number, quality: number) => CalculateBase(edibility, quality, QualityToEdibilityMultiplier);

export const CalculatePrice = (price: number, quality: number) => CalculateBase(price, quality, QualityToPriceMultiplier);

const CalculateBase = (value: number, quality: number, lookup: Map<number, number>) => {
    if (value <= 0) { return 0; }
    if (quality < 0 || quality > 4 || quality === 3) { throw new Error("Invalid quality"); }

    const multiplier = lookup.get(quality);
    if (multiplier === undefined) { throw new Error("Invalid quality"); }

    return Math.floor(value * multiplier);
};
