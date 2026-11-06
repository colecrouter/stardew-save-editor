<script lang="ts">
	import { untrack } from "svelte";
	import { Dispose } from "$lib/proxies";
	import { Item } from "$lib/proxies/Item.svelte";
	import type { ItemProxy } from "$lib/proxies/items";
	import ItemSprite from "./ItemSprite.svelte";

	interface Props {
		/** Item to draw, by its name in the item data */
		name: string;
	}

	let { name }: Props = $props();

	// An item proxy holds an effect root, so dispose of the one drawn here when
	// the name changes or the sprite goes away
	let item = $state.raw<ItemProxy>();
	$effect.pre(() => {
		const current = name;
		const created = untrack(() => Item.fromName(current));
		item = created;
		return () => created[Dispose]?.();
	});
</script>

<ItemSprite {item} />
