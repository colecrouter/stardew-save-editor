import { savedTypeId } from "./saved-types.ts";
import { ObjectCategory } from "$types/items";
import type {
	CommunityView,
	CommunityBundleView,
	CommunityRequirementView,
} from "./community-data.ts";
import type { DomainEditPort } from "./field-binding.ts";
import type { ImmutableView } from "./immutable-view.ts";
import {
	setCommunityRequirements,
	type CommunityIngredientEdit,
} from "./community-requirements.ts";
import { setCommunityProgress } from "./community-operations.ts";
import { inventoryQualities } from "./inventory-policy.ts";
import {
	readItemPresentation,
	resolveItemMetadata,
	type ItemVisual,
} from "./item-presentation.ts";

/** The UI receives drawing instructions and game meaning, never a saved item/proxy. */
const itemTypes: Record<string, string> = {
	F: "Furniture",
	H: "Hat",
	C: "Clothing",
	R: "Ring",
	B: "Boots",
	W: "MeleeWeapon",
};
function presentItem(
	itemId: string,
	quantity: number,
	type = "O",
	quality = 0,
	currency = false,
) {
	if (currency)
		return {
			name: `${quantity.toLocaleString()}g`,
			visual: undefined,
			quantity,
			quality,
		};
	if (/^-\d+$/.test(itemId)) {
		const category = ObjectCategory[Number(itemId)];
		return {
			name: category
				? `Any ${category.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}`
				: `Any item in category ${itemId}`,
			visual: undefined,
			quantity,
			quality,
		};
	}

	const item = {
		$type: savedTypeId(itemTypes[type] ?? "Object"),
		bigCraftable: type === "BO" || type === "BBL",
		isRecipe: type === "BL" || type === "BBL",
		itemId,
		quality,
	};
	// Bundle requirements contain catalog IDs rather than saved instance names.
	// Seed the name from the same metadata used for drawing the requested item.
	const metadata = resolveItemMetadata(item);
	const presentation = readItemPresentation(
		{ ...item, name: metadata?.name },
		undefined,
		metadata,
	);
	return {
		name:
			presentation.name === "Unknown item"
				? `Item ${itemId}`
				: presentation.name,
		visual: presentation.visual,
		quantity,
		quality,
	};
}
/** Capture the observed requirement identity once; all consumers share the same stale-target check. */
export function communityDonation(
	port: DomainEditPort,
	bundleKey: string,
	requirement: ImmutableView<CommunityRequirementView>,
) {
	return (value: boolean) =>
		port.commands.transact(
			setCommunityProgress({
				type: "donation",
				bundleKey,
				index: requirement.index,
				itemId: requirement.itemId,
				quantity: requirement.quantity,
				quality: requirement.quality,
				value,
			}),
		);
}
/** Use the paused/open seal frames from the game's Bundle constructor and
 * completionAnimation. The renderer receives drawing instructions, not atlas math. */
function bundleSeal(
	bundle: ImmutableView<CommunityBundleView>,
): ItemVisual | undefined {
	if (bundle.color === undefined) return undefined;
	const rect = {
		x: (bundle.color % 2) * 256 + (bundle.completed ? 240 : 16),
		y: 244 + Math.floor(bundle.color / 2) * 16,
		width: 16,
		height: 16,
	};
	return {
		sheet: "JunimoNote.png",
		sheetSize: { width: 640, height: 308 },
		sourceRect: rect,
		layers: [{ rect }],
	};
}
export function createCommunityBundle(
	port: DomainEditPort,
	bundle: ImmutableView<CommunityBundleView>,
) {
	return {
		...bundle,
		seal: bundleSeal(bundle),
		// Capture the opening requirements and donation state; the command rejects
		// intervening edits rather than applying a stale coordinated draft.
		editRequirements: (
			requirements: readonly CommunityIngredientEdit[],
			needed: number,
		) =>
			port.commands.transact(
				setCommunityRequirements({
					bundleKey: bundle.key,
					expected: {
						needed: bundle.needed,
						requirements: bundle.requirements.map(
							({ itemId, quantity, quality, submitted }) => ({
								itemId,
								quantity,
								quality,
								submitted,
							}),
						),
					},
					requirements,
					needed,
				}),
			),
		requirements: bundle.requirements.map((requirement) => ({
			...requirement,
			qualityLabel:
				inventoryQualities.find((row) => row.value === requirement.quality)
					?.label ?? `Custom quality ${requirement.quality}`,
			...presentItem(
				requirement.itemId,
				requirement.quantity,
				"O",
				requirement.quality,
				requirement.currency,
			),
			donate: communityDonation(port, bundle.key, requirement),
		})),
		rewardItem: bundle.reward
			? presentItem(
					bundle.reward.itemId,
					bundle.reward.quantity,
					bundle.reward.type,
				)
			: undefined,
		complete: (value: boolean) =>
			port.commands.transact(
				setCommunityProgress({ type: "bundle", bundleKey: bundle.key, value }),
			),
		rewardAvailability: (value: boolean) =>
			port.commands.transact(
				setCommunityProgress({ type: "reward", bundleKey: bundle.key, value }),
			),
	};
}
/** Membership and project commands are whole transactions; donations consume no inventory items or gold. */
export function createCommunityDomain(
	port: DomainEditPort,
	view: ImmutableView<CommunityView>,
) {
	return {
		...view,
		membershipChange: (value: boolean, revision?: number) =>
			port.commands.transact(
				setCommunityProgress({ type: "membership", value }),
				revision,
			),
		roomProgress: (room: number, value: boolean) =>
			port.commands.transact(
				setCommunityProgress({ type: "room", room, value }),
			),
		project: (room: number, value: boolean) =>
			port.commands.transact(
				setCommunityProgress({ type: "project", room, value }),
			),
		theaterChange: (value: boolean) =>
			port.commands.transact(setCommunityProgress({ type: "theater", value })),
		// Resolve only visible bundle presentation in the panel, not every global revision.
		bundle: (bundle: ImmutableView<CommunityBundleView>) =>
			createCommunityBundle(port, bundle),
	};
}
export type CommunityBundleDomain = ReturnType<typeof createCommunityBundle>;

export type CommunityDomain = ReturnType<typeof createCommunityDomain>;
