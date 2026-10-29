import { CategoriesWithQuality } from "../ItemData.ts";
import {
	readItemPresentation,
	resolveItemMetadata,
	type ItemPresentation,
} from "./item-presentation.ts";
import type { TrinketRollContext } from "../TrinketStats.ts";
import {
	getBackpackItemCapabilities,
	backpackFarmers,
	hasBackpackFarmerId,
} from "./inventory-operations.ts";
import { inventoryContainers } from "./inventory-containers.ts";
import { discoverPlacedChests } from "./chest-storage.ts";
import { readItemPropertyContext } from "./item-properties.ts";
import {
	equipmentSlots,
	equipmentLabels,
	trinketAvailable,
	type EquipmentIdentities,
	type EquipmentSlotView,
} from "./equipment.ts";
import { emptySlot } from "./domain.ts";
import type { HistoryState } from "./history.ts";

// Keep presentation/catalog imports out of the mutation/history runtime graph.
// Projectors interpret save data for the application, while the engine remains
// usable by native Node consumers without browser asset aliases.
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const numeric = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

/** A detached backpack slot, identified independently of its current position. */
export interface BackpackSlotView extends ItemPresentation {
	readonly entityId: string;
	readonly slot: number;
	readonly name: string;
	readonly itemId: string;
	readonly empty: boolean;
	readonly quantity?: number;
	readonly quality?: number;
	readonly canStack: boolean;
	readonly canQuality: boolean;
}
/** Farmer backpacks and placed chests share slots; unsupported owners remain visible without handles. */
export interface BackpackView {
	/** Opaque session owner key: a scalar farmer ID or a namespaced placed-chest path. */
	readonly farmerId: string;
	readonly name: string;
	/** Chest IDs share the request owner namespace; they never denote a farmer. */
	readonly kind?: "chest";
	readonly location?: string;
	readonly capacity?: number;
	readonly supported: boolean;
	readonly reason?: string;
	readonly slots: readonly BackpackSlotView[];
	readonly equipment: readonly EquipmentSlotView[];
}
/** Combine metadata-backed editing policy with UI-owned presentation fields. */
function projectInventoryItem(
	raw: Record<string, unknown> | undefined,
	context?: TrinketRollContext,
) {
	const metadata = resolveItemMetadata(raw);
	return {
		...readItemPresentation(raw, context, metadata),
		...getBackpackItemCapabilities(
			raw,
			metadata?._type === "Object",
			[...CategoriesWithQuality].some((category) => category === raw?.category),
		),
	};
}

/** Project supported arrays without normalizing any imported item representation. */
export function readBackpacks(
	state: Pick<HistoryState, "document" | "identities"> & {
		equipmentIdentities?: EquipmentIdentities;
	},
): BackpackView[] {
	const all = backpackFarmers(state.document);
	const containers = new Map(
		inventoryContainers(state.document).map((owner) => [owner.id, owner]),
	);
	return all.map((farmer) => {
		const farmerId = hasBackpackFarmerId(farmer)
			? String(farmer.UniqueMultiplayerID)
			: "";
		const unique =
			hasBackpackFarmerId(farmer) &&
			all.filter(
				(other) =>
					hasBackpackFarmerId(other) &&
					String(other.UniqueMultiplayerID) === farmerId,
			).length === 1;
		const items = record(farmer.items) ? farmer.items.Item : undefined;
		const ids = Object.hasOwn(state.identities, farmerId)
			? state.identities[farmerId]
			: undefined;
		const supported =
			unique &&
			containers.get(farmerId)?.kind === "farmer" &&
			Array.isArray(items) &&
			ids?.length === items.length;
		// Projection interprets saved values into presentation data; it never retains
		// item records or opaque mod data in the UI-facing view.
		const context = readItemPropertyContext(state.document, farmer);
		return {
			farmerId,
			equipment: equipmentSlots.flatMap((key) => {
				const entityId = state.equipmentIdentities?.[farmerId]?.[key];
				if (!entityId) return [];
				const value = farmer[key];
				const raw = record(value) ? value : undefined;
				return [
					{
						entityId,
						key,
						label: equipmentLabels[key],
						empty: emptySlot(value),
						locked: key === "trinketItem" && !trinketAvailable(farmer),
						itemId:
							typeof raw?.itemId === "string" || typeof raw?.itemId === "number"
								? String(raw.itemId)
								: "",
						...readItemPresentation(raw, context),
						canStack: false,
						canQuality: false,
						...(numeric(raw?.stack) ? { quantity: raw.stack } : {}),
						...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
					},
				];
			}),
			name:
				typeof farmer.name === "string" && farmer.name
					? farmer.name
					: "Unnamed farmer",
			supported,
			...(!supported
				? {
						reason: unique
							? "This backpack format is not supported."
							: "Farmer IDs are ambiguous.",
					}
				: {}),
			slots:
				supported && Array.isArray(items) && ids
					? items.map((item, slot) => {
							const raw = record(item) ? item : undefined;
							const empty = emptySlot(item);

							return {
								entityId: ids[slot] ?? "",
								slot,
								empty,
								// Opaque identifiers may contain non-callable conversion members.
								// Only serialized scalar IDs are displayable; preserve others raw.
								itemId:
									typeof raw?.itemId === "string" ||
									typeof raw?.itemId === "number"
										? String(raw.itemId)
										: "",
								...(numeric(raw?.stack) ? { quantity: raw.stack } : {}),
								...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
								...projectInventoryItem(raw, context),
								...(empty ? { name: "Empty slot" } : {}),
							};
						})
					: [],
		};
	});
}

/** Project placed world storage separately so farmer navigation retains its existing meaning. */
export function readChests(
	state: Pick<HistoryState, "document" | "identities">,
): BackpackView[] {
	const containers = new Map(
		inventoryContainers(state.document).map((owner) => [owner.id, owner]),
	);
	return discoverPlacedChests(state.document).map((chest) => {
		const owner = containers.get(chest.id);
		const ids = Object.hasOwn(state.identities, chest.id)
			? state.identities[chest.id]
			: undefined;
		const supported =
			chest.supported &&
			owner?.kind === "chest" &&
			ids?.length === chest.slots.length;
		// Chests have no farmer RNG/property context. Project only supported item
		// controls; raw storage and mod data remain solely in the saved document.
		return {
			farmerId: chest.id,
			name: chest.label,
			kind: "chest",
			location: chest.location,
			capacity: chest.capacity,
			supported,
			equipment: [],
			...(!supported
				? {
						reason:
							chest.reason ?? "This chest's inventory identity is ambiguous.",
					}
				: {}),
			slots:
				supported && ids
					? chest.slots.map((item, slot) => {
							const raw = record(item) ? item : undefined;
							const empty = emptySlot(item);
							return {
								entityId: ids[slot] ?? "",
								slot,
								empty,
								itemId:
									typeof raw?.itemId === "string" ||
									typeof raw?.itemId === "number"
										? String(raw.itemId)
										: "",
								...projectInventoryItem(raw),
								...(empty ? { name: "Empty slot" } : {}),
								...(numeric(raw?.stack) ? { quantity: raw.stack } : {}),
								...(numeric(raw?.quality) ? { quality: raw.quality } : {}),
							};
						})
					: [],
		};
	});
}
