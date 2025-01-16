// https://stardewvalleywiki.com/User:IBugOne/Item_Quality#Sell_price
export const QualityToPriceMultiplier = new Map([
    [0, 1],
    [1, 1.25],
    [2, 1.5],
    [4, 2],
]);

// https://stardewvalleywiki.com/User:IBugOne/Item_Quality#Healing_effect
export const QualityToEdibilityMultiplier = new Map([
    [0, 1],
    [1, 1.4],
    [2, 1.8],
    [4, 2.6],
]);

export const calculateEdibility = (edibility: number, quality: number) =>
    calculate(edibility, quality, QualityToEdibilityMultiplier);

export const calculatePrice = (price: number, quality: number) =>
    calculate(price, quality, QualityToPriceMultiplier);

const calculate = (
    value: number,
    quality: number,
    lookup: Map<number, number>,
) => {
    if (value <= 0) {
        return 0;
    }
    if (quality < 0 || quality > 4 || quality === 3) {
        throw new Error("Invalid quality");
    }

    const multiplier = lookup.get(quality);
    if (multiplier === undefined) {
        throw new Error("Invalid quality");
    }

    return Math.floor(value * multiplier);
};
