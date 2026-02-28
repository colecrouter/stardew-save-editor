<script lang="ts">
	import { Item } from "$lib/proxies/Item.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";

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

	const item = $derived.by(() => {
		const key = typeof itemId === "number" ? itemId.toString() : itemId;
		if (!key) return undefined;
		// If key looks like a number <= 0, treat as gold (no item)
		if (/^-?\d+$/.test(key) && Number.parseInt(key, 10) <= 0) return undefined;
		try {
			return Item.fromKey(key, matchedType);
		} catch (e) {
			console.warn("BundleItem: failed to resolve item by key", {
				key,
				type: matchedType,
				error: e,
			});
			return undefined;
		}
	});
</script>

<div class="row">
	<div class="item">
		{#if item}
			<ItemSprite {item} />
			<span>{item.name}</span>
		{:else}
			<div class="gold"></div>
			<span
				>{quantity}
				<div hidden>gold</div></span
			>
		{/if}
	</div>

	{#if checked !== undefined}
		<UiCheckbox bind:checked />
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

	.gold {
		background-image: url(/assets/font_colored.png);
		width: 8px;
		height: 16px;
		zoom: 2;
		background-position: top 0px left -32px;
	}
</style>
