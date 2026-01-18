<script lang="ts" module>
	// Emojis for each equipment slot
	const slotPlaceholders = new Map<ParentIndex, string>([
		["leftRing", "💍"],
		["rightRing", "💍"],
		["boots", "👢"],
		["hat", "🧢"],
		["shirtItem", "👕"],
		["pantsItem", "👖"],
		["trinketItem", "🧸"],
	]);
</script>

<script lang="ts">
	import type { ParentIndex } from "$lib/ItemParentIndex";
	import { Raw } from "$lib/proxies";
	import type { Farmer } from "$lib/proxies/Farmer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import Preview from "../appearance/CharacterPreview.svelte";
	import ItemSlot from "./ItemSlot.svelte";
	import ItemSprite from "./ItemSprite.svelte";

	interface Props {
		player: Farmer;
		selectedIndex: ParentIndex;
	}

	let { player = $bindable(), selectedIndex = $bindable() }: Props = $props();

	function handleClick(index: ParentIndex) {
		selectedIndex = index;
	}

	let trinketSlotStat = $derived(
		player[Raw].stats.Values.item.find((s) => s.key.string === "trinketSlots")
			?.value.unsignedInt ?? 0,
	);
	let trinketsUnlocked = $derived(trinketSlotStat > 0);
</script>

{#snippet slot(index: ParentIndex)}
	{@const item = player.inventory.get(index)}
	<ItemSlot
		data-testid={`item-${index}`}
		onclick={() => handleClick(index)}
		active={selectedIndex === index}
		{item}
	>
		{#if item}
			<ItemSprite {item} />
		{:else}
			{@const placeholder = slotPlaceholders.get(index)}
			{#if placeholder}
				<!-- Empty slot placeholder with emoji -->
				<div class="placeholder">
					{placeholder}
				</div>
			{/if}
		{/if}
	</ItemSlot>
{/snippet}

<div class="character-details">
	<div class="character-inner">
		<div class="character-group">
			<div class="character-armor">
				{@render slot("leftRing")}
				{@render slot("rightRing")}
				{@render slot("boots")}
			</div>
			<Preview {player} />
			<div class="character-armor">
				{@render slot("hat")}
				{@render slot("shirtItem")}
				{@render slot("pantsItem")}
				{#if trinketsUnlocked}
					{@render slot("trinketItem")}
				{/if}
			</div>
		</div>

		<div class="character-name">
			<UiInput type="text" bind:value={player.name} />
		</div>
	</div>
	<div class="character-info">
		<label>
			<span hidden>Farm Name:</span>
			<UiInput type="text" bind:value={player.farmName} data-sentry-mask />
			Farm
		</label>
		<label>
			Current Funds:
			<UiInput type="number" bind:value={player.money} />
		</label>
		<label>
			Total Earnings:
			<UiInput type="number" bind:value={player.totalMoneyEarned} />
		</label>
	</div>
</div>

<style>
	.character-details :global(input) {
		text-align: center;
	}

	.character-name :global(input) {
		width: 10em;
	}

	.character-inner {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.character-details {
		display: flex;
		flex-direction: row;
		gap: 4px;
		align-items: center;
	}

	.character-group {
		display: flex;
		flex-direction: row;
		gap: 4px;
	}

	.character-info {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		text-align: center;
		font-size: 1.2em;
		gap: 8px;
	}

	.character-info > label {
		display: block;
	}

	.character-info :global(input[type="number"]) {
		width: 6em;
	}

	.placeholder {
		width: 24px;
		height: 24px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-shadow: none;
		opacity: 0.33;
	}

	.character-armor {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(3, min-content);
	}
</style>
