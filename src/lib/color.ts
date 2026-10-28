/** Game color arithmetic shared by legacy reactive wrappers and read-only v2 projections. */
export function packRgba(R: number, G: number, B: number, A: number): number {
	// The save packs red into the low byte and alpha into the high byte, unsigned.
	return (
		(((A & 255) << 24) | ((B & 255) << 16) | ((G & 255) << 8) | (R & 255)) >>> 0
	);
}

/** Read complete finite channels without supplying defaults or changing imported data. */
export function readRgba(value: unknown): readonly number[] | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	const color = value as Record<string, unknown>;
	const keys = ["R", "G", "B", "A"];
	return keys.every(
		(key) => typeof color[key] === "number" && Number.isFinite(color[key]),
	)
		? keys.map((key) => color[key] as number)
		: undefined;
}

/** Render byte channels as CSS hex; callers choose their own input-validation policy. */
export function rgbaHex(
	channels: readonly number[],
	length: 3 | 6 | 8 = 6,
): string {
	const hex = channels.map((channel) => channel.toString(16).padStart(2, "0"));
	return `#${
		length === 3
			? hex
					.slice(0, 3)
					.map((channel) => channel[0])
					.join("")
			: hex.slice(0, length === 8 ? 4 : 3).join("")
	}`;
}
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);
/** Valid RGB editing preserves alpha and opaque color members without filling absent data. */
export function colorHex(value: unknown): string | undefined {
	if (
		!record(value) ||
		!["R", "G", "B", "A"].every((key) => {
			const channel = value[key];
			return (
				finite(channel) &&
				Number.isInteger(channel) &&
				channel >= 0 &&
				channel <= 255
			);
		})
	)
		return undefined;
	// A malformed packed representation cannot be silently repaired by changing RGB.
	if (
		Object.hasOwn(value, "PackedValue") &&
		(!finite(value.PackedValue) ||
			!Number.isInteger(value.PackedValue) ||
			value.PackedValue < 0 ||
			value.PackedValue > 4294967295)
	)
		return undefined;
	return rgbaHex([Number(value.R), Number(value.G), Number(value.B)]);
}
/** Rebuild only RGB and an existing packed mirror; alpha and every other member survive. */
export function itemColorPatch(
	value: unknown,
	hex: string,
): Record<string, unknown> | undefined {
	if (
		!record(value) ||
		colorHex(value) === undefined ||
		!/^#[0-9a-f]{6}$/i.test(hex)
	)
		return undefined;
	const R = Number.parseInt(hex.slice(1, 3), 16),
		G = Number.parseInt(hex.slice(3, 5), 16),
		B = Number.parseInt(hex.slice(5, 7), 16);
	return {
		...value,
		R,
		G,
		B,
		...(Object.hasOwn(value, "PackedValue")
			? {
					PackedValue: packRgba(R, G, B, Number(value.A)),
				}
			: {}),
	};
}
