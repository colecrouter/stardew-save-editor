<script lang="ts">
	import PixelFrame from "$lib/ui/PixelFrame.svelte";
	import UiIcon from "$lib/ui/UIIcon.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import { resolveUiAssets, setUiAssets } from "$lib/ui/uiAssets";
	setUiAssets(resolveUiAssets((_, path) => path));
	let enabled = $state(true);
</script>

<button
	type="button"
	onclick={() => {
		enabled = !enabled;
	}}>Toggle frame</button
>
<PixelFrame {enabled}>
	<UiIcon name="inventory" label="Inventory icon" />
	<UiIcon name="farm" />
	<UiInput aria-label="Quantity" type="number" min={13} max={28} value={21} />
</PixelFrame>
