<script lang="ts">
	import { untrack } from "svelte";
	import { Dispose } from "$lib/proxies";
	import { Item } from "$lib/proxies/Item.svelte";
	import type { ItemProxy } from "$lib/proxies/items";
	import Tooltip from "$lib/ui/Tooltip.svelte";
	import type { LovedGift } from "$types/giftTastes";
	import ItemSprite from "../inventory/ItemSprite.svelte";

	interface Props {
		gift: LovedGift;
		testId: string;
	}

	let { gift, testId }: Props = $props();

	// An item proxy holds an effect root, so dispose of it when the gift
	// changes or the icon goes away (e.g. when a search hides the villager)
	let item = $state.raw<ItemProxy>();
	$effect.pre(() => {
		const name = gift.item;
		const created = untrack(() => Item.fromName(name));
		item = created;
		return () => created[Dispose]?.();
	});
</script>

<Tooltip text={gift.name}>
	<div class="icon" role="img" aria-label={gift.name} data-testid={testId}>
		<ItemSprite {item} />
	</div>
</Tooltip>
{#if gift.items}
	<!-- A whole category, such as every book: say so next to the icon -->
	<small class="category" aria-hidden="true" title={gift.items.join(", ")}
		>{gift.name}</small
	>
{/if}

<style>
	/* Shrink the 32px item sprites to small icons */
	.icon {
		zoom: 0.75;
	}

	.category {
		margin-right: 4px;
		font-size: 0.7em;
		opacity: 0.8;
	}
</style>
