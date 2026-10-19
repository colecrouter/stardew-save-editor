<script lang="ts">
	import { untrack } from "svelte";
	import { Dispose } from "$lib/proxies";
	import { Item } from "$lib/proxies/Item.svelte";
	import type { ItemProxy } from "$lib/proxies/items";
	import ItemSprite from "../inventory/ItemSprite.svelte";

	interface Props {
		/** The item's unqualified ID, e.g. "24" */
		itemKey: string;
		/** Its type in the item data, e.g. "Object" or "BigCraftable" */
		type?: string;
	}

	let { itemKey, type = "Object" }: Props = $props();

	// An item proxy holds an effect root, so dispose of the one drawn here when
	// the item changes or the sprite goes away
	let item = $state.raw<ItemProxy>();
	$effect.pre(() => {
		const key = itemKey;
		const kind = type;
		const created = untrack(() => {
			try {
				return Item.fromKey(key, kind);
			} catch {
				return undefined;
			}
		});
		item = created;
		return () => created?.[Dispose]?.();
	});
</script>

<ItemSprite {item} />
