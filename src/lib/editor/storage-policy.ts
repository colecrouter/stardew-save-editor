import { storageTypes } from "../storageTypes.ts";
export { storageTypes } from "../storageTypes.ts";
export interface StorageCapabilities {
	readonly source: "chest" | "fridge" | "machine" | "building";
	readonly typeId?: string;
	readonly miniShippingBin: boolean;
	readonly expansionReason?: string;
}
/** Separate-wallet inventories must never become invisible through a bin conversion. */
const holdsItems = (value: unknown): boolean =>
	value !== null &&
	typeof value === "object" &&
	(Object.hasOwn(value, "itemId") || Object.values(value).some(holdsItems));
export function storageCapabilities(
	raw: Record<string, unknown>,
	source: StorageCapabilities["source"] = "chest",
): StorageCapabilities {
	const placed =
		source === "chest" && raw.playerChest === true && raw.fridge !== true;
	// Imported IDs can be opaque records with non-callable conversion members.
	// Only serialized scalar keys participate in known-type lookup.
	const itemId =
		typeof raw.itemId === "string" ||
		(typeof raw.itemId === "number" && Number.isFinite(raw.itemId))
			? String(raw.itemId)
			: undefined;
	const typeId =
		placed && storageTypes.some((type) => type.itemId === itemId)
			? itemId
			: undefined;
	const miniShippingBin = placed && itemId === "248";
	return {
		source,
		typeId,
		miniShippingBin,
		expansionReason:
			miniShippingBin && holdsItems(raw.separateWalletItems)
				? "This bin holds separate-wallet items that a Chest would not show."
				: undefined,
	};
}
