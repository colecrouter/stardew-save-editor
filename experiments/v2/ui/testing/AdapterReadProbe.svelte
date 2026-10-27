<script lang="ts">
	import Probe from "../../../../tests/editor/components/AdapterReadProbe.svelte";
	import type { ComponentProps } from "svelte";
	let props: ComponentProps<typeof Probe> = $props();
</script>

<Probe {...props} />
