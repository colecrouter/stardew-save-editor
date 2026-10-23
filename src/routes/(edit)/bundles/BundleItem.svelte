<script lang="ts">
	import {
		ingredientKind,
		ingredientName,
		ingredientObject,
		objectKey,
	} from "$lib/bundleIngredients";
	import { KeyToName } from "$lib/ItemData";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import BundleItemSprite from "./BundleItemSprite.svelte";

	interface Props {
		// Accept numeric IDs (legacy) or string keys (1.6 content keys like "DeluxeBait")
		itemId: number | string;
		type: "O" | "BO" | "F" | "H" | "C" | "R";
		quantity?: number;
		quality?: number;
		checked?: boolean;
	}

	let {
		itemId,
		type,
		quantity = 1,
		quality = 0,
		checked = $bindable(),
	}: Props = $props();

	let matchedType = $derived.by(() => {
		switch (type) {
			case "O":
				return "Object";
			case "BO":
				return "BigCraftable";
			case "F":
				return "Furniture";
			case "H":
				return "Hat";
			case "C":
				return "Clothing";
			case "R":
				return "Object";
			default:
				throw new Error(`Unknown item type: ${type}`);
		}
	});

	// Remixed bundles can ask for quality 3, which only iridium items have
	const qualityNames = new Map([
		[1, "Silver"],
		[2, "Gold"],
		[3, "Iridium"],
		[4, "Iridium"],
	]);

	let key = $derived(typeof itemId === "number" ? itemId.toString() : itemId);
	// Ingredients can be gold or a category too; rewards are always items
	let kind = $derived(
		matchedType === "Object" ? ingredientKind(key) : ("item" as const),
	);
	let name = $derived.by(() => {
		if (matchedType === "Object") return ingredientName(key);
		try {
			return KeyToName(key, matchedType);
		} catch {
			return key;
		}
	});
	// A category is drawn as its first object, as the game does
	let spriteKey = $derived.by(() => {
		if (kind === "category") return ingredientObject(key)?._key;
		if (kind === "item") return matchedType === "Object" ? objectKey(key) : key;
	});
	let label = $derived(
		kind === "gold" ? `${quantity.toLocaleString()}g` : name,
	);
</script>

<div class="row">
	<div class="item">
		{#if kind === "gold"}
			<div class="gold"></div>
			<span
				>{quantity.toLocaleString()}g
				<div hidden>gold</div></span
			>
		{:else}
			{#if spriteKey}
				<BundleItemSprite itemKey={spriteKey} type={matchedType} />
			{:else}
				<div class="unknown" aria-hidden="true">?</div>
			{/if}
			<span>
				{#if quantity > 1}<span data-testid="bundle-item-quantity"
						>{quantity}×</span
					>{/if}
				{name}
				{#if qualityNames.has(quality)}
					<span
						class={`star quality-${quality}`}
						title={`${qualityNames.get(quality)} quality or better`}
						data-testid="bundle-item-quality">★</span
					>
				{/if}
			</span>
		{/if}
	</div>

	{#if checked !== undefined}
		<UiCheckbox bind:checked aria-label={`${label} donated`} />
	{/if}
</div>

<style>
	.row {
		align-items: center;
		padding: 4px;
		border-bottom: 1px solid #0004;
		font-size: 0.8rem;
		width: 96px;
		text-align: center;
	}

	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.star {
		font-size: 1.1em;
		-webkit-text-stroke: 0.5px #0006;
	}

	.quality-1 {
		color: #c8d0d8;
	}

	.quality-2 {
		color: #ffd23f;
	}

	.quality-3,
	.quality-4 {
		color: #b56cff;
	}

	.unknown {
		width: 32px;
		height: 32px;
		line-height: 32px;
		font-weight: bold;
	}

	.gold {
		background-image: url(/assets/font_colored.png);
		width: 8px;
		height: 16px;
		zoom: 2;
		background-position: top 0px left -32px;
	}
</style>
