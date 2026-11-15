import type { T_StardewValley_Objects_Chest as Chest } from "../../../generated/save-format/save.ts";
import { storageTypes } from "../storageTypes.ts";

export { storageTypes } from "../storageTypes.ts";
export interface StorageCapabilities {
	readonly source: "chest" | "fridge" | "machine" | "building";
	readonly typeId?: string | undefined;
	readonly miniShippingBin: boolean;
	readonly expansionReason?: string | undefined;
}
export function storageCapabilities(
	chest: Chest,
	source: StorageCapabilities["source"] = "chest",
): StorageCapabilities {
	const placed =
		source === "chest" && chest.playerChest === true && chest.fridge !== true;
	const itemId = chest.itemId;
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
			miniShippingBin &&
			(chest.separateWalletItems ?? []).some((entry) =>
				entry.value.some((item) => item !== null),
			)
				? "This bin holds separate-wallet items that a Chest would not show."
				: undefined,
	};
}
