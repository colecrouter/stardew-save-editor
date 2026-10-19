<script lang="ts">
	import { tick } from "svelte";
	import {
		type ChestGroupId,
		ChestGroups,
		chestColor,
		chestGroup,
	} from "$lib/chestGroups";
	import {
		moveItem,
		moveItems,
		type SlotRef,
		sameSlot,
		sortChest,
	} from "$lib/chestMoves";
	import {
		type ChestProxy,
		SwappableChests,
		searchChests,
	} from "$lib/proxies/Chest.svelte";
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import SortButton from "$lib/ui/SortButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import ItemSlot from "../inventory/ItemSlot.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import ItemView from "../inventory/ItemView.svelte";

	const toastManager = getToastManager();
	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");

	// Each group lists all of its chests at once
	let groups = $derived(
		ChestGroups.map((group) => ({
			...group,
			chests: save.chests.filter((chest) => chestGroup(chest) === group.id),
		})),
	);

	// Start on the Chests group, or on whichever group has something in it
	const firstChest =
		save.chests.find((chest) => chestGroup(chest) === "chests") ??
		save.chests[0];

	let selectedGroupId = $state<ChestGroupId>(
		firstChest ? chestGroup(firstChest) : "chests",
	);
	let selectedGroup = $derived(
		groups.find((group) => group.id === selectedGroupId) ?? groups[0],
	);

	let selectedChest = $state<ChestProxy | undefined>(firstChest);
	let selectedIndex = $state(0);
	let selectedItem = $derived(selectedChest?.inventory.get(selectedIndex));

	let chestList = $state<HTMLElement>();

	let search = $state("");
	let searchResults = $derived(searchChests(save.chests, search));
	let showResults = $state(true);
	let searchBox: HTMLDivElement | undefined = $state();
	let searching = $derived(showResults && search.trim() !== "");
	let matches = $derived(new Set(searchResults.map((result) => result.item)));

	/** Items picked with Ctrl/Cmd+click, to drag several at once */
	let picked = $state<SlotRef[]>([]);
	let multiSelected = $derived(picked.length > 1);
	const isPicked = (chest: ChestProxy, index: number) =>
		picked.some((ref) => sameSlot(ref, { chest, index }));

	/** Chest names; chests in a group with the same label get a number to tell them apart */
	let headings = $derived.by(() => {
		const result = new Map<ChestProxy, string>();
		for (const group of groups) {
			const counts = new Map<string, number>();
			for (const { metadata } of group.chests)
				counts.set(metadata.label, (counts.get(metadata.label) ?? 0) + 1);
			const seen = new Map<string, number>();
			for (const chest of group.chests) {
				const { label } = chest.metadata;
				const n = (seen.get(label) ?? 0) + 1;
				seen.set(label, n);
				result.set(
					chest,
					(counts.get(label) ?? 0) > 1 ? `${label} #${n}` : label,
				);
			}
		}
		return result;
	});

	const chestName = (chest: ChestProxy) =>
		headings.get(chest) ?? chest.metadata.label;

	const selectGroup = (id: ChestGroupId) => {
		selectedGroupId = id;
		if (chestList) chestList.scrollTop = 0;
		selectedChest = groups.find((group) => group.id === id)?.chests[0];
		selectedIndex = 0;
		picked = [];
	};

	const select = (chest: ChestProxy, index: number, event?: MouseEvent) => {
		if (event?.ctrlKey || event?.metaKey) {
			// Only items can be picked; start from whatever was selected before
			if (!chest.inventory.get(index)) return;
			const next =
				picked.length || !selectedChest?.inventory.get(selectedIndex)
					? [...picked]
					: [{ chest: selectedChest, index: selectedIndex }];
			const at = next.findIndex((ref) => sameSlot(ref, { chest, index }));
			if (at >= 0) next.splice(at, 1);
			else next.push({ chest, index });
			picked = next;
		} else {
			picked = [];
		}
		selectedChest = chest;
		selectedIndex = index;
	};

	/** Show a search result: switch to its group, select it and scroll to its chest */
	const selectResult = async (chestIndex: number, slotIndex: number) => {
		const chest = save.chests[chestIndex];
		if (!chest) return;
		selectedGroupId = chestGroup(chest);
		selectedChest = chest;
		selectedIndex = slotIndex;
		picked = [];
		showResults = false;
		await tick();
		chestList
			?.querySelector(`[data-chest-index="${chestIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	};

	const clearSearch = () => {
		search = "";
		searchBox?.querySelector("input")?.focus();
	};

	// Drag and drop: one item onto a slot (moving or swapping), or onto a chest
	let dragging: SlotRef[] | undefined;

	const dragStart = (chest: ChestProxy, index: number, event: DragEvent) => {
		if (!chest.inventory.get(index)) return event.preventDefault();
		dragging =
			multiSelected && isPicked(chest, index)
				? [...picked]
				: [{ chest, index }];
		event.dataTransfer?.setData("text/plain", "chest-item");
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	};

	const allowDrop = (event: DragEvent) => {
		if (dragging) event.preventDefault();
	};

	/** Drop several items into a chest's empty slots, or warn if they won't fit */
	const dropMany = (refs: SlotRef[], target: ChestProxy) => {
		const result = moveItems(refs, target);
		if (!result.ok) {
			// Keep the selection so it can be dropped somewhere with more room
			toastManager.add(
				new Toast(
					`${result.needed} items won't fit: ${chestName(target)} has ${result.free} free slot${result.free === 1 ? "" : "s"}`,
					"failure",
				),
			);
			return;
		}
		if (refs.length > 1) picked = result.moved;
		const first = result.moved[0];
		if (first) {
			selectedChest = first.chest;
			selectedIndex = first.index;
		}
	};

	const dropOnSlot = (chest: ChestProxy, index: number, event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const refs = dragging;
		dragging = undefined;
		const [from] = refs ?? [];
		if (!refs || !from) return;
		if (refs.length > 1) return dropMany(refs, chest);
		moveItem(from, { chest, index });
		picked = [];
		selectedChest = chest;
		selectedIndex = index;
	};

	const dropOnChest = (chest: ChestProxy, event: DragEvent) => {
		event.preventDefault();
		const refs = dragging;
		dragging = undefined;
		if (refs) dropMany(refs, chest);
	};

	const sort = (chest: ChestProxy) => {
		sortChest(chest);
		picked = [];
		toastManager.add(new Toast(`Sorted ${chestName(chest)}`, "success"));
	};

	const sortAll = () => {
		for (const chest of save.chests) sortChest(chest);
		picked = [];
		toastManager.add(
			new Toast(`Sorted all ${save.chests.length} chests`, "success"),
		);
	};

	const slots = (chest: ChestProxy) =>
		Array.from({ length: chest.inventory.slotCount }, (_, index) => ({
			index,
			item: chest.inventory.get(index),
		}));

	const createItem = (name: string) => {
		if (!selectedChest) return;
		try {
			if (!name) {
				toastManager.add(
					new Toast("You must enter an item name first", "failure"),
				);
				return;
			}
			selectedChest.inventory.set(selectedIndex, Item.fromName(name));
		} catch (error) {
			toastManager.add(new Toast("Failed to create item", "failure"));
			throw error;
		}
	};

	const deleteItem = () => selectedChest?.inventory.delete(selectedIndex);

	const failed = (error: unknown) =>
		toastManager.add(
			new Toast(
				error instanceof Error ? error.message : String(error),
				"failure",
			),
		);

	/** Swap a chest for another kind, e.g. a Stone Chest, or a 70-slot Big Chest */
	const changeType = (chest: ChestProxy, itemId: string) => {
		const type = SwappableChests.find((type) => type.itemId === itemId);
		if (!type || type === chest.type) return;
		try {
			chest.setType(type);
		} catch (error) {
			return failed(error);
		}
		// Items may have moved up to fit
		picked = [];
		if (chest === selectedChest && selectedIndex >= type.capacity)
			selectedIndex = 0;
		toastManager.add(new Toast(`Changed to a ${type.name}`, "success"));
	};

	const expand = (chest: ChestProxy) => {
		try {
			chest.expandMiniShippingBin();
		} catch (error) {
			return failed(error);
		}
		toastManager.add(new Toast("Expanded to a 36-slot Chest", "success"));
	};
</script>

{#if save.chests.length === 0}
	<UiContainer>
		<p>No editable chests were found in this save.</p>
	</UiContainer>
{:else}
	<UiContainer>
		<div class="title">
			<h3>Chests</h3>
			<SortButton
				label="Sort all chests"
				onclick={sortAll}
				data-testid="sort-all-chests"
			/>
		</div>
		<div class="search" bind:this={searchBox}>
			<UiInput
				type="text"
				placeholder="Search all chests..."
				data-testid="chest-search"
				bind:value={search}
				onfocus={() => (showResults = true)}
				oninput={() => (showResults = true)}
				onkeydown={(event) => {
					if (event.key === "Escape" && search) {
						event.preventDefault();
						clearSearch();
					}
				}}
			/>
			{#if search}
				<button
					class="clear"
					type="button"
					aria-label="Clear search"
					title="Clear search"
					data-testid="chest-search-clear"
					onclick={clearSearch}
				>
					&times;
				</button>
			{/if}
		</div>
		{#if searching}
			{#if searchResults.length === 0}
				<small>No items found.</small>
			{:else}
				<small>
					{searchResults.length}
					{searchResults.length === 1 ? "match" : "matches"}
				</small>
				<div class="results">
					{#each searchResults as { chestIndex, slotIndex, chest, item }}
						<button
							class="result"
							class:active={chest === selectedChest &&
								slotIndex === selectedIndex}
							data-testid={`chest-search-result-${chestIndex}-${slotIndex}`}
							onclick={() => selectResult(chestIndex, slotIndex)}
						>
							<div class="result-sprite">
								<ItemSprite {item} />
							</div>
							<span class="result-name"
								>{item.name} &times;{item.amount ?? item.stack}</span
							>
							<span class="result-chest">{chestName(chest)}</span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
		<label class="picker">
			<span hidden>Container group</span>
			<UiSelect
				value={selectedGroupId}
				onchange={(event) =>
					selectGroup(
						(event.currentTarget as HTMLSelectElement).value as ChestGroupId,
					)}
				data-testid="chest-group"
			>
				{#each groups as group (group.id)}
					<option value={group.id}>{group.name} ({group.chests.length})</option>
				{/each}
			</UiSelect>
		</label>
	</UiContainer>

	<div class="workspace">
		<UiContainer>
			<div class="chest-list" data-testid="chest-list" bind:this={chestList}>
				{#each selectedGroup?.chests ?? [] as chest (chest.metadata.id)}
					{@const color = chestColor(chest)}
					{@const chestIndex = save.chests.indexOf(chest)}
					<section
						class="chest"
						class:colored={color}
						style:--chest-color={color?.css}
						data-testid="chest-section"
						data-chest-index={chestIndex}
						aria-label={chestName(chest)}
						ondragover={allowDrop}
						ondrop={(event) => dropOnChest(chest, event)}
					>
						<header>
							<h4>{chestName(chest)}</h4>
							<small
								class="used"
								title={`${chest.inventory.usedSlots} of ${chest.inventory.slotCount} slots occupied`}
							>
								{chest.inventory.usedSlots}/{chest.inventory.slotCount}
							</small>
							{#if chest.type}
								<select
									class="chest-type"
									value={chest.type.itemId}
									onchange={(event) => {
										changeType(chest, event.currentTarget.value);
										// Show the real type if the change was refused
										event.currentTarget.value = chest.type?.itemId ?? "";
									}}
									aria-label="Chest type"
									title="Chest type. A smaller one can only be picked when all the items fit."
									data-testid={`chest-${chestIndex}-type`}
								>
									{#each SwappableChests as type (type.itemId)}
										<option
											value={type.itemId}
											disabled={chest.inventory.usedSlots > type.capacity}
										>
											{type.name} ({type.capacity})
										</option>
									{/each}
								</select>
							{:else if chest.isMiniShippingBin}
								<button
									type="button"
									class="chest-type"
									disabled={chest.hasSeparateWalletItems}
									title={chest.hasSeparateWalletItems
										? "It holds items for separate wallets, which a Chest wouldn't show"
										: "Make it a regular Chest. It keeps its items, but they're no longer shipped overnight."}
									onclick={() => expand(chest)}
									data-testid={`chest-${chestIndex}-expand`}
								>
									Expand to 36 slots
								</button>
							{/if}
							<SortButton
								label="Sort this chest"
								nativeTooltip
								onclick={() => sort(chest)}
								data-testid={`sort-chest-${chestIndex}`}
							/>
						</header>
						<div class="item-grid">
							{#each slots(chest) as { index, item }}
								<ItemSlot
									active={multiSelected
										? isPicked(chest, index)
										: chest === selectedChest && index === selectedIndex}
									data-testid={`chest-${chestIndex}-item-${index}`}
									onclick={(event) => select(chest, index, event)}
									ondragover={allowDrop}
									ondrop={(event) => dropOnSlot(chest, index, event)}
								>
									<div
										class="item"
										class:dimmed={searching && item && !matches.has(item)}
										draggable={item !== undefined}
										ondragstart={(event) => dragStart(chest, index, event)}
										ondragend={() => (dragging = undefined)}
										role="presentation"
										data-testid={`chest-${chestIndex}-drag-${index}`}
									>
										<ItemSprite {item} />
									</div>
								</ItemSlot>
							{/each}
						</div>
					</section>
				{:else}
					<p class="empty">
						No {selectedGroup?.name.toLowerCase()} in this save.
					</p>
				{/each}
			</div>
		</UiContainer>

		{#if multiSelected}
			<div class="side">
				<UiContainer>
					<div class="picked" data-testid="chest-multi-selection">
						<strong>{picked.length} items selected</strong>
						<small>
							Drag them onto another chest to move them together, or
							Ctrl/Cmd+click an item to add or remove it.
						</small>
						<button type="button" onclick={() => (picked = [])}>
							Clear selection
						</button>
					</div>
				</UiContainer>
			</div>
		{:else if selectedChest}
			<div class="side">
				<UiContainer>
					<small class="editing">Editing: {chestName(selectedChest)}</small>
					<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
				</UiContainer>
			</div>
		{/if}
	</div>
{/if}

<style>
	.title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.search {
		position: relative;
		margin-bottom: 4px;
	}

	.search :global(input) {
		width: 100%;
		box-sizing: border-box;
		padding-right: 28px;
		font-size: large;
	}

	.clear {
		all: unset;
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		line-height: 20px;
		text-align: center;
		font-size: 22px;
		font-weight: bold;
		color: #6f3b31;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear:hover,
	.clear:focus-visible {
		background-color: rgba(0, 0, 0, 0.12);
	}

	.results {
		display: flex;
		flex-direction: column;
		max-height: 12rem;
		overflow-y: auto;
		margin-top: 4px;
		margin-bottom: 8px;
	}

	.result {
		all: unset;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 4px;
		border-bottom: #5b2b2a 1px solid;
		cursor: pointer;
	}

	.result:hover,
	.result:focus-visible,
	.result.active {
		background-color: rgba(255, 255, 255, 0.4);
	}

	.result-sprite {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.result-name {
		flex: 1;
	}

	.result-chest {
		font-size: small;
		opacity: 0.8;
	}

	.picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.picked {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}

	.picked button {
		font: inherit;
		font-size: 0.85em;
		padding: 2px 8px;
		border: solid 2px #9c613b;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

	/*
	 * A little wider than the other pages, so a chest's 12 slots fit across
	 * with room to spare beside a scrollbar
	 */
	:global(.content):has(.workspace) {
		width: 540px;
	}

	.workspace {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* The item editor, or the multi-selection summary, as wide as the list */
	.side {
		display: flex;
		flex-direction: column;
	}

	/*
	 * All the group's chests, scrolling. Always tall enough for three
	 * regular (36-slot) chests, and taller when the screen has room.
	 */
	.chest-list {
		--three-chests: calc(3 * 166px + 2 * 10px);
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: max(var(--three-chests), calc(100dvh - 590px));
		overflow-y: auto;
		/* The same width whether or not a scrollbar is showing */
		scrollbar-gutter: stable;
		padding-right: 4px;
	}

	/*
	 * On wide screens the item editor sits to the right of the sidebar
	 * instead of under the list, so the list can use the full height
	 */
	@media (min-width: 1600px) {
		.side {
			position: absolute;
			top: 0;
			left: calc(100% + 48px);
			width: 100%;
		}

		.chest-list {
			max-height: max(var(--three-chests), calc(100dvh - 395px));
		}
	}

	.chest {
		--chest-border: #b14e0544;
		border-radius: 6px;
		border: 2px solid var(--chest-border);
	}

	.chest header {
		display: flex;
		align-items: center;
		gap: 4px 8px;
		padding: 4px 8px;
		border-radius: 4px 4px 0 0;
		border-bottom: 2px solid var(--chest-border);
		background: #fff3dc66;
	}

	/* The colour picked for the chest in-game frames it and tints its heading */
	.chest.colored {
		--chest-border: var(--chest-color);
	}

	.chest.colored header {
		background: color-mix(in srgb, var(--chest-color) 45%, #ffe7c2);
	}

	.chest h4 {
		flex: 1;
		margin: 0;
	}

	.used {
		opacity: 0.8;
	}

	.chest-type {
		font: inherit;
		font-size: 0.85em;
		padding: 1px 4px;
		border: solid 2px #9c613b;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

	.chest-type:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.empty {
		opacity: 0.7;
	}

	.editing {
		display: block;
		margin-bottom: 4px;
		opacity: 0.8;
	}

	/* Slots side by side on the plain background, like the backpack */
	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-auto-rows: 36px;
		justify-content: center;
		padding: 6px;
	}

	.item {
		position: relative;
		transition:
			transform 0.1s,
			opacity 3s linear;
		cursor: pointer;
	}

	.item:hover {
		transform: scale(1.2);
		transform-origin: center;
	}

	/* Fade out quickly while searching; fade back in slowly once results close */
	.item.dimmed {
		opacity: 0.3;
		transition:
			transform 0.1s,
			opacity 0.15s;
	}
</style>
