import { tick } from "svelte";
import type { InventoryView } from "../inventory-views.ts";
import {
	allInventorySlots as allSlots,
	type InventorySlot,
} from "./inventory-slot.ts";

interface SelectionInput {
	readonly owners: () => readonly InventoryView[];
	readonly backpack: () => InventoryView | undefined;
	readonly chests: () => readonly InventoryView[];
	readonly farmerId: () => string | undefined;
	readonly dragging: () => boolean;
	readonly root: () => HTMLElement | undefined;
	readonly revealFarmer: (ownerId: string) => void;
	// Clear local feedback and drag highlighting without canceling a held pointer.
	readonly onChoose: () => void;
}

/** Component-owned instance selection and owner navigation. Command handlers
 * capture version before awaiting, then follow their exact committed receipt.
 * Later explicit selection always wins over those asynchronous completions. */
export function createInventorySelection(input: SelectionInput) {
	const owners = $derived(input.owners());
	const backpack = $derived(input.backpack());
	const chests = $derived(input.chests());
	let selectedEntity = $state<string>();
	let selectionFamily = $state<string[]>([]);
	let selectionVersion = 0;
	let chestQuery = $state("");
	let chestId = $state<string>();
	const matchingChests = $derived(
		chests.filter((owner) =>
			`${owner.name} ${owner.location ?? ""}`
				.toLocaleLowerCase()
				.includes(chestQuery.trim().toLocaleLowerCase()),
		),
	);
	const chest = $derived(
		matchingChests.find((owner) => owner.ownerId === chestId) ??
			matchingChests[0],
	);
	// Explicit selection starts a new lineage. Only our own add/remove replacements
	// extend it, so Undo can restore that instance without selecting an unrelated item.
	function choose(entityId: string | undefined) {
		selectionVersion++;
		input.onChoose();
		selectedEntity = entityId;
		selectionFamily = entityId ? [entityId] : [];
	}
	// Selection belongs to an item instance, not whichever grid happens to be open.
	// Both visible inventories share this lookup, including replacement Undo lineage.
	const selectedOwner = $derived(
		selectedEntity === undefined
			? backpack?.supported
				? backpack
				: chest
			: owners.find((owner) =>
					allSlots(owner).some(
						(item) =>
							item.entityId === selectedEntity ||
							selectionFamily.includes(item.entityId),
					),
				),
	);
	const selected = $derived(
		!selectedOwner
			? undefined
			: selectedEntity === undefined
				? (allSlots(selectedOwner).find((item) => !item.empty) ??
					selectedOwner.slots[0])
				: (allSlots(selectedOwner).find(
						(item) => item.entityId === selectedEntity,
					) ??
					allSlots(selectedOwner).find((item) =>
						selectionFamily.includes(item.entityId),
					)),
	);
	function ownerOf(item: InventorySlot) {
		return owners.find((owner) =>
			allSlots(owner).some((entry) => entry.entityId === item.entityId),
		);
	}
	function selectChest(owner: InventoryView | undefined) {
		chestId = owner?.ownerId;
		choose(
			owner?.slots.find((item) => !item.empty)?.entityId ??
				owner?.slots[0]?.entityId,
		);
	}
	$effect(() => {
		// Pin the initial instance too; later reorders must not retarget an implicit
		// first-slot selection. Equipment and backpack records share this identity path.
		if (selectedEntity === undefined && selected) {
			selectedEntity = selected.entityId;
			selectionFamily = [selected.entityId];
		}
	});
	let previousFarmerId = input.farmerId();
	$effect(() => {
		const current = input.farmerId();
		if (current !== previousFarmerId) {
			previousFarmerId = current;
			// External page selection changes the farmer grid, while transferred
			// instances already at that owner retain their inspector selection.
			if (
				selectedOwner &&
				selectedOwner.kind !== "chest" &&
				selectedOwner.ownerId !== current
			)
				choose(undefined);
		}
	});
	$effect(() => {
		// Transfers and Undo reveal the current owner while preserving the other grid.
		// Explicit owner/search changes start a new selection and cannot be undone here.
		if (!input.dragging() && selectedOwner && selectedEntity) {
			if (
				selectedOwner.kind !== "chest" &&
				selectedOwner.ownerId !== input.farmerId()
			)
				input.revealFarmer(selectedOwner.ownerId);
			if (
				selectedOwner.kind === "chest" &&
				chest?.ownerId !== selectedOwner.ownerId
			) {
				chestQuery = "";
				chestId = selectedOwner.ownerId;
			}
		}
	});
	async function focusSelected(version = selectionVersion) {
		await tick();
		const inventory = input.root();
		if (version !== selectionVersion || inventory?.closest("[hidden]")) return;
		inventory
			?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
			?.focus();
	}
	return {
		get entityId() {
			return selectedEntity;
		},
		get version() {
			return selectionVersion;
		},
		get selectedOwner() {
			return selectedOwner;
		},
		get selected() {
			return selected;
		},
		get query() {
			return chestQuery;
		},
		get matchingChests() {
			return matchingChests;
		},
		get chest() {
			return chest;
		},
		choose,
		ownerOf,
		isCurrent: (version: number) => version === selectionVersion,
		focus: focusSelected,
		search(value: string) {
			// Explicit search starts fresh selection; Undo cannot reopen another filter.
			chestQuery = value;
			chestId = undefined;
			choose(undefined);
		},
		selectChest: (ownerId: string | undefined) =>
			selectChest(chests.find((owner) => owner.ownerId === ownerId)),
		// Only an accepted replacement extends this explicit selection's Undo lineage.
		followReplacement(entityId: string, version: number) {
			if (version !== selectionVersion) return false;
			selectionFamily = [...selectionFamily, entityId];
			selectedEntity = entityId;
			return true;
		},
		// Movement keeps instance identity and preserves earlier replacement lineage.
		followMove(entityId: string, version: number) {
			if (version !== selectionVersion) return false;
			selectedEntity = entityId;
			selectionFamily = [...new Set([...selectionFamily, entityId])];
			return true;
		},
	};
}
