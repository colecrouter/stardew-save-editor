import { ObjectCategory } from "$types/items";
import type {
	CommunityView,
	CommunityBundleView,
	CommunityRequirementView,
} from "./community-data.ts";
import type { DomainEditPort } from "./field-binding.ts";
import type { ImmutableView } from "./immutable-view.ts";
import { setCommunityProgress } from "./community-operations.ts";
import { readItemPresentation } from "./item-presentation.ts";

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

	const presentation = readItemPresentation({
		"@_xsi:type": itemTypes[type] ?? "Object",
		bigCraftable: type === "BO" || type === "BBL",
		isRecipe: type === "BL" || type === "BBL",
		itemId,
		quality,
	});
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
export function createCommunityBundle(
	port: DomainEditPort,
	bundle: ImmutableView<CommunityBundleView>,
) {
	return {
		...bundle,
		requirements: bundle.requirements.map((requirement) => ({
			...requirement,
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
